<?php

namespace App\Http\Resources;

use App\Models\Piece;
use App\Models\PieceAssignment;
use App\Models\ProgressEvent;

/**
 * Wire shape = TS `StudentProgressOverview`
 * (src/domains/progress/localRepository.ts `studentOverview()`).
 *
 * The three derived blocks are computed on the server over the FULL history.
 * The contract is explicit that the client must never be the authority for
 * analytics, plateau detection or recommendations, so nothing here is trimmable
 * by the caller.
 */
final class ProgressOverviewResource
{
    /**
     * One `{assignment, piece}` pair — TS `AssignmentWithPiece`.
     *
     * Extracted so the overview and the standalone assignments endpoint
     * (`GET /students/{id}/assignments`) serialize a pair through the SAME code.
     * They are two views of one contract, and duplicating the mapping would let
     * them drift on a field or on the null-piece case.
     *
     * `piece` is nullable: an assignment whose piece row is gone still belongs
     * in the list, and the contract types it `Piece | undefined`.
     *
     * @param  array{assignment: PieceAssignment, piece: Piece|null}  $pair
     * @return array<string, mixed>
     */
    public static function toWirePair(array $pair): array
    {
        return [
            'assignment' => PieceAssignmentResource::toWire($pair['assignment']),
            'piece' => $pair['piece'] !== null ? PieceResource::toWire($pair['piece']) : null,
        ];
    }

    /**
     * @param  array{assignments: array<int, array{assignment: PieceAssignment, piece: Piece|null}>, insights: array<int, array<string, mixed>>, recommendations: array<int, array<string, mixed>>, recentEvents: array<int, ProgressEvent>}  $overview
     * @return array<string, mixed>
     */
    public static function toWire(array $overview): array
    {
        return [
            'assignments' => array_map(
                [self::class, 'toWirePair'],
                array_values($overview['assignments']),
            ),
            'insights' => array_values($overview['insights']),
            'recommendations' => array_values($overview['recommendations']),
            'recentEvents' => array_map(
                static fn (ProgressEvent $event): array => ProgressEventResource::toWire($event),
                array_values($overview['recentEvents']),
            ),
        ];
    }
}
