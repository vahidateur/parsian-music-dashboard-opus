<?php

namespace App\Domain\Scheduling;

use App\Models\User;
use App\Support\Authorization\OwnerDecisionRequired;
use App\Support\Authorization\PermissionGate;

/**
 * Scheduling authorization: the permission gate plus the row scope.
 *
 * Permissions are `schedule.read` / `schedule.write` — both already exist in
 * the shipped 23-id vocabulary (`config/permissions.php`). Nothing is invented.
 *
 * Row scope is the T-02 extension the plan names:
 *   - role teacher WITH teacher_id → only sessions whose `teacher_id` is the
 *     actor's, enforced in SQL (`scopeQuery`).
 *   - role teacher WITHOUT teacher_id → PB-1, unresolved: 403
 *     OWNER_DECISION_REQUIRED_PB1. Neither empty nor org-wide — the same
 *     fail-closed rule `StudentAccessPolicy` applies to students.
 *   - every other role → the whole organization.
 */
final class SessionPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'schedule.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'schedule.write');
    }

    /** @return list<string>|null  null = organization-wide; a list = teacher scope */
    public function teacherScope(User $actor, string $teacherIdColumn = 'sessions.teacher_id'): ?string
    {
        if ($actor->role !== 'teacher') {
            return null;
        }
        $teacherId = trim((string) $actor->teacher_id);
        if ($teacherId === '') {
            throw new OwnerDecisionRequired(
                'PB-1',
                'Teacher account has no linked teacherId; session and attendance scope is owner decision PB-1.',
            );
        }

        return $teacherId;
    }
}
