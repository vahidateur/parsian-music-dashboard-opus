<?php

namespace App\Http\Requests\Library;

use App\Domain\Library\ResourcePolicy;
use App\Domain\Library\ResourceRules;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * Query of GET /resources (snake_case, as `toQuery()` in
 * src/domains/library/apiRepository.ts sends it).
 *
 * `page` / `per_page` are deliberately absent: `App\Support\Pagination` reads
 * and clamps them, and the server clamps rather than rejects an oversized
 * `per_page` (config/api.php) — the client reports the real number back in
 * `meta.per_page`, which is the I16 disclosure.
 */
final class ListResourcesRequest extends ApiFormRequest
{
    protected string $errorCode = 'RESOURCE_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی منبع معتبر نیست.';

    /** Permission before validation: a caller without library.read gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ResourcePolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:200'],
            'kind' => ['sometimes', 'nullable', Rule::in(ResourceRules::KINDS)],
            'instrument' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_INSTRUMENT],
            'level' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_LEVEL],
            'visibility' => ['sometimes', 'nullable', Rule::in(ResourceRules::VISIBILITIES)],
            'sort' => ['sometimes', 'nullable', Rule::in(ResourceRules::SORTS)],
        ];
    }
}
