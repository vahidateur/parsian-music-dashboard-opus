<?php

namespace App\Http\Requests\Library;

use App\Domain\Library\ResourcePolicy;
use App\Domain\Library\ResourceRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use Illuminate\Validation\Rule;

/**
 * Body of PATCH /resources/{id} (TS `UpdateLibraryItemInput`).
 *
 * Every field is `sometimes` — a patch carries only what changed, and untouched
 * fields keep their stored values. The bounds are the same as on create so a
 * row cannot be patched into a state that create would have refused.
 */
final class UpdateResourceRequest extends ApiFormRequest
{
    protected string $errorCode = 'RESOURCE_INVALID';

    protected string $errorMessage = 'اطلاعات منبع معتبر نیست.';

    /** Permission before validation: a caller without library.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ResourcePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'min:'.ResourceRules::MIN_TITLE, 'max:'.ResourceRules::MAX_TITLE],
            'composer' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_COMPOSER],
            'teacherId' => ['sometimes', 'nullable', 'string', TenantRules::teacherExists()],
            'kind' => ['sometimes', Rule::in(ResourceRules::KINDS)],
            'instrument' => ['sometimes', 'string', 'min:1', 'max:'.ResourceRules::MAX_INSTRUMENT],
            'level' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_LEVEL],
            'mediaId' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_MEDIA_ID, TenantRules::mediaAssetExists()],
            'pages' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.ResourceRules::MAX_PAGES],
            'durationSeconds' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.ResourceRules::MAX_DURATION_SECONDS],
            'peaks' => ['sometimes', 'nullable', 'array', 'max:'.ResourceRules::MAX_PEAKS],
            'peaks.*' => ['integer', 'min:0'],
            'visibility' => ['sometimes', Rule::in(ResourceRules::VISIBILITIES)],
            'restrictedToStudentIds' => ['sometimes', 'nullable', 'array', 'max:'.ResourceRules::MAX_RESTRICTED_STUDENTS],
            'restrictedToStudentIds.*' => ['string', TenantRules::studentExists()],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
