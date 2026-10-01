<?php

namespace App\Domain\Scheduling;

use App\Models\AcademyClass;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Sessions of the caller's organization.
 *
 * Every read and write is authorized in the domain policy and scoped by the
 * tenant-scoped model. A teacher's rows are limited by the T-02 extension
 * (`sessions.teacher_id = actor.teacher_id`); a teacher with no `teacherId` is
 * PB-1 and fails closed rather than seeing nothing or everything.
 */
final class SessionService
{
    /** Wire key → column for the fields a write may carry. */
    private const FIELDS = [
        'date' => 'date',
        'startTime' => 'start_time',
        'endTime' => 'end_time',
        'teacherId' => 'teacher_id',
        'roomId' => 'room_id',
        'notes' => 'notes',
    ];

    public function __construct(
        private readonly SessionPolicy $policy,
        private readonly ConflictDetector $conflicts,
        private readonly TenantContext $tenant,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  validated query (class_id, teacher_id, room_id, status, from, to, active_only)
     * @return LengthAwarePaginator<int, ClassSession>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = ClassSession::query();
        $this->scope($query, $actor);

        foreach (['class_id' => 'class_id', 'teacher_id' => 'teacher_id', 'room_id' => 'room_id', 'status' => 'status'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }
        if (($filters['from'] ?? '') !== '') {
            $query->where('date', '>=', (string) $filters['from']);
        }
        if (($filters['to'] ?? '') !== '') {
            $query->where('date', '<=', (string) $filters['to']);
        }
        if (filter_var($filters['active_only'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('status', '!=', 'cancelled');
        }

        return $query->orderBy('date')->orderBy('start_time')->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): ClassSession
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id, $actor);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(User $actor, array $input): ClassSession
    {
        $this->policy->authorizeWrite($actor);

        $class = $this->requireClass((string) $input['classId']);

        return DB::transaction(function () use ($class, $input): ClassSession {
            $candidate = [
                'classId' => $class->id,
                'date' => (string) $input['date'],
                'startTime' => (string) $input['startTime'],
                'endTime' => (string) $input['endTime'],
                'teacherId' => (string) ($input['teacherId'] ?? $class->teacher_id),
                'roomId' => (string) ($input['roomId'] ?? $class->room_id),
            ];

            // Rechecked inside the transaction: a client-side check cannot stop
            // two operators booking the same room at the same moment.
            $report = $this->conflicts->check($candidate);
            $this->assertNoHardConflicts($report);
            $this->assertWarningsAcknowledged($report, $input);

            $session = new ClassSession;
            $session->id = 'ses_'.strtolower((string) Str::ulid());
            $session->class_id = $class->id;
            $session->date = $candidate['date'];
            $session->start_time = $candidate['startTime'];
            $session->end_time = $candidate['endTime'];
            $session->teacher_id = $candidate['teacherId'];
            $session->room_id = $candidate['roomId'];
            $session->status = (string) ($input['status'] ?? 'scheduled');
            $session->origin = 'manual';
            $session->notes = isset($input['notes']) ? (string) $input['notes'] : null;
            $session->save();

            return $session->refresh();
        });
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(User $actor, string $id, array $input): ClassSession
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $input): ClassSession {
            $session = $this->find($id, $actor, lock: true);

            $candidate = [
                'id' => $session->id,
                'classId' => $session->class_id,
                'date' => (string) ($input['date'] ?? $session->date),
                'startTime' => (string) ($input['startTime'] ?? $session->start_time),
                'endTime' => (string) ($input['endTime'] ?? $session->end_time),
                'teacherId' => (string) ($input['teacherId'] ?? $session->teacher_id),
                'roomId' => (string) ($input['roomId'] ?? $session->room_id),
            ];

            $report = $this->conflicts->check($candidate);
            $this->assertNoHardConflicts($report);
            $this->assertWarningsAcknowledged($report, $input);

            foreach (self::FIELDS as $wire => $column) {
                if (array_key_exists($wire, $input)) {
                    $session->{$column} = $input[$wire];
                }
            }
            $session->save();

            return $session->refresh();
        });
    }

