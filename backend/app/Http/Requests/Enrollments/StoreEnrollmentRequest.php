<?php

namespace App\Http\Requests\Enrollments;

use App\Domain\Enrollments\EnrollmentPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST enrollments (TS CreateEnrollmentInput). Student/class existence
 * is checked by EnrollmentService inside its transaction (422
 * ENROLLMENT_INVALID), not here.
 */
final class StoreEnrollmentRequest extends ApiFormRequest
{
    protected string $errorCode = 'ENROLLMENT_INVALID';

    protected string $errorMessage = 'اطلاعات ثبت‌نام معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(EnrollmentPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'studentId' => ['required', 'string', 'max:64'],
            'classId' => ['required', 'string', 'max:64'],
            'status' => ['sometimes', 'string', 'in:active,waitlist'],
            'startDate' => ['sometimes', 'nullable', 'string', 'max:32'],
            ...EnrollmentRules::pricingPlan(),
        ];
    }
}
