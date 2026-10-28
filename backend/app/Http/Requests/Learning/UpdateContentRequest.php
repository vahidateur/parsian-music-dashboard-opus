<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\ContentRules;
use App\Http\Requests\ApiFormRequest;

final class UpdateContentRequest extends ApiFormRequest
{
    protected string $errorCode = 'CONTENT_INVALID';

    protected string $errorMessage = 'اطلاعات محتوا معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ContentRules::updateFields();
    }
}
