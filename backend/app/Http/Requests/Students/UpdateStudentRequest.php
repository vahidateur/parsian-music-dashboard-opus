<?php

namespace App\Http\Requests\Students;

use App\Domain\Students\StudentAccessPolicy;
use App\Http\Requests\ApiFormRequest;

/** PATCH semantics: every field optional, present fields validated as on create. */
final class UpdateStudentRequest extends ApiFormRequest
{
    protected string $errorCode = 'STUDENT_INVALID';

    protected string $errorMessage = 'اطلاعات هنرجو معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(StudentAccessPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return StudentRules::rules(false);
    }
}
