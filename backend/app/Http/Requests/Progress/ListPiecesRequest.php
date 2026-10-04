<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;

/**
 * Query of GET /pieces (snake_case, as `pieceQuery()` in
 * src/domains/progress/apiRepository.ts sends it).
 *
 * `page` / `per_page` are deliberately absent: `App\Support\Pagination` reads
 * and clamps them, and the server clamps rather than rejects an oversized
 * `per_page`, reporting what it actually used in `meta.per_page`.
 */
final class ListPiecesRequest extends ApiFormRequest
{
    protected string $errorCode = 'PIECE_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی قطعه معتبر نیست.';

    /** Permission before validation: a caller without progress.read gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ProgressPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'instrument_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'program_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'search' => ['sometimes', 'nullable', 'string', 'max:200'],
            'active_only' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
