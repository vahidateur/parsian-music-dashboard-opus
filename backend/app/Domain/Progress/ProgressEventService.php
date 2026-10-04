<?php

namespace App\Domain\Progress;

use App\Models\Piece;
use App\Models\PieceAssignment;
use App\Models\ProgressEvent;
use App\Models\Student;
use App\Support\Api\ApiException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The append-only progress log, plus the two derived reads built on it.
 *
 * TENANT ISOLATION — every query goes through `ProgressEvent`, which uses the
 * `BelongsToOrganization` global scope, so another organization's event is not
 * merely filtered out of the result, it is never queried. New rows take
 * `organization_id` from the context; request input never supplies one.
 *
 * SERVER-AUTHORITATIVE VALUES — `student_id` and `piece_id` are copied from the
 * assignment the event belongs to, never accepted from the client. The
 * assignment's `latest` snapshot is recomputed after every append, derived
 * strictly from the log, so a back-dated entry cannot make the snapshot
 * disagree with the history a chart draws.
 *
 * This service carries no actor and makes no authorization decision; that lives
 * in `ProgressPolicy`, which the controller calls first.
 */
final class ProgressEventService
{
    public function __construct(
        private readonly Analytics $analytics,
        private readonly RecommendationEngine $recommendations,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  validated query (student_id, piece_id, assignment_id, since, until)
     */
    public function paginate(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return ProgressEvent::query()
            ->when(filled($filters['student_id'] ?? null), fn (Builder $q): Builder => $q->where('student_id', $filters['student_id']))
            ->when(filled($filters['piece_id'] ?? null), fn (Builder $q): Builder => $q->where('piece_id', $filters['piece_id']))
            ->when(filled($filters['assignment_id'] ?? null), fn (Builder $q): Builder => $q->where('assignment_id', $filters['assignment_id']))
            ->when(filled($filters['since'] ?? null), fn (Builder $q): Builder => $q->where('recorded_at', '>=', $filters['since']))
            ->when(filled($filters['until'] ?? null), fn (Builder $q): Builder => $q->where('recorded_at', '<=', $filters['until']))
            // Newest first: the log is read for what happened most recently.
            ->recentFirst()
            ->paginate(perPage: $perPage, page: $page);
    }

    /**
     * Appends one event and recomputes the assignment snapshot.
     *
     * @param  array<string, mixed>  $input  validated camelCase wire input
     *
     * @throws ApiException ASSIGNMENT_NOT_FOUND, PROGRESS_INVALID
     */
    public function record(array $input): ProgressEvent
    {
        // A foreign assignment is invisible to the scoped query, so this 404s
        // rather than leaking that the id exists elsewhere.
        $assignment = (new AssignmentService)->findOrFail((string) $input['assignmentId']);
        $piece = $assignment->piece;

        $fields = $this->validateSemantics($input, $assignment, $piece);

        if ($fields !== []) {
            throw ApiException::validation('PROGRESS_INVALID', 'اطلاعات پیشرفت معتبر نیست.', $fields);
        }

        return DB::transaction(function () use ($input, $assignment): ProgressEvent {
            $event = new ProgressEvent;
            // Ids are generated here, not by the database: the row is a string
            // key and `create()` would otherwise insert NULL.
            $event->id = 'pe_'.strtolower((string) Str::ulid());
            $event->fill([
                // Server-authoritative: from the assignment, never the client.
                'assignment_id' => $assignment->id,
                'student_id' => $assignment->student_id,
                'piece_id' => $assignment->piece_id,
                'recorded_at' => $input['recordedAt'] ?? now(),
                'range_start' => $input['rangeStart'] ?? null,
                'range_end' => $input['rangeEnd'] ?? null,
                'range_label' => $input['rangeLabel'] ?? null,
                'tempo_bpm' => $input['tempoBpm'] ?? null,
                'target_tempo_bpm' => $input['targetTempoBpm'] ?? null,
                'mastery' => (int) $input['mastery'],
                'practice_minutes' => $input['practiceMinutes'] ?? null,
                'teacher_note' => $input['teacherNote'] ?? null,
                'student_note' => $input['studentNote'] ?? null,
                'source' => $input['source'],
                'session_id' => $input['sessionId'] ?? null,
            ])->save();

            $this->refreshSnapshot($assignment);

            return $event->refresh();
        });
    }

    /**
     * The student's assignments joined to their pieces — the `AssignmentWithPiece[]`
     * half of the overview, on its own.
     *
     * This is the 14th Progress endpoint (`GET /students/{id}/assignments`,
     * authorized 2026-10-03). It shares the lookup and the query with
     * `overviewFor()` so the two can never disagree about which assignments a
     * student has or what order they come back in.
     *
     * @return list<array{assignment: PieceAssignment, piece: Piece|null}>
     *
     * @throws ApiException STUDENT_NOT_FOUND
     */
    public function assignmentsFor(string $studentId): array
    {
        return $this->assignmentsForStudent($this->studentOrFail($studentId))
            ->map(fn (PieceAssignment $assignment): array => [
                'assignment' => $assignment,
                'piece' => $assignment->piece,
            ])
            ->all();
    }

    /**
     * Tenant-scoped student lookup.
     *
     * A foreign student is invisible to the scoped query, so this 404s rather
     * than leaking that the id exists in another organization. Shared by both
     * derived reads so they cannot diverge on 404 semantics.
     *
     * @throws ApiException STUDENT_NOT_FOUND
     */
    private function studentOrFail(string $studentId): Student
    {
        $student = Student::query()->whereKey($studentId)->first();
        if ($student === null) {
            throw ApiException::notFound('STUDENT_NOT_FOUND', "هنرجو با شناسهٔ {$studentId} یافت نشد.");
        }

        return $student;
    }

    /**
     * Newest assignment first: the current work is what a teacher opens for.
     * `id` is the tie-break so two assignments sharing a timestamp still come
     * back in a stable order.
     *
     * @return Collection<int, PieceAssignment>
     */
    private function assignmentsForStudent(Student $student): Collection
    {
        return PieceAssignment::query()
            ->where('student_id', $student->id)
            ->with('piece')
            ->orderByDesc('assigned_at')->orderByDesc('id')
            ->get();
    }

    /**
     * The student's progress overview — assignments, insights, ordered
     * recommendations and the most recent events.
     *
     * @return array{assignments: array<int, array<string, mixed>>, insights: array<int, array<string, mixed>>, recommendations: array<int, array<string, mixed>>, recentEvents: array<int, array<string, mixed>>}
     *
     * @throws ApiException STUDENT_NOT_FOUND
     */
    public function overviewFor(string $studentId): array
    {
        $student = $this->studentOrFail($studentId);
        $assignments = $this->assignmentsForStudent($student);

        // One query for the whole history, then grouped in memory — not a
        // query per assignment.
        $eventsByAssignment = ProgressEvent::query()
            ->where('student_id', $student->id)
            ->chronological()
            ->get()
            ->groupBy('assignment_id');

        $insights = [];
        $recommendations = [];

        foreach ($assignments as $assignment) {
            // A closed assignment is history, not current work.
            if (in_array($assignment->status, PieceAssignment::CLOSED_STATUSES, true)) {
                continue;
            }

            /** @var Collection<int, ProgressEvent> $events */
            $events = $eventsByAssignment->get($assignment->id, collect());

            $insight = $this->analytics->classify($assignment, $events);
            $insights[] = $insight;

            foreach ($this->recommendations->recommendForAssignment($insight, $assignment, $assignment->piece) as $recommendation) {
                $recommendations[] = $recommendation;
            }
        }

        return [
            'assignments' => $assignments->map(fn (PieceAssignment $a): array => [
                'assignment' => $a,
                'piece' => $a->piece,
            ])->all(),
            'insights' => $insights,
            'recommendations' => $this->recommendations->sort($recommendations),
            'recentEvents' => ProgressEvent::query()
                ->where('student_id', $student->id)
                ->recentFirst()
                ->limit(ProgressEvent::RECENT_EVENT_LIMIT)
                ->get()
                ->all(),
        ];
    }

    /**
     * Recomputes an assignment's cached snapshot from its newest event.
     *
     * Derived strictly from the log, so a back-dated entry cannot make the
     * snapshot disagree with the history a chart draws. With no events there is
     * nothing to recompute and the existing snapshot is left alone.
     *
     * The newest event is chosen by `recorded_at` DESC with `id` DESC as the
     * tie-break — the exact mirror of the chronological order analytics uses —
     * so the snapshot and the chart can never disagree.
     */
    public function refreshSnapshot(PieceAssignment $assignment): void
    {
        $newest = ProgressEvent::query()
            ->where('assignment_id', $assignment->id)
            ->recentFirst()
            ->first();

        if ($newest === null) {
            return;
        }

        $assignment->forceFill(['latest' => [
            'rangeStart' => $newest->range_start,
            'rangeEnd' => $newest->range_end,
            'rangeLabel' => $newest->range_label,
            'tempoBpm' => $newest->tempo_bpm,
            'targetTempoBpm' => $newest->target_tempo_bpm,
            'mastery' => $newest->mastery,
            // Stored as the wire string, not a Carbon: the column is a JSON
            // array, and an explicit format keeps the round-trip identical
            // whichever way the snapshot is read back.
            'recordedAt' => $newest->recorded_at->format('Y-m-d\\TH:i:s.v\\Z'),
            'eventId' => $newest->id,
        ]])->save();
    }

    /**
     * Validates what only the database can answer: whether the assignment is
     * still open, and whether the range shape matches how the piece is
     * subdivided. Field bounds are handled by the FormRequest.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, array<int, string>>
     */
    private function validateSemantics(array $input, PieceAssignment $assignment, ?Piece $piece): array
    {
        $fields = [];

        if (in_array($assignment->status, PieceAssignment::CLOSED_STATUSES, true)) {
            $fields['assignmentId'] = ['این تخصیص بسته شده است و پیشرفت جدیدی نمی‌پذیرد.'];
        }

        // Range: shape must match how the piece is subdivided.
        $usesFreeform = $piece !== null && $piece->range_unit === 'freeform';
        $hasNumericRange = array_key_exists('rangeStart', $input) || array_key_exists('rangeEnd', $input);

        if ($hasNumericRange) {
            if ($usesFreeform) {
                $fields['rangeStart'] = ['این قطعه محدودهٔ عددی ندارد؛ از برچسب متنی استفاده کنید.'];
            } else {
                $start = $input['rangeStart'] ?? null;
                $end = $input['rangeEnd'] ?? null;

                if ($start !== null && ($start < 0 || $start > ProgressRules::MAX_RANGE_VALUE)) {
                    $fields['rangeStart'] = ['مقدار نامعتبر است.'];
                }
                if ($end !== null && ($end < 0 || $end > ProgressRules::MAX_RANGE_VALUE)) {
                    $fields['rangeEnd'] = ['مقدار نامعتبر است.'];
                }
                if ($start !== null && $end !== null && $end < $start) {
                    $fields['rangeEnd'] = ['پایان محدوده نمی‌تواند کوچک‌تر از شروع باشد.'];
                }
                if ($piece?->total_range !== null && $end !== null && $end > $piece->total_range) {
                    $unit = $piece->range_unit === 'measure' ? 'میزان' : 'واحد';
                    $fields['rangeEnd'] = ["این قطعه {$piece->total_range} {$unit} دارد."];
                }
            }
        } elseif ($usesFreeform && empty($input['rangeLabel'])) {
            $fields['rangeLabel'] = ['برای این قطعه، توضیح محدوده الزامی است.'];
        }

        return $fields;
    }
}
