<?php

namespace App\Domain\Attendance;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\User;
use App\Http\Resources\AttendanceResource;
use App\Support\Api\ApiException;
use App\Support\Authorization\OwnerDecisionRequired;
use App\Support\Pagination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Attendance records and their append-only correction history.
 *
 * Two invariants the fixture did not hold:
 *   1. One record per (session, student) — a real UNIQUE constraint, not a
 *      service-level check, so a concurrent request cannot violate it.
 *   2. A mark is never silently overwritten. Changing one appends a correction
 *      carrying the previous value, the new value, the reason, and the actor.
 *      `recorded_by_user_id` / `changed_by_user_id` come from the authenticated
 *      user only — never from a request body, because a client-supplied value
 *      is an unverified claim.
 *
 * Roster membership is always re-derived server-side from Enrollment: the
 * client's view of who is on the register is not authoritative.
 */
final class AttendanceService
{
    public function __construct(
        private readonly AttendancePolicy $policy,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  session_id, student_id, status, since, until
     * @return LengthAwarePaginator<int, AttendanceRecord>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = AttendanceRecord::query()->with('recorder');
        $this->policy->scope($query, $actor);

        foreach (['session_id' => 'attendance_records.session_id', 'student_id' => 'attendance_records.student_id', 'status' => 'attendance_records.status'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }
        // `since` / `until` bound the SESSION DATE, not the recording instant:
        // "attendance for the past week" means the week's sessions.
        if (($filters['since'] ?? '') !== '') {
            $query->whereIn('attendance_records.session_id', fn ($sub) => $sub->from('class_sessions')->select('id')->where('date', '>=', (string) $filters['since']));
        }
        if (($filters['until'] ?? '') !== '') {
            $query->whereIn('attendance_records.session_id', fn ($sub) => $sub->from('class_sessions')->select('id')->where('date', '<=', (string) $filters['until']));
        }

        return $query->orderByDesc('attendance_records.created_at')->orderBy('attendance_records.id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): AttendanceRecord
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id, $actor);
    }

    /** @param  array<string, mixed>  $input */
    public function record(User $actor, array $input): AttendanceRecord
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(fn () => $this->write($actor, (string) $input['sessionId'], [['studentId' => $input['studentId'], 'status' => $input['status'], 'notes' => $input['notes'] ?? null]], false)[0]);
    }

