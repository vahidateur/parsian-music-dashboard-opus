<?php

namespace App\Http\Resources;

use App\Models\Piece;

/**
 * Wire shape = TS `Piece` (src/domains/progress/types.ts).
 *
 * `totalRange` stays null when the piece has no denominator: the contract is
 * explicit that a completion percentage is then not derived, and returning 0
 * would be a percentage with no denominator dressed up as a measurement.
 */
final class PieceResource
{
    /** @return array<string, mixed> */
    public static function toWire(Piece $piece): array
    {
        return [
            'id' => (string) $piece->id,
            'title' => (string) $piece->title,
            'composer' => (string) $piece->composer,
            'instrumentId' => (string) $piece->instrument_id,
            'programId' => $piece->program_id,
            'recommendedLevelId' => $piece->recommended_level_id,
            'description' => (string) $piece->description,
            'rangeUnit' => (string) $piece->range_unit,
            'totalRange' => $piece->total_range,
            // Opaque references to supporting resources; always a list, never null.
            'contentIds' => $piece->content_ids ?? [],
            'active' => (bool) $piece->active,
            // Millisecond precision, matching the dataset's own format.
            'createdAt' => $piece->created_at?->format('Y-m-d\\TH:i:s.v\\Z') ?? '',
        ];
    }
}
