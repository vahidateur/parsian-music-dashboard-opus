<?php

namespace App\Http\Requests\Gallery;

use App\Domain\Gallery\GalleryPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;

final class UpdateAlbumRequest extends ApiFormRequest
{
    protected string $errorCode = 'GALLERY_ALBUM_INVALID';

    protected string $errorMessage = 'اطلاعات آلبوم معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(GalleryPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'min:2', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'coverMediaId' => ['sometimes', 'nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
