<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\LinkPlacementRules;
use App\Http\Requests\ApiFormRequest;

final class AttachContentRequest extends ApiFormRequest
{
    protected string $errorCode = 'LINK_INVALID';

    protected string $errorMessage = 'اتصال محتوا معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return LinkPlacementRules::attachFields();
    }
}