    /**
     * One transaction — all or nothing. A partially recorded register is worse
     * than an unrecorded one, because it looks complete.
     *
     * @param  array<string, mixed>  $input  sessionId, entries[], acknowledgeWarnings
     * @return list<AttendanceRecord>
     */
    public function bulk(User $actor, array $input): array
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(fn () => $this->write(
            $actor,
            (string) $input['sessionId'],
            $input['entries'],
            filter_var($input['acknowledgeWarnings'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ));
    }

    /**
     * Append a correction and move the record in the same transaction, so the
     * log can never describe a change that did not land.
     *
     * @param  array{status: string, reason: string}  $input
     */
    public function correct(User $actor, string $id, array $input): AttendanceRecord
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $input): AttendanceRecord {
            $record = $this->find($id, $actor, lock: true);
            $previous = $record->status;

            if ($previous === $input['status']) {
                throw ApiException::conflict(
                    'ATTENDANCE_CORRECTION_NOOP',
                    'وضعیت جدید با وضعیت فعلی یکسان است.',
                );
            }

            $this->appendCorrection(
                $record,
                $previous,
                (string) $input['status'],
                (string) $input['reason'],
                $actor,
            );

            $record->status = $input['status'];
            $record->recorded_by_user_id = $actor->id;
            $record->save();

            return $record->refresh()->load('recorder');
        });
    }

    /**
     * @param  array<string, mixed>  $filters  attendance_record_id, session_id, student_id
     * @return LengthAwarePaginator<int, AttendanceCorrection>
     */
    public function corrections(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = AttendanceCorrection::query()->with('editor');
        // The corrections table has no teacher_id of its own; scope through the
        // session the same way records are scoped.
        $this->policy->scope($query, $actor, 'attendance_corrections.session_id');

        foreach (['attendance_record_id' => 'record_id', 'session_id' => 'session_id', 'student_id' => 'student_id'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }

        // Newest first. `id` breaks ties: it is a time-prefixed ULID, so it
        // sorts by generation order when two rows share a created_at second.
        return $query->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    /** @return array{sessionId: string, records: list<array<string, mixed>>, corrections: list<array<string, mixed>>} */
    public function sessionAttendance(User $actor, string $sessionId): array
    {
        $this->policy->authorizeRead($actor);

        $session = $this->findSession($sessionId, $actor);

        $records = AttendanceRecord::query()->with('recorder')
            ->where('session_id', $session->id)
            ->orderBy('student_id')
            ->get()
            ->all();

        $corrections = AttendanceCorrection::query()->with('editor')
            ->where('session_id', $session->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->all();

        return AttendanceResource::sessionAttendanceToWire($session->id, $records, $corrections);
    }

    /**
     * Session ids that already have attendance, so the register can mark which
     * days are done without loading every record.
     *
     * @return list<string>
     */
    public function sessionIdsWithAttendance(User $actor, array $filters): array
    {
        $this->policy->authorizeRead($actor);

        $query = AttendanceRecord::query()->distinct()->select('attendance_records.session_id');
        $this->policy->scope($query, $actor);
        if (($filters['class_id'] ?? '') !== '') {
            $query->whereIn('attendance_records.session_id', fn ($sub) => $sub->from('class_sessions')->select('id')->where('class_id', (string) $filters['class_id']));
        }

        return $query->pluck('session_id')->all();
    }

    /**
     * Shared write path for single and bulk recording.
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<AttendanceRecord>
     */
    private function write(User $actor, string $sessionId, array $entries, bool $acknowledgeWarnings): array
    {
        $session = $this->findSession($sessionId, $actor, lock: true);

        $enrolled = Enrollment::query()
            ->where('class_id', $session->class_id)
            ->where('status', 'active')
            ->pluck('student_id')
            ->all();

        $offRoster = array_values(array_unique(array_filter(
            array_map(fn ($e) => (string) $e['studentId'], $entries),
            fn (string $id) => ! in_array($id, $enrolled, true),
        )));

        if ($offRoster !== [] && ! $acknowledgeWarnings) {
            throw new ApiException(
                422,
                'ATTENDANCE_STUDENT_NOT_ENROLLED',
                'این هنرجو در کلاس این جلسه ثبت‌نام ندارد.',
                ['studentId' => $offRoster],
                ['studentIds' => $offRoster],
            );
        }

        $records = [];
        foreach ($entries as $entry) {
            $records[] = $this->upsert($actor, $session, (string) $entry['studentId'], (string) $entry['status'], $entry['notes'] ?? null);
        }

        return $records;
    }

    private function upsert(User $actor, ClassSession $session, string $studentId, string $status, mixed $notes): AttendanceRecord
    {
        $record = AttendanceRecord::query()
            ->where('session_id', $session->id)
            ->where('student_id', $studentId)
            ->first();

        if ($record === null) {
            try {
                // Assigned field by field, not mass-assigned: `id` is not in
                // $fillable, and a dropped id would hit the NOT NULL primary key.
                $fresh = new AttendanceRecord;
                $fresh->id = 'att_'.strtolower((string) Str::ulid());
                $fresh->session_id = $session->id;
                $fresh->student_id = $studentId;
                $fresh->status = $status;
                $fresh->notes = $notes === null ? null : (string) $notes;
                $fresh->recorded_by_user_id = $actor->id;
                $fresh->save();

                return $fresh->load('recorder');
            } catch (QueryException $e) {
                // Only a unique-constraint violation means "already recorded".
                // Anything else is a different fault and must NOT be reported as
                // a duplicate, so it is rethrown unchanged.
                if (! $this->isUniqueViolation($e)) {
                    throw $e;
                }

                // The UNIQUE(session_id, student_id) constraint is the real
                // guard; a race surfaces here as an integrity violation.
                throw ApiException::conflict(
                    'ATTENDANCE_DUPLICATE',
                    'برای این هنرجو در این جلسه از قبل رکورد ثبت شده است.',
                    ['conflicts' => ['studentId' => $studentId]],
                );
            }
        }

        if ($record->status !== $status) {
            $this->appendCorrection(
                $record,
                $record->status,
                $status,
                'ثبت مجدد حضور و غیاب گروهی',
                $actor,
            );
        }

        $record->status = $status;
        $record->notes = $notes === null ? $record->notes : (string) $notes;
        $record->recorded_by_user_id = $actor->id;
        $record->save();

        return $record->refresh()->load('recorder');
    }

    /**
     * Append a correction. This is the ONLY way a correction row is written —
     * there is no update or delete path anywhere in the service.
     */
    private function appendCorrection(
        AttendanceRecord $record,
        string $previousStatus,
        string $newStatus,
        string $reason,
        User $actor,
    ): AttendanceCorrection {
        $correction = new AttendanceCorrection;
        $correction->id = 'cor_'.strtolower((string) Str::ulid());
        $correction->record_id = $record->id;
        $correction->session_id = $record->session_id;
        $correction->student_id = $record->student_id;
        $correction->previous_status = $previousStatus;
        $correction->new_status = $newStatus;
        $correction->reason = $reason;
        $correction->changed_by_user_id = $actor->id;
        $correction->save();

        return $correction;
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'unique constraint failed')
            || str_contains($message, 'duplicate entry')
            || str_contains($message, 'unique violation');
    }

    public function find(string $id, User $actor, bool $lock = false): AttendanceRecord
    {
        $query = AttendanceRecord::query()->with('recorder')->whereKey($id);
        $this->policy->scope($query, $actor);
        if ($lock) {
            $query->lockForUpdate();
        }
        $record = $query->first();
        if ($record === null) {
            throw ApiException::notFound('ATTENDANCE_NOT_FOUND', "رکورد حضور با شناسهٔ {$id} یافت نشد.");
        }

        return $record;
    }

    private function findSession(string $sessionId, User $actor, bool $lock = false): ClassSession
    {
        $query = ClassSession::query()->whereKey($sessionId);
        if ($actor->role === 'teacher') {
            $teacherId = trim((string) $actor->teacher_id);
            if ($teacherId === '') {
                throw new OwnerDecisionRequired(
                    'PB-1',
                    'Teacher account has no linked teacherId; attendance scope is owner decision PB-1.',
                );
            }
            $query->where('teacher_id', $teacherId);
        }
        if ($lock) {
            $query->lockForUpdate();
        }
        $session = $query->first();
        if ($session === null) {
            throw ApiException::notFound('ATTENDANCE_SESSION_NOT_FOUND', "جلسه با شناسهٔ {$sessionId} یافت نشد یا در دسترس شما نیست.");
        }

        return $session;
    }
}
