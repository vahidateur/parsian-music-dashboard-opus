<?php

namespace App\Domain\Rooms;

use App\Models\User;
use App\Support\Authorization\OwnerDecisionRequired;

/**
 * PB-3 — UNRESOLVED. No permission in the vocabulary names room read or
 * write, and none may be invented or borrowed (settings.write,
 * library.write, …). Every room endpoint therefore fails closed for every
 * actor, administrator included, until the owner decides PB-3.
 *
 * When PB-3 is decided, this class is the only place to change: route the
 * checks through App\Support\Authorization\PermissionGate with the decided
 * permission ids.
 */
final class RoomPolicy
{
    private const DETAIL = 'No room read/write permission exists in the vocabulary; PB-3 resolved 2026-10-02 as option A (keep blocked, invent no permission id).';

    public function authorizeRead(User $actor): never
    {
        throw new OwnerDecisionRequired('PB-3', self::DETAIL);
    }

    public function authorizeWrite(User $actor): never
    {
        throw new OwnerDecisionRequired('PB-3', self::DETAIL);
    }
}
