<?php

namespace App\Domain\Enrollments;

use App\Domain\Classes\ClassPolicy;
use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\User;
use App\Support\Api\ApiException;
use Illuminate\Database\Eloquent\Builder;

/**
 * Enrollment authorization = classes.read / classes.write (PHASE_B gap matrix
 * row M), plus the approved T-02-C (C1) row scope.
 *
 * Reads: a teacher sees only ACTIVE enrollments whose class is owned by the
 * actor's linked teacher id. Every other role keeps the organization-wide read.
 * Writes: enrollment is an administrative act; a teacher is refused even if a
 * role override grants classes.write, because enrollment is the edge that
 * creates student scope and must not be self-granted.
 */
final class EnrollmentPolicy
{
    public function __construct(private readonly ClassPolicy $classes) {}

    public function authorizeRead(User $actor): void
    {
        $this->classes->authorizeRead($actor);
    }

    public function authorizeWrite(User $actor): void
    {
        $this->classes->authorizeWrite($actor);

        if ($actor->role === 'teacher') {
            throw new ApiException(403, 'FORBIDDEN', 'ثبت‌نام و تغییر آن برای نقش مدرس مجاز نیست.');
        }
    }

    /**
     * @param  Builder<Enrollment>  $query
     * @return Builder<Enrollment>
     */
    public function scopeQuery(Builder $query, User $actor, string $classColumn = 'enrollments.class_id'): Builder
    {
        if ($actor->role !== 'teacher') {
            return $query;
        }

        $classIds = $this->classes->scopeQuery(AcademyClass::query(), $actor)->select('classes.id');

        return $query
            ->whereIn($classColumn, $classIds)
            ->where('enrollments.status', 'active');
    }
}
