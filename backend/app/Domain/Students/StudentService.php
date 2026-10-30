<?php

namespace App\Domain\Students;

use App\Domain\Media\MediaReferenceLock;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\NationalId;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Students of the caller's organization.
 *
 * Every read, update and delete goes through StudentAccessPolicy::scopeQuery,
 * so a student outside the actor's scope is indistinguishable from a missing
 * one (404 STUDENT_NOT_FOUND).
 */
final class StudentService
{
    /** Wire key → column of the first-class fields. */
    private const COLUMNS = [
        'name' => 'name',
        'instrument' => 'instrument',
        'teacherId' => 'teacher_id',
        'level' => 'level',
        'levelStep' => 'level_step',
        'status' => 'status',
        'payment' => 'payment',
        'age' => 'age',
        'phone' => 'phone',
        'guardian' => 'guardian',
        'since' => 'since',
    ];

    /**
     * Wire fields owned by domains that do not exist server-side yet (media,
     * finance, scheduling, progress). Stored verbatim in `students.deferred`,
     * type-validated only, never derived, never authoritative.
     */
    public const DEFERRED_DEFAULTS = [
        'sessionsUsed' => 0,
        'sessionsTotal' => 0,
        'attendance' => 0,
        'progress' => 0,
        'lastSeen' => '',
        'balance' => 0,
        'notes' => [],
        'activity' => [],
        'skills' => [],
    ];

    /** Deferred fields that are omitted from the wire when absent. */
    public const DEFERRED_OPTIONAL = ['photoMediaId', 'nextClass'];

    /** `sort` value → order column. */
    private const SORTS = [
        'name' => 'name',
        'since' => 'since',
        'progress' => 'deferred->progress',
        'attendance' => 'deferred->attendance',
        'balance' => 'deferred->balance',
    ];

    public function __construct(
        private readonly StudentAccessPolicy $policy,
        private readonly TenantContext $tenant,
        private readonly MediaReferenceLock $mediaReferenceLock,
    ) {}

    /** @return list<string> */
    public static function sorts(): array
    {
        return array_keys(self::SORTS);
    }

    /**
     * @param  array<string, mixed>  $filters  validated query (search, status, instrument, payment, teacher_id, sort)
     * @return LengthAwarePaginator<int, Student>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);
        $query = $this->policy->scopeQuery(Student::query(), $actor);

        if (($filters['search'] ?? '') !== '') {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q
                ->where('name', 'like', $like)
                ->orWhere('phone', 'like', $like)
                ->orWhere('national_id', 'like', $like)
                ->orWhere('level', 'like', $like)
                ->orWhere('guardian', 'like', $like));
        }
        foreach (['status' => 'status', 'instrument' => 'instrument', 'payment' => 'payment'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }
        // Display filter on the denormalized field, applied AFTER the scope.
        if (($filters['teacher_id'] ?? '') !== '') {
            $query->where('teacher_id', $filters['teacher_id']);
        }

        $sort = $filters['sort'] ?? null;
        if (is_string($sort) && isset(self::SORTS[$sort])) {
            $query->orderBy(self::SORTS[$sort]);
        } else {
            $query->orderBy('created_at');
        }

        return $query->orderBy('id')->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): Student
    {
        $this->policy->authorizeRead($actor);

        return $this->find($actor, $id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(User $actor, array $input): Student
    {
        $this->policy->authorizeCreate($actor);

        $nationalId = NationalId::normalize((string) $input['nationalId']);
        $this->assertNationalIdFree($nationalId, null);

        $student = new Student;
        $student->id = 'st_'.strtolower((string) Str::ulid());
        $student->organization_id = $this->tenant->organizationId();
        $student->national_id = $nationalId;
        $student->deferred = self::DEFERRED_DEFAULTS;
        $this->fill($student, $input);

        return $this->save($student);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(User $actor, string $id, array $input): Student
    {
        $this->policy->authorizeWrite($actor);
        $student = $this->find($actor, $id);

        if (array_key_exists('nationalId', $input)) {
            $nationalId = NationalId::normalize((string) $input['nationalId']);
            $this->assertNationalIdFree($nationalId, $student->id);
            $student->national_id = $nationalId;
        }
        $this->fill($student, $input);

        return $this->save($student);
    }

    /** Deletes the student and its enrollments together. */
    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);
        $student = $this->find($actor, $id);

        DB::transaction(function () use ($student): void {
            Enrollment::query()->where('student_id', $student->id)->delete();
            $student->delete();
        });
    }

    private function find(User $actor, string $id): Student
    {
        $student = $this->policy->scopeQuery(Student::query(), $actor)->whereKey($id)->first();
        if ($student === null) {
            throw ApiException::notFound('STUDENT_NOT_FOUND', "هنرجو با شناسهٔ {$id} یافت نشد.");
        }

        return $student;
    }

    /** @param  array<string, mixed>  $input */
    private function fill(Student $student, array $input): void
    {
        foreach (self::COLUMNS as $wire => $column) {
            if (! array_key_exists($wire, $input)) {
                continue;
            }
            $value = $input[$wire];
            $student->{$column} = match ($column) {
                'teacher_id', 'guardian' => ($value === null || trim((string) $value) === '') ? null : trim((string) $value),
                'level_step', 'age' => (int) $value,
                default => trim((string) $value),
            };
        }

        $deferred = $student->deferred ?? [];
        foreach ([...array_keys(self::DEFERRED_DEFAULTS), ...self::DEFERRED_OPTIONAL] as $key) {
            if (! array_key_exists($key, $input)) {
                continue;
            }
            if (($input[$key] === null || $input[$key] === '') && in_array($key, self::DEFERRED_OPTIONAL, true)) {
                unset($deferred[$key]);

                continue;
            }
            $deferred[$key] = $input[$key];
        }
        $student->deferred = $deferred;
    }

    private function assertNationalIdFree(string $nationalId, ?string $exceptId): void
    {
        // Per organization (tenant-scoped model), across ALL students of the
        // org — not only those in the actor's row scope.
        $taken = Student::query()
            ->where('national_id', $nationalId)
            ->when($exceptId !== null, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($taken) {
            throw self::nationalIdTaken();
        }
    }

    private function save(Student $student): Student
    {
        return DB::transaction(function () use ($student): Student {
            $deferred = is_array($student->deferred) ? $student->deferred : [];
            $currentPhotoId = $deferred['photoMediaId'] ?? null;
            if (
                is_string($currentPhotoId)
                && $currentPhotoId !== ''
                && $student->isDirty('deferred')
                && ! $this->mediaReferenceLock->lockAvailable($currentPhotoId)
            ) {
                throw ApiException::validation('STUDENT_INVALID', 'عکس انتخاب‌شده یافت نشد.', [
                    'photoMediaId' => ['نامعتبر است'],
                ]);
            }

            try {
                $student->save();
            } catch (UniqueConstraintViolationException) {
                throw self::nationalIdTaken();
            }

            return $student->refresh();
        });
    }

    private static function nationalIdTaken(): ApiException
    {
        return ApiException::conflict(
            'STUDENT_NATIONAL_ID_TAKEN',
            'هنرجوی دیگری با این کد ملی ثبت شده است.',
            ['nationalId' => ['تکراری است']],
        );
    }
}
