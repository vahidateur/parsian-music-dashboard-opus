<?php

namespace App\Domain\Progress;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * Progress authorization.
 *
 * The permissions are `progress.read` / `progress.write`, authorized by the
 * owner for v1 on 2026-10-03 (DECISIONS.md §29). Nothing else was added: no
 * `progress.admin`, no `instruments.*`, no `learning.*`. The vocabulary went
 * from 23 to exactly 25 ids.
 *
 * PB-3 is lifted for Progress ONLY. It remains Option A for instruments and
 * learning, and PB-5 remains Option A for notifications and Telegram/Bale/Push.
 *
 * `progress.write` is NOT taken to imply `progress.read`: the shipped
 * vocabulary grants them independently and the tests assert each one alone.
 *
 * Note what is deliberately absent: the client's progress panels gate writes on
 * `role === "teacher"`. That is a UX gate, not an authorization boundary, and
 * PB-3 is explicit that nothing authorizes on role. The permission carries the
 * decision here; `teacher_id` on an assignment is provenance for
 * accountability and never authorizes anything.
 */
final class ProgressPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'progress.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'progress.write');
    }
}
