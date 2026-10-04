<?php

namespace App\Http\Resources;

use App\Models\PieceAssignment;

/**
 * Wire shape = TS `PieceAssignment` (src/domains/progress/types.ts).
 *
 * `latest` is the denormalized snapshot of the newest progress event, recomputed
 * by the service on every append and derived strictly from the log. It stays
 * null until the first event exists.
 */
final class PieceAssignmentResource
{
    /** @return array<string, mixed> */
    public static function toWire(PieceAssignment $assignment): array
    {
        return [
            'id' => (string) $assignment->id,
            'studentId' => (string) $assignment->student_id,
            'pieceId' => (string) $assignment->piece_id,
            // Provenance only — never an authorization input.
            'teacherId' => $assignment->teacher_id,
            'status' => (string) $assignment->status,
            'assignedAt' => $assignment->assigned_at?->format('Y-m-d\\TH:i:s.v\\Z') ?? '',
            'targetDate' => $assignment->target_date?->format('Y-m-d\\TH:i:s.v\\Z'),
            // Stamped on close, cleared on reopen — never a stale value.
            'closedAt' => $assignment->closed_at?->format('Y-m-d\\TH:i:s.v\\Z'),
            'notes' => (string) $assignment->notes,
            'latest' => self::latestToWire($assignment),
        ];
    }

    /**
     * TS `ProgressSnapshot`. The event id travels with it so a client can tell
     * whether the snapshot it is holding came from the same event.
     *
     * @return array<string, mixed>|null
     */
    private static function latestToWire(PieceAssignment $assignment): ?array
    {
        $latest = $assignment->latest;

        if ($latest === null) {
            return null;
        }

        return [
            'rangeStart' => $latest['rangeStart'] ?? null,
            'rangeEnd' => $latest['rangeEnd'] ?? null,
            'rangeLabel' => $latest['rangeLabel'] ?? null,
            'tempoBpm' => $latest['tempoBpm'] ?? null,
            'targetTempoBpm' => $latest['targetTempoBpm'] ?? null,
            'mastery' => $latest['mastery'] ?? null,
            'recordedAt' => isset($latest['recordedAt'])
                ? \Illuminate\Support\Carbon::parse($latest['recordedAt'])->format('Y-m-d\\TH:i:s.v\\Z')
                : null,
            'eventId' => $latest['eventId'] ?? null,
        ];
    }
}
