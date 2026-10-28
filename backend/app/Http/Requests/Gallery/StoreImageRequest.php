<?php

namespace App\Http\Requests\Gallery;

use App\Domain\Gallery\GalleryPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;

final class StoreImageRequest extends ApiFormRequest
{
    protected string $errorCode = 'GALLERY_IMAGE_INVALID';

    protected string $errorMessage = 'اطلاعات تصویر معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(GalleryPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'albumId' => ['required', 'string', TenantRules::galleryAlbumExists()],
            'mediaId' => ['required', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'caption' => ['required', 'string', 'min:1', 'max:255'],
            'alt' => ['required', 'string', 'min:2', 'max:500'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
