<?php

namespace App\Http\Requests\Classes;

use App\Domain\Classes\ClassPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * PATCH semantics: every field optional, present fields validated as on
 * create. `enrolled`, `waitlist` and `studentIds` are computed and are not
 * accepted (they are not in the rule set, so validated() drops them).
 */
final class UpdateClassRequest extends ApiFormRequest
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
            $required = in_array($field, ClassRules::REQUIRED, true) ? ['filled'] : [];
            $rules[$field] = ['sometimes', ...$required, ...$fieldRules];
        }

        return $rules;
    }
}