    /**
     * Cancel with a reason, atomically. A verb, not a status patch: the reason
     * travels with the transition instead of arriving as a separate write.
     */
    public function cancel(User $actor, string $id, string $reason): ClassSession
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $reason): ClassSession {
            $session = $this->find($id, $actor, lock: true);
            if ($session->status === 'cancelled') {
                throw ApiException::conflict('SESSION_ALREADY_CANCELLED', 'این جلسه از قبل لغو شده است.');
            }
            if ($reason === '') {
                throw ApiException::validation(
                    'SESSION_CANCEL_REASON_REQUIRED',
                    'دلیل لغو باید نوشته شود.',
                    ['reason' => ['الزامی']],
                );
            }
            $session->status = 'cancelled';
            $session->cancel_reason = $reason;
            $session->save();

            return $session->refresh();
        });
    }

    /**
     * Reschedule: the original is cancelled and linked forward, and a NEW
     * session is created and linked back. The original is never edited, so the
     * history of what was planned survives the move.
     *
     * @param  array<string, mixed>  $input  validated RescheduleInput
     */
    public function reschedule(User $actor, string $id, array $input): ClassSession
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $input): ClassSession {
            $original = $this->find($id, $actor, lock: true);
            if ($original->status === 'cancelled') {
                throw ApiException::conflict('SESSION_ALREADY_CANCELLED', 'جلسهٔ لغو‌شده را نمی‌توان جابه‌جا کرد.');
            }

            $candidate = [
                'classId' => $original->class_id,
                'date' => (string) $input['date'],
                'startTime' => (string) $input['startTime'],
                'endTime' => (string) $input['endTime'],
                'teacherId' => (string) ($input['teacherId'] ?? $original->teacher_id),
                'roomId' => (string) ($input['roomId'] ?? $original->room_id),
            ];

            $report = $this->conflicts->check($candidate);
            $this->assertNoHardConflicts($report);
            $this->assertWarningsAcknowledged($report, $input);

            $moved = new ClassSession;
            $moved->id = 'ses_'.strtolower((string) Str::ulid());
            $moved->class_id = $original->class_id;
            $moved->date = $candidate['date'];
            $moved->start_time = $candidate['startTime'];
            $moved->end_time = $candidate['endTime'];
            $moved->teacher_id = $candidate['teacherId'];
            $moved->room_id = $candidate['roomId'];
            $moved->status = 'scheduled';
            $moved->origin = 'manual';
            $moved->rescheduled_from_id = $original->id;
            $moved->save();

            $original->status = 'cancelled';
            $original->cancel_reason = (string) $input['reason'];
            $original->rescheduled_to_id = $moved->id;
            $original->save();

            return $moved->refresh();
        });
    }

    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);

        DB::transaction(function () use ($actor, $id): void {
            $session = $this->find($id, $actor, lock: true);
            $records = DB::table('attendance_records')->where('session_id', $session->id)->count();
            if ($records > 0) {
                throw ApiException::conflict(
                    'SESSION_HAS_ATTENDANCE',
                    "برای این جلسه {$records} ردیف حضور و غیاب ثبت شده است. به‌جای حذف، آن را لغو کنید.",
                );
            }
            $session->delete();
        });
    }

    /**
     * The roster is DERIVED from active enrollments, never stored: a student who
     * joins in week 6 must not appear on week 2, and one who withdraws in week 8
     * must still appear on weeks 1–7.
     *
     * @return list<array{studentId: string, studentName: string, photoMediaId?: string}>
     */
    public function roster(User $actor, string $id): array
    {
        $this->policy->authorizeRead($actor);
        $session = $this->find($id, $actor);

        $studentIds = Enrollment::query()
            ->where('class_id', $session->class_id)
            ->where('status', 'active')
            ->orderBy('created_at')
            ->pluck('student_id')
            ->all();

        if ($studentIds === []) {
            return [];
        }

        $students = Student::query()->whereIn('id', $studentIds)->get()->keyBy('id');

        $roster = [];
        foreach ($studentIds as $studentId) {
            $student = $students->get($studentId);
            if ($student === null) {
                continue;
            }
            $entry = ['studentId' => $student->id, 'studentName' => (string) $student->name];
            $photo = is_array($student->deferred) ? ($student->deferred['photoMediaId'] ?? null) : null;
            if (is_string($photo) && $photo !== '') {
                $entry['photoMediaId'] = $photo;
            }
            $roster[] = $entry;
        }

        return $roster;
    }

    /** @param  array<string, mixed>  $candidate */
    public function checkConflicts(User $actor, array $candidate): ConflictReport
    {
        $this->policy->authorizeRead($actor);
        $this->requireClass((string) $candidate['classId']);

        return $this->conflicts->check($candidate);
    }

    /** Tenant-scoped, policy-scoped lookup; out of scope is a 404 too. */
    public function find(string $id, User $actor, bool $lock = false): ClassSession
    {
        $query = ClassSession::query()->whereKey($id);
        $this->scope($query, $actor);
        if ($lock) {
            $query->lockForUpdate();
        }
        $session = $query->first();
        if ($session === null) {
            throw ApiException::notFound('SESSION_NOT_FOUND', "جلسه با شناسهٔ {$id} یافت نشد.");
        }

        return $session;
    }

    /**
     * @param  Builder<ClassSession>  $query
     * @return Builder<ClassSession>
     */
    private function scope(Builder $query, User $actor): Builder
    {
        $teacherId = $this->policy->teacherScope($actor);
        if ($teacherId === null) {
            return $query;
        }

        return $query->where('class_sessions.teacher_id', $teacherId);
    }

    private function requireClass(string $classId): AcademyClass
    {
        $class = AcademyClass::query()->whereKey($classId)->first();
        if ($class === null) {
            throw ApiException::validation(
                'SESSION_CLASS_NOT_FOUND',
                'کلاس انتخاب‌شده یافت نشد.',
                ['classId' => ['یافت نشد']],
            );
        }

        return $class;
    }

    private function assertNoHardConflicts(ConflictReport $report): void
    {
        if (! $report->ok()) {
            throw new ApiException(
                409,
                'SESSION_CONFLICT',
                'این جلسه با برنامهٔ موجود تداخل دارد.',
                [],
                ['conflicts' => $report->toWire()],
            );
        }
    }

    /** @param  array<string, mixed>  $input */
    private function assertWarningsAcknowledged(ConflictReport $report, array $input): void
    {
        if (! $report->needsAcknowledgement()) {
            return;
        }
        if (filter_var($input['acknowledgeWarnings'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return;
        }
        throw new ApiException(
            409,
            'SESSION_WARNINGS_UNACKNOWLEDGED',
            'برای ادامه باید هشدارها را تأیید کنید.',
            [],
            ['conflicts' => $report->toWire()],
        );
    }
}
