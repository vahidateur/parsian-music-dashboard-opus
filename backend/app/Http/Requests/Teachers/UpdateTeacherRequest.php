<?php

namespace App\Http\Requests\Teachers;

use App\Domain\Teachers\TeacherPolicy;
use App\Http\Requests\ApiFormRequest;

/** PATCH semantics: every field optional, present fields validated as on create. */
final class UpdateTeacherRequest extends ApiFormRequest
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
            $required = in_array($field, TeacherRules::REQUIRED, true) ? ['filled'] : [];
            $rules[$field] = ['sometimes', ...$required, ...$fieldRules];
        }

        return $rules;
    }
}
