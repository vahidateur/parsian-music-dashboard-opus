<?php

namespace App\Http\Resources;

use App\Models\ClassSession;
use App\Support\Iso;

/** Wire shape = TS `Session` (camelCase), read unmapped by ApiSchedulingRepository. */
final class SessionResource
{
    /** @return array<string, mixed> */
    public static function toWire(ClassSession $session): array
    {
        $wire = [
            'id' => $session->id,
            'classId' => $session->class_id,
            'date' => $session->date,
            'startTime' => $session->start_time,
            'endTime' => $session->end_time,
            'teacherId' => $session->teacher_id,
            'roomId' => $session->room_id,
            'status' => $session->status,
            'origin' => $session->origin,
        ];

        if ($session->cancel_reason !== null && $session->cancel_reason !== '') {
            $wire['cancelReason'] = $session->cancel_reason;
        }
        if ($session->rescheduled_from_id !== null && $session->rescheduled_from_id !== '') {
            $wire['rescheduledFromId'] = $session->rescheduled_from_id;
        }
        if ($session->rescheduled_to_id !== null && $session->rescheduled_to_id !== '') {
            $wire['rescheduledToId'] = $session->rescheduled_to_id;
        }
        if ($session->notes !== null && $session->notes !== '') {
            $wire['notes'] = $session->notes;
        }

        return [
            ...$wire,
            'createdAt' => Iso::format($session->created_at),
            'updatedAt' => Iso::format($session->updated_at),
        ];
    }
}
