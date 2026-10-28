<?php

namespace App\Http\Requests\Gallery;

use App\Domain\Gallery\GalleryPolicy;
use App\Http\Requests\ApiFormRequest;

final class ReorderImageRequest extends ApiFormRequest
{
    protected string $errorCode = 'GALLERY_IMAGE_INVALID';

    protected string $errorMessage = 'جایگاه تصویر معتبر نیست.';

    /** Policy first: an unauthorized caller gets 403 before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(GalleryPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        // The upper bound depends on the album's image count, so only the
        // shape is validated here; the service refuses an out-of-range
        // position with the same code.
        return [
            'order' => ['required', 'integer', 'min:0'],
        ];
    }
}
