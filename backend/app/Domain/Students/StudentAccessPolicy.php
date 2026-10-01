<?php

namespace App\Domain\Students;

use App\Models\Student;
use App\Models\User;
use App\Support\Authorization\OwnerDecisionRequired;
use App\Support\Authorization\PermissionGate;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Student access: permissions (students.read / students.write through the
 * single PermissionGate) plus the row scope.
 *
 * Row scope:
 * - role teacher WITH teacher_id → T-02 (GOVERNANCE_CHECKPOINT): only students
 *   with an ACTIVE enrollment in a class whose teacher_id is the actor's,
 *   enforced in SQL. students.teacher_id is NEVER consulted.
 * - role teacher WITHOUT teacher_id → PB-1, unresolved: 403
 *   OWNER_DECISION_REQUIRED_PB1 (neither empty result nor org-wide).
 * - every other role → the whole organization.
 */
final class StudentAccessPolicy
{
    public function __construct(
        private readonly PermissionGate $gate,
        private readonly TenantContext $tenant,
    ) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'students.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'students.write');
    }

    /**
     * Create: the actor's scope must be decidable first (a teacher without a
     * teacher_id is PB-1 whatever their permissions), then students.write.
     */
    public function authorizeCreate(User $actor): void
    {
        $this->resolveScope($actor);
        $this->authorizeWrite($actor);
    }

    public function resolveScope(User $actor): StudentScope
    {
        if ($actor->role !== 'teacher') {
            return StudentScope::org();
        }
        $teacherId = trim((string) $actor->teacher_id);
        if ($teacherId === '') {
            $this->teacherWithoutTeacherIdScope($actor);
        }

        return StudentScope::assigned($teacherId);
    }

    /**
     * PB-1 — UNRESOLVED owner decision. Fail-closed-empty vs org-wide is not
     * decided; do not replace this throw with either behavior.
     */
    public function teacherWithoutTeacherIdScope(User $actor): never
    {
        throw new OwnerDecisionRequired(
            'PB-1',
            'Teacher account has no linked teacherId; fail-closed vs org-wide is owner decision PB-1.',
        );
    }

    /**
     * Constrains a students query to the actor's scope, in SQL.
     *
     * @param  Builder<Student>  $query
     * @return Builder<Student>
     */
    public function scopeQuery(Builder $query, User $actor): Builder
    {
        $scope = $this->resolveScope($actor);
        if ($scope->isOrg()) {
            return $query;
        }

        $organizationId = $this->tenant->organizationId();
        $teacherId = $scope->teacherId;

        return $query->whereExists(function (QueryBuilder $sub) use ($organizationId, $teacherId): void {
            $sub->selectRaw('1')
                ->from('enrollments')
                ->join('classes', 'classes.id', '=', 'enrollments.class_id')
                ->whereColumn('enrollments.student_id', 'students.id')
                ->where('enrollments.status', 'active')
                ->where('classes.teacher_id', $teacherId)
                ->where('enrollments.organization_id', $organizationId)
                ->where('classes.organization_id', $organizationId);
        });
    }
}
