<?php

namespace App\Http\Requests\Library;

use App\Domain\Library\ResourcePolicy;
use App\Domain\Library\ResourceRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use Illuminate\Validation\Rule;

/**
 * Body of POST /resources (TS `CreateLibraryItemInput`).
 *
 * Every bound mirrors `validate()` in src/domains/library/localRepository.ts,
 * so a value the client refuses is refused by the server for the same reason
 * and lands in the same `fields` shape. The client's validation is a
 * convenience; this one is the control.
 *
 * `uses`, `size`, `duration` and `added` are NOT accepted: the first only grows
 * on a download, and the rest are derived display labels.
 */
final class StoreResourceRequest extends ApiFormRequest
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
            'title' => ['required', 'string', 'min:'.ResourceRules::MIN_TITLE, 'max:'.ResourceRules::MAX_TITLE],
            'composer' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_COMPOSER],
            // Provenance only — `""` means "no contributing teacher".
            'teacherId' => ['sometimes', 'nullable', 'string', TenantRules::teacherExists()],
            'kind' => ['required', Rule::in(ResourceRules::KINDS)],
            'instrument' => ['required', 'string', 'min:1', 'max:'.ResourceRules::MAX_INSTRUMENT],
            'level' => ['sometimes', 'nullable', 'string', 'max:'.ResourceRules::MAX_LEVEL],
            // An opaque reference into the media domain. The media table IS
            // served now, so the asset must exist in this organization — a row
            // naming a missing (or deleted, or cross-tenant) file would render
            // "no file" forever and nothing would tell the operator why.
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
