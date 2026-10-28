<?php

namespace App\Domain\Library;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * Library resource authorization.
 *
 * The permissions are `library.read` / `library.write` — both already in the
 * shipped 23-id vocabulary (`config/permissions.php`). Nothing is invented: no
 * `library.admin`, `resource.*` or `resources.*` is created, and no
 * neighbouring permission (`settings.write`, `schedule.write`, `students.write`)
 * is borrowed to stand in for one.
 *
 * `library.write` is NOT taken to imply `library.read`: the shipped vocabulary
 * grants them independently and the tests assert each one on its own.
 *
 * Note what is deliberately absent: nothing here inspects `teacher_id`. In the
 * client contract that field is provenance ("who contributed this"), never
 * authorization, and `studentCanAccess()` is the single access rule on the
 * client side. Per-student eligibility is served by the learning domain, which
 * is out of scope for this slice.
 */
final class ResourcePolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'library.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'library.write');
    }
}
