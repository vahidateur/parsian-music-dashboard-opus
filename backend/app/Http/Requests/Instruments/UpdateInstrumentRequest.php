<?php

namespace App\Http\Requests\Instruments;

use App\Domain\Instruments\InstrumentRules;
use App\Http\Requests\ApiFormRequest;

final class UpdateInstrumentRequest extends ApiFormRequest
{
    protected string $errorCode = 'INSTRUMENT_INVALID';

    protected string $errorMessage = 'اطلاعات ساز معتبر نیست.';

    public function rules(): array
    {
        $rules = [];
        foreach (InstrumentRules::rawFields() as $field => $fieldRules) {
            $rules[$field] = ['sometimes', ...$fieldRules];
        }
        // The slug is immutable after creation — its presence is rejected in
        // the service, but the rule still validates its shape if it arrives.
        return $rules;
    }
}
