<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\ProgramRules;
use App\Http\Requests\ApiFormRequest;

final class UpdateProgramRequest extends ApiFormRequest
{
    protected string $errorCode = 'PROGRAM_INVALID';

    protected string $errorMessage = 'اطلاعات برنامه معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ProgramRules::updateFields();
    }
}
