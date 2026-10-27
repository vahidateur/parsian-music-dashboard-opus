<?php

namespace App\Domain\Rooms;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * Room authorization.
 *
 * PB-3 is lifted for Rooms (DECISIONS.md §35): two ids were created —
 * `rooms.read` and `rooms.write` — because §26.3 forbids reinterpreting
 * `settings.write` or `library.write` as covering them. PB-3 has no blocked
 * domain left.
 *
 * `rooms.read` is granted to every role (a room is a lookup-table name, not
 * personal data — every record that carries a `room_id` resolves against it).
 * `rooms.write` is granted to administrator and manager, who curate academy
 * configuration the way they curate instruments.
 */
final class RoomPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'rooms.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'rooms.write');
    }
}
