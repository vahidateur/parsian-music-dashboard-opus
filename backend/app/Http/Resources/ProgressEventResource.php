<?php

namespace App\Http\Resources;

use App\Models\ProgressEvent;

/**
 * Wire shape = TS `ProgressEvent` (src/domains/progress/types.ts).
 *
 * `studentId` and `pieceId` are echoed back so the client can group without
 * joining, but they were decided by the server from the assignment — a caller
 * cannot choose them.
 */
final class ProgressEventResource
{
    /** @return array<string, mixed> */
    public static function toWire(ProgressEvent $event): array
    {
        return [
            'id' => (string) $event->id,
            'studentId' => (string) $event->student_id,
            'pieceId' => (string) $event->piece_id,
            'assignmentId' => (string) $event->assignment_id,
            'recordedAt' => $event->recorded_at?->format('Y-m-d\\TH:i:s.v\\Z') ?? '',
            'rangeStart' => $event->range_start,
            'rangeEnd' => $event->range_end,
            'rangeLabel' => $event->range_label,
            'tempoBpm' => $event->tempo_bpm,
            'targetTempoBpm' => $event->target_tempo_bpm,
            'mastery' => (int) $event->mastery,
            'practiceMinutes' => $event->practice_minutes,
            'teacherNote' => $event->teacher_note,
            'studentNote' => $event->student_note,
            // Provenance of the entry, never an authorization input.
            'source' => (string) $event->source,
            'sessionId' => $event->session_id,
        ];
    }
}
