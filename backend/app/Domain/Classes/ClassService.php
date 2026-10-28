<?php

namespace App\Domain\Classes;

use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Classes of the caller's organization (tenant-scoped model queries).
 *
 * `enrolled`, `waitlist` and `studentIds` are never stored: every read
 * computes them from enrollment rows in SQL (withCount + one eager load).
 */
final class ClassService
{
    /** Wire key → column for the fields a write may carry. */
    private const FIELDS = [
        'title' => 'title',
        'instrument' => 'instrument',
        'teacherId' => 'teacher_id',
        'roomId' => 'room_id',
        'kind' => 'kind',
        'level' => 'level',
        'programId' => 'program_id',
        'levelId' => 'level_id',
        'days' => 'days',
        'time' => 'time',
        'duration' => 'duration',
        'capacity' => 'capacity',
        'tuition' => 'tuition',
        'attendanceAvg' => 'attendance_avg',
        'termProgress' => 'term_progress',
        'status' => 'status',
    ];

    private const SORTS = ['title' => 'title', 'enrolled' => 'enrolled_count', 'capacity' => 'capacity'];

    public function __construct(
        private readonly ClassPolicy $policy,
        private readonly TenantContext $tenant,
    ) {}

    /**
     * Adds the computed projection: enrolled_count (active), waitlist_count,
     * and the active enrollments (student ids) eager-loaded in one query.
     *
     * @param  Builder<AcademyClass>  $query
     * @return Builder<AcademyClass>
     */
    public static function withProjection(Builder $query): Builder
    {
        return $query
            ->withCount([
                'enrollments as enrolled_count' => fn (Builder $q) => $q->where('status', 'active'),
                'enrollments as waitlist_count' => fn (Builder $q) => $q->where('status', 'waitlist'),
            ])
            ->with(['enrollments' => fn ($q) => $q
                ->where('status', 'active')
                ->orderBy('created_at')
                ->orderBy('id')
                ->select(['id', 'organization_id', 'class_id', 'student_id', 'status'])]);
    }

    /**
     * @param  array<string, mixed>  $filters  validated query (search, instrument, teacher_id, room_id, status, sort, dir)
     * @return LengthAwarePaginator<int, AcademyClass>
     */
    public function list(User $actor, array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = self::withProjection(AcademyClass::query());
        if (($filters['search'] ?? '') !== '') {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('level', 'like', $like));
        }
        foreach (['instrument' => 'instrument', 'teacher_id' => 'teacher_id', 'room_id' => 'room_id'] as $param => $column) {
            if (($filters[$param] ?? '') !== '') {
                $query->where($column, $filters[$param]);
            }
        }
        // Archived classes are history: hidden unless a status is asked for.
        if (($filters['status'] ?? '') !== '') {
            $query->where('status', $filters['status']);
        } else {
            $query->where('status', '!=', 'archived');
        }
        $direction = ($filters['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        return $query
            ->orderBy(self::SORTS[$filters['sort'] ?? 'title'] ?? 'title', $direction)
            ->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(User $actor, string $id): AcademyClass
    {
        $this->policy->authorizeRead($actor);

        return $this->load($id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(User $actor, array $input): AcademyClass
    {
        $this->policy->authorizeWrite($actor);

        $class = new AcademyClass;
        $class->id = 'cl_'.strtolower((string) Str::ulid());
        $class->organization_id = $this->tenant->organizationId();
        $class->attendance_avg = 0;
        $class->term_progress = 0;
        $class->status = 'active';
        $this->fill($class, $input);
        $class->save();

        return $this->load($class->id);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(User $actor, string $id, array $input): AcademyClass
    {
        $this->policy->authorizeWrite($actor);

        DB::transaction(function () use ($id, $input): void {
            $class = $this->find($id, lock: true);
            if (array_key_exists('capacity', $input)) {
                $active = Enrollment::query()->where('class_id', $class->id)->where('status', 'active')->count();
                if ((int) $input['capacity'] < $active) {
                    throw ApiException::conflict(
                        'CLASS_CAPACITY_BELOW_ENROLLED',
                        "ظرفیت نمی‌تواند کمتر از {$active} هنرجوی ثبت‌نام‌شده باشد.",
                        ['capacity' => ['کمتر از ثبت‌نام فعلی']],
                    );
                }
            }
            $this->fill($class, $input);
            $class->save();
        });

        return $this->load($id);
    }

    /** Archived classes accept no new enrollment; existing rows are kept. */
    public function archive(User $actor, string $id): AcademyClass
    {
        $this->policy->authorizeWrite($actor);
        $class = $this->find($id);
        $class->status = 'archived';
        $class->save();

        return $this->load($id);
    }

    public function delete(User $actor, string $id): void
    {
        $this->policy->authorizeWrite($actor);

        DB::transaction(function () use ($id): void {
            $class = $this->find($id, lock: true);
            $rows = Enrollment::query()->where('class_id', $class->id)->count();
            if ($rows > 0) {
                throw ApiException::conflict(
                    'CLASS_HAS_ENROLLMENTS',
                    "این کلاس {$rows} ثبت‌نام دارد. به‌جای حذف، آن را بایگانی کنید.",
                );
            }
            $class->delete();
        });
    }

    /** Tenant-scoped lookup; another organization's id is a 404 too. */
    public function find(string $id, bool $lock = false): AcademyClass
    {
        $class = AcademyClass::query()->whereKey($id)->when($lock, fn (Builder $q) => $q->lockForUpdate())->first();
        if ($class === null) {
            throw self::notFound($id);
        }

        return $class;
    }

    private function load(string $id): AcademyClass
    {
        $class = self::withProjection(AcademyClass::query())->whereKey($id)->first();
        if ($class === null) {
            throw self::notFound($id);
        }

        return $class;
    }

    /** @param  array<string, mixed>  $input */
    private function fill(AcademyClass $class, array $input): void
    {
        foreach (self::FIELDS as $wire => $column) {
            if (! array_key_exists($wire, $input)) {
                continue;
            }
            $value = $input[$wire];
            $class->{$column} = match ($column) {
                'title', 'instrument', 'level', 'time' => trim((string) $value),
                'program_id', 'level_id' => ($value === null || trim((string) $value) === '') ? null : trim((string) $value),
                'days' => array_values(array_map('intval', (array) $value)),
                default => $value,
            };
        }
    }

    private static function notFound(string $id): ApiException
    {
        return ApiException::notFound('CLASS_NOT_FOUND', "کلاس با شناسهٔ {$id} یافت نشد.");
    }
}
