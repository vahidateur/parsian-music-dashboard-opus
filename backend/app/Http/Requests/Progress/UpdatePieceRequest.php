<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Models\Piece;
use Illuminate\Validation\Rule;

/**
 * Body of PATCH /pieces/{id} (TS `UpdatePieceInput`).
 *
 * Every field is `sometimes` — a patch carries only what changed, and untouched
 * fields keep their stored values. `createdAt` is deliberately absent: the
 * contract's update type excludes it, so a creation timestamp cannot be
 * rewritten after the fact.
 */
final class UpdatePieceRequest extends ApiFormRequest
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
            'title' => ['sometimes', 'string', 'min:1', 'max:'.ProgressRules::MAX_TITLE],
            'composer' => ['sometimes', 'string', 'max:'.ProgressRules::MAX_COMPOSER],
            'instrumentId' => ['sometimes', 'string', 'min:1', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'programId' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'recommendedLevelId' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'description' => ['sometimes', 'string', 'max:'.ProgressRules::MAX_DESCRIPTION],
            'rangeUnit' => ['sometimes', Rule::in(Piece::RANGE_UNITS)],
            'totalRange' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.ProgressRules::MAX_RANGE_VALUE],
            'contentIds' => ['sometimes', 'nullable', 'array', 'max:'.ProgressRules::MAX_CONTENT_IDS],
            'contentIds.*' => ['string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
