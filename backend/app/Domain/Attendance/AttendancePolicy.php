<?php

namespace App\Domain\Attendance;

use App\Models\User;
use App\Support\Authorization\OwnerDecisionRequired;
use App\Support\Authorization\PermissionGate;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;

/**
 * Attendance authorization: `attendance.read` / `attendance.write` — both
 * already in the shipped 23-id vocabulary — plus the row scope.
 *
 * The scope is the T-02 extension: a teacher sees attendance only for sessions
 * they teach, expressed as `sessions.teacher_id = actor.teacher_id` through the
 * record's session. A teacher with no `teacherId` is PB-1 and fails closed
 * (403 OWNER_DECISION_REQUIRED_PB1) rather than seeing an org-wide roster.
 */
final class AttendancePolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'attendance.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'attendance.write');
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function scope(Builder $query, User $actor, string $sessionColumn = 'attendance_records.session_id'): Builder
    {
        if ($actor->role !== 'teacher') {
            return $query;
        }

        $teacherId = trim((string) $actor->teacher_id);
        if ($teacherId === '') {
            throw new OwnerDecisionRequired(
                'PB-1',
                'Teacher account has no linked teacherId; attendance scope is owner decision PB-1.',
            );
        }

        return $query->whereIn($sessionColumn, function ($sub) use ($teacherId) {
            $sub->from('class_sessions')->select('id')
                ->where('organization_id', app(TenantContext::class)->organizationId())
                ->where('teacher_id', $teacherId);
        });
    }
}
