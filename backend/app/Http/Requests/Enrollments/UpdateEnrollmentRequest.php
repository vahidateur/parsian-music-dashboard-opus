<?php

namespace App\Http\Requests\Enrollments;

use App\Domain\Enrollments\EnrollmentPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\Enrollment;
use Illuminate\Validation\Rule;

/** PATCH enrollments/{id}: only status, endDate and pricingPlan (TS UpdateEnrollmentInput). */
final class UpdateEnrollmentRequest extends ApiFormRequest
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
            'status' => ['sometimes', 'string', Rule::in(Enrollment::STATUSES)],
            'endDate' => ['sometimes', 'nullable', 'string', 'max:32'],
            ...EnrollmentRules::pricingPlan(),
        ];
    }
}
