<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Models\Piece;
use Illuminate\Validation\Rule;

/**
 * Body of POST /pieces (TS `CreatePieceInput`).
 *
 * The required set is taken straight from the type:
 * `Omit<Piece, "id"|"createdAt"|"contentIds"> & Partial<Pick<Piece, "createdAt"|"contentIds">>`
 * — so title, composer, instrumentId, description, rangeUnit and active are
 * required, and programId, recommendedLevelId, totalRange, contentIds and
 * createdAt are optional.
 *
 * `instrumentId`, `programId` and `recommendedLevelId` are NOT existence-checked:
 * the client validates them against its instruments/programs/levels stores, and
 * no such table exists on the server (instruments and learning are PB-3,
 * Option A). They are references by value, which is the honest boundary.
 */
final class StorePieceRequest extends ApiFormRequest
{
    protected string $errorCode = 'PIECE_INVALID';

    protected string $errorMessage = 'اطلاعات قطعه معتبر نیست.';

    /** Permission before validation: a caller without progress.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ProgressPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:1', 'max:'.ProgressRules::MAX_TITLE],
            'composer' => ['required', 'string', 'max:'.ProgressRules::MAX_COMPOSER],
            'instrumentId' => ['required', 'string', 'min:1', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'programId' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'recommendedLevelId' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'description' => ['required', 'string', 'max:'.ProgressRules::MAX_DESCRIPTION],
            'rangeUnit' => ['required', Rule::in(Piece::RANGE_UNITS)],
            // A total range of 0 would be a denominator that divides by zero.
            'totalRange' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.ProgressRules::MAX_RANGE_VALUE],
            'contentIds' => ['sometimes', 'nullable', 'array', 'max:'.ProgressRules::MAX_CONTENT_IDS],
            'contentIds.*' => ['string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'active' => ['required', 'boolean'],
            // Back-dated catalogue entry, per the contract's optional createdAt.
            'createdAt' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
