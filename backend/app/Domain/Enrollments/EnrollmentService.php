<?php

namespace App\Domain\Enrollments;

use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;

/**
 * Enrollments of the caller's organization — the authoritative Student ↔
 * Class edge.
 *
 * Invariants are enforced server-side inside one transaction per write, with
 * the class row locked (lockForUpdate) so concurrent writers serialize on the
 * class:
 *  - student and class exist in the organization (422 ENROLLMENT_INVALID)
 *  - the class is not archived (409 CLASS_ARCHIVED)
 *  - at most one open (active|waitlist) enrollment per student and class
 *    (409 ENROLLMENT_DUPLICATE; also backed by the partial unique index
 *    enrollments_open_unique on sqlite/pgsql)
 *  - active enrollments never exceed capacity (409 CLASS_FULL); waitlist does
 *    not occupy a seat.
 */
final class EnrollmentService
{
    private const OPEN_STATUSES = ['active', 'waitlist'];

    public function __construct(
        private readonly EnrollmentPolicy $policy,
        private readonly TenantContext $tenant,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  validated query (student_id, class_id, status, active)
     * @return LengthAwarePaginator<int, Enrollment>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = $this->policy->scopeQuery(Enrollment::query(), $actor);
        foreach (['student_id' => 'student_id', 'class_id' => 'class_id', 'status' => 'status'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }
        if (filter_var($filters['active'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('status', 'active');
        }

        /*
            I16 — an enrollment row carries ids only, so a text query has to look
            through the records it points at: the student's name and the class
            title, the two things a membership row is read by. Both related
            models are org-scoped by `BelongsToOrganization`, so `whereHas`
            inherits the tenant constraint and cannot match another academy's
            records. A blank query is no query.
        */
        $term = trim((string) ($filters['search'] ?? ''));
        if ($term !== '') {
            $like = '%'.$term.'%';
            $query->where(function (Builder $inner) use ($like): void {
                $inner->whereHas('student', fn (Builder $student): Builder => $student->where('name', 'like', $like))
                    ->orWhereHas('academyClass', fn (Builder $class): Builder => $class->where('title', 'like', $like));
            });
        }

        return $query->orderBy('created_at')->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): Enrollment
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id, $actor);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function enroll(User $actor, array $input): Enrollment
    {
        $this->policy->authorizeWrite($actor);
        $status = (string) ($input['status'] ?? 'active');

        return $this->guardDuplicate(fn (): Enrollment => DB::transaction(function () use ($input, $status): Enrollment {
            // Lock the class BEFORE the first consistent read. On MySQL/InnoDB
            // REPEATABLE READ an earlier plain SELECT fixes the transaction
            // snapshot; the duplicate/seat guards below would then reuse a
            // stale view and miss a competitor committed under this lock.
            $class = AcademyClass::query()->whereKey($input['classId'])->lockForUpdate()->first();
            $studentExists = Student::query()->whereKey($input['studentId'])->exists();

            $fields = [];
            if (! $studentExists) {
                $fields['studentId'] = ['هنرجو یافت نشد.'];
            }
            if ($class === null) {
                $fields['classId'] = ['کلاس یافت نشد.'];
            }
            if ($fields !== []) {
                throw ApiException::validation('ENROLLMENT_INVALID', 'اطلاعات ثبت‌نام معتبر نیست.', $fields);
            }
            if ($class->status === 'archived') {
                throw ApiException::conflict(
                    'CLASS_ARCHIVED',
                    'این کلاس بایگانی شده و ثبت‌نام جدید نمی‌پذیرد.',
                    ['classId' => ['بایگانی‌شده']],
                );
            }
            $this->assertNoOpenEnrollment((string) $input['studentId'], $class->id, null);
            if ($status === 'active') {
                $this->assertSeatFree($class, 'classId');
            }

            $enrollment = new Enrollment;
            $enrollment->id = 'enr_'.strtolower((string) Str::ulid());
            $enrollment->organization_id = $this->tenant->organizationId();
            $enrollment->student_id = (string) $input['studentId'];
            $enrollment->class_id = $class->id;
            $enrollment->status = $status;
            $startDate = trim((string) ($input['startDate'] ?? ''));
            $enrollment->start_date = $startDate !== '' ? $startDate : self::today();
            $enrollment->end_date = null;
            $enrollment->pricing_label = (string) ($input['pricingPlan']['label'] ?? $class->level);
            $enrollment->pricing_amount = (int) ($input['pricingPlan']['amount'] ?? $class->tuition);
            $enrollment->save();

            return $enrollment->refresh();
        }));
    }

    /** @param  array<string, mixed>  $input  validated wire input (status, endDate, pricingPlan) */
    public function update(User $actor, string $id, array $input): Enrollment
    {
        $this->policy->authorizeWrite($actor);

        return $this->guardDuplicate(fn (): Enrollment => DB::transaction(function () use ($id, $input, $actor): Enrollment {
            // A locking read does not establish a REPEATABLE READ snapshot, so
            // the duplicate/seat guards below see current rows.
            $enrollment = $this->find($id, $actor, lock: true);
            $class = AcademyClass::query()->whereKey($enrollment->class_id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('status', $input)) {
                $next = (string) $input['status'];
                $wasOpen = in_array($enrollment->status, self::OPEN_STATUSES, true);
                if (! $wasOpen && in_array($next, self::OPEN_STATUSES, true)) {
                    $this->assertNoOpenEnrollment($enrollment->student_id, $class->id, $enrollment->id);
                }
                // Promotion (e.g. waitlist → active) must respect capacity.
                if ($next === 'active' && $enrollment->status !== 'active') {
                    $this->assertSeatFree($class, 'status');
                }
                $enrollment->status = $next;
            }
            if (array_key_exists('endDate', $input)) {
                $endDate = trim((string) ($input['endDate'] ?? ''));
                $enrollment->end_date = $endDate === '' ? null : $endDate;
            }
            if (array_key_exists('pricingPlan', $input)) {
                $enrollment->pricing_label = (string) $input['pricingPlan']['label'];
                $enrollment->pricing_amount = (int) $input['pricingPlan']['amount'];
            }
            $enrollment->save();

            return $enrollment->refresh();
        }));
    }

    /** Withdraw = status cancelled, endDate today (ISO date); the row is kept. */
    public function withdraw(User $actor, string $id): Enrollment
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($id, $actor): Enrollment {
            $enrollment = $this->find($id, $actor);
            $enrollment->status = 'cancelled';
            $enrollment->end_date = self::today();
            $enrollment->save();

            return $enrollment->refresh();
        });
    }

    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);
        $this->find($id, $actor)->delete();
    }

    private function find(string $id, User $actor, bool $lock = false): Enrollment
    {
        $enrollment = $this->policy->scopeQuery(Enrollment::query(), $actor)
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->whereKey($id)
            ->first();
        if ($enrollment === null) {
            throw ApiException::notFound('ENROLLMENT_NOT_FOUND', "ثبت‌نام با شناسهٔ {$id} یافت نشد.");
        }

        return $enrollment;
    }

    private function assertNoOpenEnrollment(string $studentId, string $classId, ?string $exceptId): void
    {
        $open = Enrollment::query()
            ->where('student_id', $studentId)
            ->where('class_id', $classId)
            ->whereIn('status', self::OPEN_STATUSES)
            ->when($exceptId !== null, fn ($q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($open) {
            throw self::duplicate();
        }
    }

    private function assertSeatFree(AcademyClass $class, string $field): void
    {
        $seats = Enrollment::query()->where('class_id', $class->id)->where('status', 'active')->count();
        if ($seats >= $class->capacity) {
            throw ApiException::conflict(
                'CLASS_FULL',
                "ظرفیت کلاس تکمیل است ({$class->capacity}). می‌توانید هنرجو را در لیست انتظار قرار دهید.",
                [$field => ['ظرفیت تکمیل']],
            );
        }
    }

    /**
     * On sqlite/pgsql a writer that slipped past the in-transaction check hits
     * the partial unique index. MySQL has no such index: there the class row
     * lock (taken before the first consistent read) is the only guard, so all
     * writers must go through this service. Report either conflict the same way.
     *
     * @param  callable(): Enrollment  $write
     */
    private function guardDuplicate(callable $write): Enrollment
    {
        try {
            return $write();
        } catch (UniqueConstraintViolationException) {
            throw self::duplicate();
        }
    }

    private static function duplicate(): ApiException
    {
        return ApiException::conflict('ENROLLMENT_DUPLICATE', 'این هنرجو از قبل در این کلاس ثبت‌نام باز دارد.');
    }

    private static function today(): string
    {
        return now()->toDateString();
    }
}
