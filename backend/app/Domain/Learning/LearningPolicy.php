<?php

namespace App\Domain\Learning;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * Learning authorization.
 *
 * PB-3 is lifted for Learning (DECISIONS.md §34): two ids were created —
 * `learning.read` and `learning.write` — because §26.3 forbids reinterpreting
 * `settings.write` or `library.write` as covering them.
 *
 * `learning.read` is granted to every role that works with students
 * (administrator, manager, teacher, staff) — programs, levels and their
 * material are what those roles resolve every day. `learning.write` is
 * granted to administrator, manager and teacher: the curriculum is authored
 * the way repertoire is (mirroring `progress.write`).
 */
final class LearningPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'learning.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'learning.write');
    }
}
