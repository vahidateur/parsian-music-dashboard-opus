<?php

namespace App\Http\Requests\Branding;

use App\Domain\Branding\BrandingPolicy;
use App\Domain\Branding\BrandingRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use Illuminate\Validation\Rule;

/**
 * Body of PATCH /branding (TS `UpdateBrandingInput`).
 *
 * Every rule mirrors the client-side validation in
 * `src/domains/branding/localRepository.ts` (bounds) and `types.ts`
 * (hex test, font allow-list): a value the panel refuses is refused here
 * for the same reason and lands in the same `fields` shape.
 *
 * All fields are `sometimes`: a patch carries only what changed. A cleared
 * media reference travels as `''` or `null` and never fails: no logo means
 * "no logo", not "a logo that is missing".
 */
final class UpdateBrandingRequest extends ApiFormRequest
{
    protected string $errorCode = 'BRANDING_INVALID';

    protected string $errorMessage = 'اطلاعات برند معتبر نیست.';

    /** The policy runs first: a caller without branding.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(BrandingPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'academyName' => ['sometimes', 'string', 'min:2', 'max:80'],
            'tagline' => ['sometimes', 'string', 'max:120'],
            'logoMediaId' => ['sometimes', 'nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'faviconMediaId' => ['sometimes', 'nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'primaryColor' => ['sometimes', 'string', 'regex:'.BrandingRules::HEX_PATTERN],
            'accentColor' => ['sometimes', 'string', 'regex:'.BrandingRules::HEX_PATTERN],
            'textColor' => ['sometimes', 'string', 'regex:'.BrandingRules::HEX_PATTERN],
            'persianFont' => ['sometimes', 'string', Rule::in(BrandingRules::PERSIAN_FONTS)],
        ];
    }
}
