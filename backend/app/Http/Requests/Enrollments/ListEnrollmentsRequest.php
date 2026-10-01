<?php

namespace App\Http\Requests\Enrollments;

use App\Domain\Enrollments\EnrollmentPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\Enrollment;
use Illuminate\Validation\Rule;

/** Query of GET enrollments (snake_case, as ApiEnrollmentRepository.toQuery sends). */
final class ListEnrollmentsRequest extends ApiFormRequest
{
    protected string $errorCode = 'ENROLLMENT_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی ثبت‌نام معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(EnrollmentPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'student_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'class_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'nullable', Rule::in(Enrollment::STATUSES)],
            'active' => ['sometimes', 'nullable', Rule::in(['0', '1', 'true', 'false'])],
        ];
    }
}
