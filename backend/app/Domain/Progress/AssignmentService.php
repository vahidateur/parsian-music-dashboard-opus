<?php

namespace App\Domain\Progress;

use App\Models\PieceAssignment;
use App\Models\ProgressEvent;
use App\Support\Api\ApiException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Piece-assignment persistence.
 *
 * TENANT ISOLATION — every query goes through `PieceAssignment`, which uses the
 * `BelongsToOrganization` global scope, so another organization's assignment is
 * not merely filtered out of the result, it is never queried. New rows take
 * `organization_id` from the context; request input never supplies one.
 *
 * This service carries no actor and makes no authorization decision; that
 * lives in `ProgressPolicy`, which the controller calls first.
 */
final class AssignmentService
{
    /** camelCase wire key → snake_case column. */
    private const COLUMN_MAP = [
        'studentId' => 'student_id',
        'pieceId' => 'piece_id',
        'teacherId' => 'teacher_id',
        'status' => 'status',
        'assignedAt' => 'assigned_at',
        'targetDate' => 'target_date',
        'notes' => 'notes',
    ];

    /**
     * @param  array<string, mixed>  $filters  validated query (student_id, piece_id, teacher_id, status, active_only)
     */
    public function paginate(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return PieceAssignment::query()
            ->when(filled($filters['student_id'] ?? null), fn (Builder $q): Builder => $q->where('student_id', $filters['student_id']))
            ->when(filled($filters['piece_id'] ?? null), fn (Builder $q): Builder => $q->where('piece_id', $filters['piece_id']))
            ->when(filled($filters['teacher_id'] ?? null), fn (Builder $q): Builder => $q->where('teacher_id', $filters['teacher_id']))
            ->when(filled($filters['status'] ?? null), fn (Builder $q): Builder => $q->where('status', $filters['status']))
            ->when(filled($filters['active_only'] ?? null), fn (Builder $q): Builder => $q->whereIn('status', PieceAssignment::ACTIVE_STATUSES))
            // Newest assignment first: the current work is what a teacher opens for.
            ->orderByDesc('assigned_at')->orderByDesc('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function findOrFail(string $id): PieceAssignment
    {
        $assignment = PieceAssignment::query()->whereKey($id)->first();

        if ($assignment === null) {
            throw ApiException::notFound('ASSIGNMENT_NOT_FOUND', 'تخصیص قطعه یافت نشد.');
        }

        return $assignment;
    }

    /**
     * @param  array<string, mixed>  $input  validated camelCase wire input
     *
     * @throws ApiException ASSIGNMENT_DUPLICATE when an open assignment exists
     */
    public function create(array $input): PieceAssignment
    {
        $attributes = $this->attributes($input);
        $attributes['status'] = $input['status'] ?? 'planned';
        $attributes['assigned_at'] = $input['assignedAt'] ?? now();
        $attributes['notes'] = $input['notes'] ?? '';

        return DB::transaction(function () use ($input, $attributes): PieceAssignment {
            // One OPEN assignment per (student, piece). A closed one does not
            // block, because a finished piece may legitimately be re-assigned
            // later — which is exactly why this cannot be a unique index.
            $duplicate = PieceAssignment::query()
                ->where('student_id', $attributes['student_id'])
                ->where('piece_id', $attributes['piece_id'])
                ->whereNotIn('status', PieceAssignment::CLOSED_STATUSES)
                ->lockForUpdate()
                ->exists();

            if ($duplicate) {
                throw ApiException::conflict(
                    'ASSIGNMENT_DUPLICATE',
                    'این قطعه هم‌اکنون به این هنرجو تخصیص دارد.',
                );
            }

            $assignment = new PieceAssignment;
            // Ids are generated here, not by the database: the row is a string
            // key and `create()` would otherwise insert NULL.
            $assignment->id = 'as_'.strtolower((string) Str::ulid());
            $assignment->fill($attributes)->save();

            return $assignment->refresh();
        });
    }

    /** @param  array<string, mixed>  $input  validated camelCase wire input */
    public function update(PieceAssignment $assignment, array $input): PieceAssignment
    {
        $attributes = $this->attributes($input);

        // Closing stamps the moment; reopening clears it, so the field never
        // lies. The stamp is STICKY — re-closing an already-closed assignment
        // keeps the original date rather than rewriting history.
        if (array_key_exists('status', $input)) {
            if (in_array($input['status'], PieceAssignment::CLOSED_STATUSES, true)) {
                $attributes['closed_at'] = $assignment->closed_at ?? now();
            } else {
                $attributes['closed_at'] = null;
            }
        }

        return DB::transaction(function () use ($assignment, $attributes): PieceAssignment {
            $fresh = PieceAssignment::query()->whereKey($assignment->id)->lockForUpdate()->first() ?? $assignment;
            $fresh->fill($attributes)->save();

            return $fresh->refresh();
        });
    }

    /**
     * Removes an assignment, but never one that has progress history.
     *
     * The client contract refuses deletion while events exist, so a deletion
     * can never silently destroy the evidence every analytic is computed from.
     * The check is inside the transaction and takes a lock on the count, so two
     * concurrent deletes cannot both pass it.
     *
     * @throws ApiException ASSIGNMENT_HAS_HISTORY when events exist
     */
    public function delete(PieceAssignment $assignment): void
    {
        DB::transaction(function () use ($assignment): void {
            // lockForUpdate on the count: a concurrent append must not slip an
            // event in between the check and the delete.
            $hasHistory = ProgressEvent::query()
                ->where('assignment_id', $assignment->id)
                ->lockForUpdate()
                ->exists();

            if ($hasHistory) {
                throw ApiException::conflict(
                    'ASSIGNMENT_HAS_HISTORY',
                    'این تخصیص دارای سابقهٔ پیشرفت است و حذف نمی‌شود.',
                );
            }

            $assignment->delete();
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

        // The client contract uses `""` for "no assigning teacher"; the column
        // is nullable, so normalize it here.
        if (array_key_exists('teacherId', $input) && $input['teacherId'] === '') {
            $attributes['teacher_id'] = null;
        }

        return $attributes;
    }
}
