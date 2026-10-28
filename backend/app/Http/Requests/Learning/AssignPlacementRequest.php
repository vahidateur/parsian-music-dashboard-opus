<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\LinkPlacementRules;
use App\Http\Requests\ApiFormRequest;

final class AssignPlacementRequest extends ApiFormRequest
{
    protected string $errorCode = 'PLACEMENT_INVALID';

    protected string $errorMessage = 'سطح‌بندی هنرجو معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return LinkPlacementRules::assignFields();
    }
}
