<?php

namespace App\Http\Requests\Teachers;

use App\Domain\Teachers\TeacherPolicy;
use App\Http\Requests\ApiFormRequest;

final class StoreTeacherRequest extends ApiFormRequest
{
    protected string $errorCode = 'TEACHER_INVALID';

    protected string $errorMessage = 'اطلاعات مدرس معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(TeacherPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [];
        foreach (TeacherRules::fields() as $field => $fieldRules) {
            $rules[$field] = in_array($field, TeacherRules::REQUIRED, true)
                ? ['required', ...$fieldRules]
                : ['sometimes', ...$fieldRules];
        }

        return $rules;
    }
}
