<?php

namespace App\Http\Resources;

use App\Models\Room;

/** Wire shape = TS `DemoRoom` / `Room`. */
final class RoomResource
{
    /** @return array{id: string, name: string, kind: string, capacity: int, occupancy: int, active: bool} */
    public static function toWire(Room $room): array
    {
        return [
            'id' => $room->id,
            'name' => $room->name,
            'kind' => $room->kind,
            'capacity' => $room->capacity,
            'occupancy' => $room->occupancy,
            'active' => $room->active,
        ];
    }
}
