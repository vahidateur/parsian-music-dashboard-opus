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
 *   - role teacher WITHOUT teacher_id → 403 OWNER_DECISION_REQUIRED_PB1.
 *     PB-1 is RESOLVED (2026-10-02, option A): fail-closed is the chosen policy, not a placeholder. Neither empty nor org-wide — the same
 *     fail-closed rule `StudentAccessPolicy` applies to students.
 *
 * Every session endpoint calls `teacherScope()`/`assertTeacherLinked()`, so the
 * refusal cannot be bypassed by reaching a verb that does not select rows.
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

    /**
     * PB-1 (resolved 2026-10-02, option A) — refuse a teacher account with no
     * linked teacherId. Retained deliberately: fail-closed was the behaviour
     * before the decision and is the behaviour the owner chose.
     */
    public function assertTeacherLinked(User $actor): void
    {
        $this->teacherScope($actor);
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
