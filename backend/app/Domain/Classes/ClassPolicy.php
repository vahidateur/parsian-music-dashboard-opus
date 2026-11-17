<?php

namespace App\Domain\Classes;

use App\Models\AcademyClass;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Authorization\OwnerDecisionRequired;
use App\Support\Authorization\PermissionGate;
use Illuminate\Database\Eloquent\Builder;

/**
 * classes.read / classes.write, through the single PermissionGate, plus the
 * approved T-02-B (B2) row scope:
 *
 * - role teacher WITH teacher_id → only classes whose `classes.teacher_id` is
 *   the actor's linked teacher id, enforced in SQL and on object reads/writes.
 * - role teacher WITHOUT teacher_id → 403 OWNER_DECISION_REQUIRED_PB1.
 * - every other role → the whole organization.
 *
 * A permission override can widen the verb (for example grant classes.write to
 * a teacher), but it cannot widen the object scope: every write re-checks the
 * class owner.
 */
final class ClassPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->teacherIdOrFail($actor);
        $this->gate->authorize($actor, 'classes.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->teacherIdOrFail($actor);
        $this->gate->authorize($actor, 'classes.write');
    }

    /** @return string|null null = organization-wide; a string = teacher scope */
    public function teacherIdOrFail(User $actor): ?string
    {
        if ($actor->role !== 'teacher') {
            return null;
        }

        $teacherId = trim((string) $actor->teacher_id);
        if ($teacherId === '') {
            throw new OwnerDecisionRequired(
                'PB-1',
                'Teacher account has no linked teacherId; class/enrollment scope is PB-1 fail-closed.',
            );
        }

        return $teacherId;
    }

    /**
     * @param  Builder<AcademyClass>  $query
     * @return Builder<AcademyClass>
     */
    public function scopeQuery(Builder $query, User $actor, string $column = 'classes.teacher_id'): Builder
    {
        $teacherId = $this->teacherIdOrFail($actor);
        if ($teacherId === null) {
            return $query;
        }

        return $query->where($column, $teacherId);
    }

    /**
     * A teacher may create/update only classes they own. Ownership transfer is
     * Stage 18.4 (G3) and is not implemented here; a teacher must not be able
     * to hand a class to another teacher through an ordinary class write.
     */
    public function assertTeacherIdAllowed(User $actor, mixed $teacherId): void
    {
        $own = $this->teacherIdOrFail($actor);
        if ($own !== null && trim((string) $teacherId) !== $own) {
            throw new ApiException(403, 'FORBIDDEN', 'تغییر مدرس کلاس برای نقش مدرس مجاز نیست.');
        }
    }
}
