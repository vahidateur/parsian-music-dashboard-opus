<?php

namespace App\Domain\Compensation;

use App\Domain\Scheduling\SessionPolicy;
use App\Domain\Scheduling\SessionService;
use App\Models\AcademyClass;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Compensation;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Compensation persistence and domain rules of the caller's organization.
 *
 * A faithful server port of the demo contract (`src/domains/compensation`):
 * the five verbs, the pair-lifetime uniqueness, the append-only ledger, the
 * reschedule-lineage derivation and every refusal code are the same — only
 * the enforcement points move server-side (transactions + unique key
 * instead of one event loop; the actor re-derived from the token instead of
 * trusted from the payload).
 *
 * This service carries NO permission decision beyond participation: the
 * `schedule.read` / `schedule.write` checks live in `CompensationPolicy`,
 * which the controller calls first. Teacher scoping follows T-02 exactly
 * (own classes only, PB-1 fail-closed for unlinked teachers), answered
 * through `SessionPolicy` so the two domains cannot drift apart.
 */
final class CompensationService
{
    private const ATTEMPT_LINEAGE_MAX_MOVES = 32;

    public function __construct(
        private readonly TenantContext $tenant,
        private readonly CompensationPolicy $policy,
        private readonly SessionPolicy $sessions,
        private readonly SessionService $scheduling,
        private readonly \App\Domain\Organization\OrganizationService $organization,
    ) {}

    /* ------------------------------------------------------------ reads */

    /**
     * The caller's obligations: participation is the boundary, then the
     * demo's filters. Derived filters are computed over the full derived set
     * before paging so `meta.total` stays honest.
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(User $actor, array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = $this->scoped(Compensation::query(), $actor);
        if (filled($filters['originalSessionId'] ?? null)) {
            $query->where('original_session_id', trim((string) $filters['originalSessionId']));
        }
        if (filled($filters['studentId'] ?? null)) {
            $query->where('student_id', trim((string) $filters['studentId']));
        }
        if (filled($filters['classId'] ?? null)) {
            $query->where('class_id', trim((string) $filters['classId']));
        }

        $rows = $query->orderByDesc('required_at')->orderBy('id')->get();
        $derived = [];
        foreach ($rows as $row) {
            [$view, $lineage] = $this->derived($row, $actor);
            if (! $this->matchesDerived($view, $lineage['chain'] ?? [], $filters)) {
                continue;
            }
            $derived[] = $view;
        }
        $total = count($derived);
        $items = array_slice($derived, ($page - 1) * $perPage, $perPage);

        return new LengthAwarePaginator($items, $total, $perPage, $page);
    }

    /** @return array<string, mixed> */
    public function get(User $actor, string $id): array
    {
        $this->policy->authorizeRead($actor);

        return $this->readModel($this->find($actor, $id), $actor);
    }

    /* ------------------------------------------------------------ writes */

