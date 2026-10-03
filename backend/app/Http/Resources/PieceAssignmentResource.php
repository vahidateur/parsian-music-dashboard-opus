<?php

namespace App\Http\Resources;

use App\Models\PieceAssignment;

/**
 * Wire shape = TS `PieceAssignment` (src/domains/progress/types.ts).
 *
 * `latest` is the denormalized snapshot of the newest progress event. It is
 * null throughout this slice because the append-only event log it is derived
 * from is a later slice; the column exists so the deferred slice is a pure
 * write-side addition, and the resource does not invent a snapshot.
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
            'latest' => $assignment->latest,
        ];
    }
}
