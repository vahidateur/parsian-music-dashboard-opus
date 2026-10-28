<?php

namespace App\Http\Requests\Classes;

use App\Domain\Classes\ClassPolicy;
use App\Http\Requests\ApiFormRequest;

final class StoreClassRequest extends ApiFormRequest
{
    protected string $errorCode = 'CLASS_INVALID';

    protected string $errorMessage = 'اطلاعات کلاس معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(ClassPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [];
        foreach (ClassRules::fields() as $field => $fieldRules) {
            $rules[$field] = in_array($field, ClassRules::REQUIRED, true)
                ? ['required', ...$fieldRules]
                : ['sometimes', ...$fieldRules];
        }

        return $rules;
    }
}