    /** @param  array<string, mixed>  $input  validated wire input */
    public function register(User $actor, array $input): array
    {
        $this->sessions->assertTeacherLinked($actor);
        $this->policy->authorizeWrite($actor);

        $original = ClassSession::query()->whereKey(trim((string) $input['originalSessionId']))->first();
        if ($original === null) {
            throw ApiException::notFound('COMPENSATION_ORIGINAL_NOT_FOUND', 'جلسهٔ لغوشده یافت نشد.');
        }
        $class = AcademyClass::query()->whereKey($original->class_id)->first();
        if ($class === null) {
            throw ApiException::validation('COMPENSATION_CLASS_NOT_FOUND', 'کلاس جلسه یافت نشد.', [
                'originalSessionId' => ['کلاس این جلسه یافت نشد.'],
            ]);
        }
        if ($original->status !== 'cancelled') {
            throw ApiException::conflict('COMPENSATION_ORIGINAL_NOT_CANCELLED', 'جبرانی فقط برای جلسهٔ لغوشده ثبت می‌شود.');
        }
        if ($class->kind !== 'private') {
            throw ApiException::conflict('COMPENSATION_CLASS_NOT_PRIVATE', 'جبرانی فقط برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.');
        }
        $body = trim((string) ($input['reason'] ?? ''));
        if ($body === '') {
            throw ApiException::validation('COMPENSATION_REASON_REQUIRED', 'دلیل نیاز به جبرانی الزامی است.', ['reason' => ['دلیل را وارد کنید.']]);
        }

        $this->assertPairFree($original->id, trim((string) $input['studentId']));
        $this->assertWithinMakeupCap(trim((string) $input['studentId']));

        $roster = $this->scheduling->roster($actor, $original->id);
        $affected = $this->resolveAffectedStudent($roster, trim((string) $input['studentId']));

        $mark = $this->findMark($original->id, $affected);
        if ($mark !== null && ($input['acknowledgedOriginalAttendance'] ?? false) !== true) {
            throw ApiException::conflict(
                'COMPENSATION_ORIGINAL_ATTENDANCE_UNACKNOWLEDGED',
                'برای این هنرجو در جلسهٔ لغوشده حضور و غیبت ثبت شده است؛ ثبت جبرانی را تأیید کنید.',
            );
        }

        try {
            $record = DB::transaction(function () use ($actor, $original, $class, $affected, $body, $mark): Compensation {
                // Re-checked inside the transaction: two browsers do not share
                // an event loop, so the check-then-write must be atomic here.
                // The unique key is the backstop; this read decides the code.
                $this->assertPairFree($original->id, $affected);
                $this->assertWithinMakeupCap($affected);

                $now = Carbon::now();
                $record = new Compensation;
                $record->id = 'cp_'.strtolower((string) Str::ulid());
                $record->organization_id = $this->tenant->organizationId();
                $record->original_session_id = $original->id;
                $record->class_id = $class->id;
                $record->student_id = $affected;
                $record->reason = $body;
                $record->required_at = $now;
                $record->required_by_user_id = $actor->id;
                $record->attempts = [];
                $record->original_attendance_acknowledged_at = $mark !== null ? $now : null;
                $record->save();

                return $record->refresh();
            });
        } catch (UniqueConstraintViolationException $e) {
            throw $this->pairConflict($original->id, trim((string) $input['studentId']));
        }

        return $this->readModel($record, $actor);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function schedule(User $actor, string $id, array $input): array
    {
        $this->sessions->assertTeacherLinked($actor);
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $input): array {
            /** @var Compensation $record */
            $record = Compensation::query()->whereKey($id)->lockForUpdate()->first()
                ?? throw ApiException::notFound('COMPENSATION_NOT_FOUND', 'جبرانی یافت نشد.');
            $this->ensureParticipant($actor, $record);

            if ($record->completed_at !== null) {
                throw ApiException::conflict('COMPENSATION_ALREADY_SETTLED', 'این جبرانی انجام‌شده ثبت شده است.');
            }
            $lineage = $this->lineageOf($record);
            if ($lineage !== null && $this->isLive($lineage)) {
                throw ApiException::conflict('COMPENSATION_ALREADY_SCHEDULED', 'برای این جبرانی یک جلسهٔ جبرانی فعال وجود دارد.');
            }

            // The class is re-checked at booking time: it may have been
            // archived or repurposed since registration, and the eligibility
            // that held then must not be assumed now.
            $class = AcademyClass::query()->whereKey($record->class_id)->first();
            if ($class === null || $class->kind !== 'private') {
                throw ApiException::conflict('COMPENSATION_CLASS_NOT_PRIVATE', 'جبرانی فقط برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.');
            }
            $original = ClassSession::query()->whereKey($record->original_session_id)->first();
            $teacherId = $input['teacherId'] ?? $original?->teacher_id;
            $roomId = $input['roomId'] ?? $original?->room_id;
            if (! is_string($teacherId) || $teacherId === '' || ! is_string($roomId) || $roomId === '') {
                $fields = [];
                if (! is_string($teacherId) || $teacherId === '') {
                    $fields['teacherId'] = ['مدرس الزامی است.'];
                }
                if (! is_string($roomId) || $roomId === '') {
                    $fields['roomId'] = ['اتاق الزامی است.'];
                }
                throw ApiException::validation('SESSION_INVALID', 'اطلاعات جلسه معتبر نیست.', $fields);
            }
            $session = $this->scheduling->create($actor, [
                'classId' => $record->class_id,
                'date' => (string) $input['date'],
                'startTime' => (string) $input['startTime'],
                'endTime' => (string) $input['endTime'],
                'teacherId' => $teacherId,
                'roomId' => $roomId,
                'acknowledgeWarnings' => $input['acknowledgeWarnings'] ?? false,
            ]);

            $attempts = $record->attempts ?? [];
            $attempts[] = [
                'sessionId' => $session->id,
                'scheduledAt' => Carbon::now()->toJSON(),
                'scheduledByUserId' => $actor->id,
            ];
            $record->attempts = $attempts;
            $record->save();

            return $this->readModel($record->refresh(), $actor);
        });
    }

    /** @param  array<string, mixed>  $input  validated wire input (unused: discharge needs no fields) */
    public function complete(User $actor, string $id, array $input = []): array
    {
        $this->sessions->assertTeacherLinked($actor);
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id): array {
            /** @var Compensation $record */
            $record = Compensation::query()->whereKey($id)->lockForUpdate()->first()
                ?? throw ApiException::notFound('COMPENSATION_NOT_FOUND', 'جبرانی یافت نشد.');
            $this->ensureParticipant($actor, $record);

            if ($record->completed_at !== null) {
                throw ApiException::conflict('COMPENSATION_ALREADY_SETTLED', 'جبرانی این جلسه پیش‌تر انجام‌شده ثبت شده است.');
            }
            $lineage = $this->lineageOf($record);
            if ($lineage === null || ! $this->isLive($lineage)) {
                throw ApiException::conflict('COMPENSATION_NOT_SCHEDULED', 'جبرانی فعالی برای انجام ثبت نشده است.');
            }

            $now = Carbon::now();
            $record->completed_at = $now;
            $record->completed_by_user_id = $actor->id;
            $record->save();

            return $this->readModel($record->refresh(), $actor);
        });
    }

    /* ------------------------------------------------------------ viewing */

    /**
     * The teacher scope, answered by the same rule as sessions: own classes
     * only, PB-1 fail-closed for unlinked teachers, whole organization for
     * everyone else.
     *
     * @return list<string>|null  null = organization-wide; a list = teacher's class ids
     */
    public function teacherClassIds(User $actor): ?array
    {
        $teacherId = $this->sessions->teacherScope($actor);
        if ($teacherId === null) {
            return null;
        }

        return AcademyClass::query()->where('teacher_id', $teacherId)->pluck('id')->all();
    }

    /* ------------------------------------------------------------ private */

    private function scoped(Builder $query, User $actor): Builder
    {
        // Participation-style scope is per-thread in chat; here the analogue
        // is the teacher's own classes (T-02, option B). Non-teachers read the
        // whole organization; an unlinked teacher never reaches a query.
        $classIds = $this->teacherClassIds($actor);
        if ($classIds === null) {
            return $query;
        }

        return $query->whereIn('class_id', $classIds);
    }

    private function find(User $actor, string $id): Compensation
    {
        $record = $this->scoped(Compensation::query(), $actor)->whereKey(trim($id))->first();
        if ($record === null) {
            // Unknown id and out-of-scope id are indistinguishable on purpose:
            // knowing an id never grants its read.
            throw ApiException::notFound('COMPENSATION_NOT_FOUND', 'جبرانی یافت نشد.');
        }

        return $record;
    }

    /**
     * The write paths re-resolve participation rather than trusting any list
     * result: a caller that could list a row it may not write would still be
     * refused here, exactly as a caller that knew only the id would be.
     */
    private function ensureParticipant(User $actor, Compensation $record): void
    {
        $classIds = $this->teacherClassIds($actor);
        if ($classIds !== null && ! in_array($record->class_id, $classIds, true)) {
            throw ApiException::notFound('COMPENSATION_NOT_FOUND', 'جبرانی یافت نشد.');
        }
    }

    /**
     * @param  array<string, mixed>  $view
     * @param  list<string>  $chain
     * @param  array<string, mixed>  $filters
     */
    private function matchesDerived(array $view, array $chain, array $filters): bool
    {
        if (isset($filters['status']) && $filters['status'] !== '' && $view['status'] !== $filters['status']) {
            return false;
        }
        if (! empty($filters['openOnly']) && $view['status'] === 'completed') {
            return false;
        }
        if (! empty($filters['needsAttention']) && $view['attemptBroken'] !== true) {
            return false;
        }
        if (! empty($filters['compensationSessionId'])) {
            $wanted = trim((string) $filters['compensationSessionId']);
            if (! in_array($wanted, $chain, true)) {
                return false;
            }
        }

        return true;
    }

    private function assertPairFree(string $originalSessionId, string $studentId): void
    {
        $existing = Compensation::query()
            ->where('original_session_id', $originalSessionId)
            ->where('student_id', $studentId)
            ->first();
        if ($existing === null) {
            return;
        }
        if ($existing->completed_at !== null) {
            throw ApiException::conflict('COMPENSATION_ALREADY_SETTLED', 'جبرانی این جلسه پیش‌تر انجام‌شده ثبت شده است.');
        }
        throw ApiException::conflict('COMPENSATION_ALREADY_OPEN', 'برای این جلسه و هنرجو از قبل یک جبرانی باز ثبت شده است.');
    }

    private function pairConflict(string $originalSessionId, string $studentId): ApiException
    {
        // The unique key fired under concurrency: re-read to name the refusal
        // the pair's state actually calls for.
        $existing = Compensation::query()
            ->where('original_session_id', $originalSessionId)
            ->where('student_id', $studentId)
            ->first();
        if ($existing !== null && $existing->completed_at !== null) {
            return ApiException::conflict('COMPENSATION_ALREADY_SETTLED', 'جبرانی این جلسه پیش‌تر انجام‌شده ثبت شده است.');
        }

        return ApiException::conflict('COMPENSATION_ALREADY_OPEN', 'برای این جلسه و هنرجو از قبل یک جبرانی باز ثبت شده است.');
    }

    private function assertWithinMakeupCap(string $studentId): void
    {
        $cap = (int) $this->organization->get()->max_makeups_per_term;
        $used = Compensation::query()->where('student_id', $studentId)->count();
        if ($used < $cap) {
            return;
        }
        throw ApiException::conflict(
            'COMPENSATION_MAKEUP_CAP_REACHED',
            $cap <= 0
                ? 'این آموزشگاه جلسهٔ جبرانی ثبت نمی‌کند؛ سقف در «قواعد جلسه» صفر است.'
                : "سقف جلسات جبرانی این هنرجو ({$cap}) پر شده است. برای تغییر آن، قواعد جلسه را ویرایش کنید.",
        );
    }

    /**
     * @param  list<array{studentId: string, studentName: string}>  $roster
     * @return string  the frozen student id
     */
    private function resolveAffectedStudent(array $roster, string $studentId): string
    {
        if (count($roster) === 0) {
            throw ApiException::conflict('COMPENSATION_NO_AFFECTED_STUDENT', 'برای این جلسه هنرجویی در فهرست ثبت‌نام فعال نیست؛ جبرانی ثبت نمی‌شود.');
        }
        if (count($roster) > 1) {
            throw ApiException::conflict('COMPENSATION_ROSTER_AMBIGUOUS', 'این جلسه بیش از یک هنرجو دارد؛ جبرانی فقط برای کلاس خصوصی ثبت می‌شود.');
        }
        if ($roster[0]['studentId'] !== $studentId) {
            throw ApiException::conflict('COMPENSATION_STUDENT_MISMATCH', 'هنرجوی انتخاب‌شده همان هنرجوی این جلسه نیست.');
        }

        return $roster[0]['studentId'];
    }

    private function findMark(string $sessionId, string $studentId): ?AttendanceRecord
    {
        return AttendanceRecord::query()
            ->where('session_id', $sessionId)
            ->where('student_id', $studentId)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /* ------------------------------------------------- derivation (port) */

    /**
     * Lineage walk, ported from `attemptLineageOf` in
     * `src/domains/compensation/derive.ts`: the forward link is
     * authoritative; the reverse `rescheduledFromId` scan is the fallback
     * for a moved-from row that no longer exists; cycles and over-long
     * chains resolve to `missing`, never guessed.
     *
     * @return array{entrySessionId: string, effectiveSessionId: string, effectiveStatus: string, moves: int, resolvable: bool, chain: list<string>}|null
     */
    private function lineageOf(Compensation $record): ?array
    {
        $attempts = $record->attempts ?? [];
        if ($attempts === []) {
            return null;
        }
        $last = $attempts[count($attempts) - 1];
        $entry = (string) ($last['sessionId'] ?? '');

        $visited = [$entry];
        $seen = [$entry => true];
        $currentId = $entry;
        $moves = 0;

        for (;;) {
            $row = ClassSession::query()->whereKey($currentId)->first();
            $forward = $row?->rescheduled_to_id;
            $nextId = is_string($forward) && $forward !== '' ? $forward : null;
            if ($nextId === null && ($row === null || $row->status === 'cancelled')) {
                $successor = ClassSession::query()->where('rescheduled_from_id', $currentId)->first();
                $nextId = $successor?->id;
            }

            if ($nextId === null) {
                return [
                    'entrySessionId' => $entry,
                    'effectiveSessionId' => $currentId,
                    'effectiveStatus' => $row?->status ?? 'missing',
                    'moves' => $moves,
                    'resolvable' => $row !== null,
                    'chain' => $visited,
                ];
            }

            if (isset($seen[$nextId]) || $moves >= self::ATTEMPT_LINEAGE_MAX_MOVES) {
                return [
                    'entrySessionId' => $entry,
                    'effectiveSessionId' => $currentId,
                    'effectiveStatus' => 'missing',
                    'moves' => $moves,
                    'resolvable' => false,
                    'chain' => $visited,
                ];
            }

            $seen[$nextId] = true;
            $visited[] = $nextId;
            $currentId = $nextId;
            $moves++;
        }
    }

    /** @param  array{effectiveStatus: string}|null  $lineage */
    private function isLive(?array $lineage): bool
    {
        if ($lineage === null) {
            return false;
        }

        return $lineage['effectiveStatus'] !== 'missing' && $lineage['effectiveStatus'] !== 'cancelled';
    }

    /**
     * The read model plus the resolved lineage, from one walk: `list`
     * (filtering), `readModel` and the write paths all answer from the same
     * resolution, so they cannot disagree about which session the make-up is
     * on or whether it is live.
     *
     * @return array{0: array<string, mixed>, 1: array{entrySessionId: string, effectiveSessionId: string, effectiveStatus: string, moves: int, resolvable: bool, chain: list<string>}|null}
     */
    private function derived(Compensation $record, User $viewer): array
    {
        $lineage = $this->lineageOf($record);
        $view = $this->readModel($record, $viewer, $lineage);

        return [$view, $lineage];
    }

    /** @return array<string, mixed> */
    private function readModel(Compensation $record, User $viewer, ?array $lineage = null): array
    {
        $lineage ??= $this->lineageOf($record);
        $completed = $record->completed_at !== null;

        if ($completed) {
            $status = 'completed';
        } else {
            $status = $lineage !== null && $this->isLive($lineage) ? 'scheduled' : 'required';
        }

        $currentAttempt = null;
        $attempts = $record->attempts ?? [];
        if ($attempts !== [] && $lineage !== null) {
            $currentAttempt = [
                'sessionId' => $lineage['effectiveSessionId'],
                'sessionStatus' => $lineage['effectiveStatus'],
                'bookedSessionId' => $lineage['entrySessionId'],
                'rescheduleCount' => $lineage['moves'],
            ];
            $effective = ClassSession::query()->whereKey($lineage['effectiveSessionId'])->first();
            if ($effective !== null) {
                $onRoster = false;
                foreach ($this->scheduling->roster($viewer, $effective->id) as $entry2) {
                    if (($entry2['studentId'] ?? null) === $record->student_id) {
                        $onRoster = true;
                        break;
                    }
                }
                $currentAttempt['studentOnRoster'] = $onRoster;
            }
        }

        $original = ClassSession::query()->whereKey($record->original_session_id)->first();
        $mark = AttendanceRecord::query()
            ->where('session_id', $record->original_session_id)
            ->where('student_id', $record->student_id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        $wire = [
            'id' => $record->id,
            'originalSessionId' => $record->original_session_id,
            'classId' => $record->class_id,
            'studentId' => $record->student_id,
            'reason' => $record->reason,
            'requiredAt' => $record->required_at?->toJSON(),
            'requiredByUserId' => $record->required_by_user_id,
            'attempts' => array_values(array_map(fn ($line): array => [
                'sessionId' => (string) ($line['sessionId'] ?? ''),
                'scheduledAt' => (string) ($line['scheduledAt'] ?? ''),
                'scheduledByUserId' => (string) ($line['scheduledByUserId'] ?? ''),
            ], $record->attempts ?? [])),
            'status' => $status,
            'attemptBroken' => $attempts !== [] && ($lineage === null || !$lineage['resolvable'] || in_array($lineage['effectiveStatus'], ['cancelled', 'missing'], true)),
            'originalMissing' => $original === null,
        ];
        if ($record->original_attendance_acknowledged_at !== null) {
            $wire['originalAttendanceAcknowledgedAt'] = $record->original_attendance_acknowledged_at->toJSON();
        }
        if ($record->completed_at !== null) {
            $wire['completedAt'] = $record->completed_at->toJSON();
            $wire['completedByUserId'] = $record->completed_by_user_id;
        }
        if ($currentAttempt !== null) {
            $wire['currentAttempt'] = $currentAttempt;
        }
        if ($mark !== null) {
            $wire['originalStudentAttendance'] = $mark->status;
        }
        $wire['createdAt'] = $record->created_at?->toJSON();
        $wire['updatedAt'] = $record->updated_at?->toJSON();

        return $wire;
    }
}
