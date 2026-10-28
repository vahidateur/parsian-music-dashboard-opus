<?php

namespace App\Domain\Organization;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * Organization settings authorization.
 *
 * The permissions are `settings.read` / `settings.write` — both already in the
 * shipped 23-id vocabulary (`config/permissions.php`). Nothing is invented: no
 * `organization.read`, `organization.write`, `working_hours.read` or
 * `working_hours.write` is created, and no neighbouring permission
 * (`users.write`, `library.write`, `schedule.write`, `attendance.write`) is
 * borrowed to stand in for one.
 *
 * The shipped vocabulary gives `settings.write` to the administrator only; the
 * manager holds `settings.read`. That asymmetry is asserted by the tests rather
 * than assumed.
 */
final class OrganizationPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'settings.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'settings.write');
    }
}
