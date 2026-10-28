<?php

namespace App\Http\Requests\Learning;

use App\Domain\Learning\LevelRules;
use App\Http\Requests\ApiFormRequest;

final class StoreProgramRequest extends ApiFormRequest
{
    protected string $errorCode = 'PROGRAM_INVALID';

    protected string $errorMessage = 'اطلاعات برنامه معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return \App\Domain\Learning\ProgramRules::createFields();
    }
}
