<?php

namespace App\Http\Requests\Instruments;

use App\Domain\Instruments\InstrumentRules;
use App\Http\Requests\ApiFormRequest;

final class StoreInstrumentRequest extends ApiFormRequest
{
    protected string $errorCode = 'INSTRUMENT_INVALID';

    protected string $errorMessage = 'اطلاعات ساز معتبر نیست.';

    public function rules(): array
    {
        return InstrumentRules::fields();
    }
}
