<?php

namespace App\Domain\Progress;

use App\Models\Piece;
use App\Models\PieceAssignment;
use App\Support\Api\ApiException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Repertoire persistence.
 *
 * TENANT ISOLATION — every query goes through `Piece`, which uses the
 * `BelongsToOrganization` global scope: reads are constrained to the current
 * TenantContext organization, and with no resolved tenant the scope matches
 * NOTHING (fail closed). New rows take `organization_id` from the context;
 * request input never supplies one.
 *
 * This service carries no actor and makes no authorization decision; that
 * lives in `ProgressPolicy`, which the controller calls first.
 */
final class PieceService
{
    /** camelCase wire key → snake_case column. */
    private const COLUMN_MAP = [
        'title' => 'title',
        'composer' => 'composer',
        'instrumentId' => 'instrument_id',
        'programId' => 'program_id',
        'recommendedLevelId' => 'recommended_level_id',
        'description' => 'description',
        'rangeUnit' => 'range_unit',
        'totalRange' => 'total_range',
        'contentIds' => 'content_ids',
        'active' => 'active',
    ];

    /**
     * @param  array<string, mixed>  $filters  validated query (instrument_id, program_id, search, active_only)
     */
    public function paginate(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return Piece::query()
            ->when(filled($filters['instrument_id'] ?? null), fn (Builder $q): Builder => $q->where('instrument_id', $filters['instrument_id']))
            ->when(filled($filters['program_id'] ?? null), fn (Builder $q): Builder => $q->where('program_id', $filters['program_id']))
            ->when(filled($filters['active_only'] ?? null), fn (Builder $q): Builder => $q->where('active', true))
            ->when(filled($filters['search'] ?? null), fn (Builder $q): Builder => $this->applySearch($q, (string) $filters['search']))
            // The client sorts the repertoire by title; mirror it so a
            // server-backed list is in the same order as a demo-backed one.
            ->orderBy('title')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function findOrFail(string $id): Piece
    {
        $piece = Piece::query()->whereKey($id)->first();

        if ($piece === null) {
            throw ApiException::notFound('PIECE_NOT_FOUND', 'قطعه یافت نشد.');
        }

        return $piece;
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function create(array $input): Piece
    {
        $attributes = $this->attributes($input);
        // `contentIds` defaults to an empty list on CREATE only. A patch that
        // omits it must leave the stored list alone, not blank it.
        $attributes['content_ids'] = $input['contentIds'] ?? [];

        return DB::transaction(function () use ($input, $attributes): Piece {
            $piece = new Piece;
            // Ids are generated here, not by the database: the row is a string
            // key and `create()` would otherwise insert NULL.
            $piece->id = 'pc_'.strtolower((string) Str::ulid());
            $piece->fill($attributes)->save();

            // `createdAt` is the one timestamp the contract lets a caller
            // supply (back-dated catalogue entry), so set it after the fill.
            if (isset($input['createdAt'])) {
                $piece->created_at = $input['createdAt'];
                $piece->save();
            }

            return $piece->refresh();
        });
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function update(Piece $piece, array $input): Piece
    {
        $attributes = $this->attributes($input);

        return DB::transaction(function () use ($piece, $attributes): Piece {
            // Re-read inside the transaction so two operators cannot each write
            // a half of a change and leave the row inconsistent.
            $fresh = Piece::query()->whereKey($piece->id)->lockForUpdate()->first() ?? $piece;
            $fresh->fill($attributes)->save();

            return $fresh->refresh();
        });
    }

    /**
     * Refused while any assignment references the piece — deactivate instead.
     *
     * Progress is tracked against the piece, so removing one would leave
     * assignments pointing at nothing and would silently rewrite what a
     * student has been working on. The client contract says the same thing and
     * offers `active: false` as the intended path.
     */
    public function delete(Piece $piece): void
    {
        $used = PieceAssignment::query()->where('piece_id', $piece->id)->exists();

        if ($used) {
            throw ApiException::conflict(
                'PIECE_IN_USE',
                'این قطعه به هنرجویانی تخصیص داده شده است و حذف نمی‌شود. به‌جای حذف، آن را غیرفعال کنید.',
            );
        }

        DB::transaction(function () use ($piece): void {
            $piece->delete();
        });
    }

    private function applySearch(Builder $query, string $term): Builder
    {
        $like = '%'.$term.'%';

        return $query->where(function (Builder $inner) use ($like): void {
            $inner->where('title', 'like', $like)
                ->orWhere('composer', 'like', $like);
        });
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function attributes(array $input): array
    {
        $attributes = [];

        foreach (self::COLUMN_MAP as $wireKey => $column) {
            if (array_key_exists($wireKey, $input)) {
                $attributes[$column] = $input[$wireKey];
            }
        }

        return $attributes;
    }
}
