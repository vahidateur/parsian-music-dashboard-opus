<?php

namespace App\Domain\Teachers;

use App\Models\AcademyClass;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Teachers of the caller's organization (tenant-scoped model queries).
 *
 * A teacher that becomes inactive or is deleted closes the login accounts
 * linked to it (users.teacher_id) and revokes their tokens, in the same
 * transaction. Re-activating a teacher does not re-open accounts.
 */
final class TeacherService
{
    /** Wire key → column for the fields a write may carry. */
    private const FIELDS = [
        'name' => 'name',
        'photoMediaId' => 'photo_media_id',
        'instrument' => 'instrument',
        'title' => 'title',
        'students' => 'students',
        'utilization' => 'utilization',
        'weeklyHours' => 'weekly_hours',
        'contractHours' => 'contract_hours',
        'attendanceRate' => 'attendance_rate',
        'retention' => 'retention',
        'todayClasses' => 'today_classes',
        'availability' => 'availability',
        'since' => 'since',
        'phone' => 'phone',
        'status' => 'status',
        'bio' => 'bio',
    ];

    private const SORTS = ['name' => 'name', 'utilization' => 'utilization', 'students' => 'students'];

    public function __construct(
        private readonly TeacherPolicy $policy,
        private readonly TenantContext $tenant,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  validated query (search, instrument, status, assignable, sort, dir)
     * @return LengthAwarePaginator<int, Teacher>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = Teacher::query();
        if (($filters['search'] ?? '') !== '') {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q
                ->where('name', 'like', $like)
                ->orWhere('phone', 'like', $like)
                ->orWhere('title', 'like', $like));
        }
        if (($filters['instrument'] ?? '') !== '') {
            $query->where('instrument', $filters['instrument']);
        }
        if (($filters['status'] ?? '') !== '') {
            $query->where('status', $filters['status']);
        }
        if (filter_var($filters['assignable'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('status', '!=', 'inactive');
        }
        $direction = ($filters['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        return $query
            ->orderBy(self::SORTS[$filters['sort'] ?? 'name'] ?? 'name', $direction)
            ->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): Teacher
    {
        $this->policy->authorizeRead($actor);

        return $this->find($id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(User $actor, array $input): Teacher
    {
        $this->policy->authorizeWrite($actor);
        $this->assertPhoneFree((string) $input['phone'], null);

        $teacher = new Teacher;
        $teacher->id = 't_'.strtolower((string) Str::ulid());
        $teacher->organization_id = $this->tenant->organizationId();
        $teacher->today_classes = [];
        $teacher->availability = [];
        $teacher->bio = '';
        $this->fill($teacher, $input);

        return $this->save($teacher);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(User $actor, string $id, array $input): Teacher
    {
        $this->policy->authorizeWrite($actor);
        $teacher = $this->find($id);
        if (array_key_exists('phone', $input)) {
            $this->assertPhoneFree((string) $input['phone'], $teacher->id);
        }
        $this->fill($teacher, $input);

        return DB::transaction(function () use ($teacher): Teacher {
            $saved = $this->save($teacher);
            if ($saved->status === 'inactive') {
                $this->disableLinkedAccounts($saved->id);
            }

            return $saved;
        });
    }

    /** Soft-deactivate; classes keep referencing the teacher on purpose. */
    public function deactivate(User $actor, string $id): Teacher
    {
        $this->policy->authorizeWrite($actor);
        $teacher = $this->find($id);

        return DB::transaction(function () use ($teacher): Teacher {
            $teacher->status = 'inactive';
            $saved = $this->save($teacher);
            $this->disableLinkedAccounts($saved->id);

            return $saved;
        });
    }

    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);
        $teacher = $this->find($id);

        $assigned = AcademyClass::query()->where('teacher_id', $teacher->id)->count();
        if ($assigned > 0) {
            throw ApiException::conflict(
                'TEACHER_HAS_CLASSES',
                "این مدرس به {$assigned} کلاس اختصاص دارد. ابتدا کلاس‌ها را واگذار کنید یا مدرس را غیرفعال کنید.",
            );
        }

        DB::transaction(function () use ($teacher): void {
            $teacher->delete();
            $this->disableLinkedAccounts($teacher->id);
        });
    }

    /** Login accounts linked to the teacher are disabled and signed out. */
    private function disableLinkedAccounts(string $teacherId): void
    {
        $accounts = User::query()
            ->where('organization_id', $this->tenant->organizationId())
            ->where('teacher_id', $teacherId)
            ->get();
        foreach ($accounts as $account) {
            if ($account->status !== 'disabled') {
                $account->status = 'disabled';
                $account->save();
            }
            $account->tokens()->delete();
        }
    }

    /** @param  array<string, mixed>  $input */
    private function fill(Teacher $teacher, array $input): void
    {
        foreach (self::FIELDS as $wire => $column) {
            if (! array_key_exists($wire, $input)) {
                continue;
            }
            $value = $input[$wire];
            $teacher->{$column} = match ($column) {
                'name', 'phone', 'title', 'since', 'instrument' => trim((string) $value),
                'bio' => (string) ($value ?? ''),
                'photo_media_id' => ($value === null || $value === '') ? null : (string) $value,
                'today_classes', 'availability' => array_values((array) ($value ?? [])),
                default => $value,
            };
        }
    }

    /** @return Teacher */
    private function find(string $id): Teacher
    {
        $teacher = Teacher::query()->whereKey($id)->first();
        if ($teacher === null) {
            throw ApiException::notFound('TEACHER_NOT_FOUND', "مدرس با شناسهٔ {$id} یافت نشد.");
        }

        return $teacher;
    }

    private function assertPhoneFree(string $phone, ?string $exceptId): void
    {
        $taken = Teacher::query()
            ->where('phone', trim($phone))
            ->when($exceptId !== null, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($taken) {
            throw self::phoneTaken();
        }
    }

    private function save(Teacher $teacher): Teacher
    {
        try {
            $teacher->save();
        } catch (UniqueConstraintViolationException) {
            throw self::phoneTaken();
        }

        return $teacher->refresh();
    }

    private static function phoneTaken(): ApiException
    {
        return ApiException::conflict(
            'TEACHER_PHONE_TAKEN',
            'مدرس دیگری با این شمارهٔ تماس ثبت شده است.',
            ['phone' => ['تکراری است']],
        );
    }
}
