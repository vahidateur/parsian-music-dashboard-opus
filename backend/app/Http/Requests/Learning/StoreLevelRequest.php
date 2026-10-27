<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\LevelRules;
use App\Http\Requests\ApiFormRequest;

final class StoreLevelRequest extends ApiFormRequest
{
    protected string $errorCode = 'LEVEL_INVALID';

    protected string $errorMessage = 'اطلاعات سطح معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return LevelRules::createFields();
    }
}
