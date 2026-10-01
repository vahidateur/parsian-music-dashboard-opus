<?php

namespace App\Http\Requests\Students;

use App\Domain\Students\StudentAccessPolicy;
use App\Domain\Students\StudentService;
use App\Http\Requests\ApiFormRequest;
use App\Models\Student;
use Illuminate\Validation\Rule;

/** Query of GET students (snake_case, as ApiStudentRepository.toQuery sends). */
final class ListStudentsRequest extends ApiFormRequest
{
    protected string $errorCode = 'STUDENT_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی هنرجو معتبر نیست.';

    /** Permission, then scope (PB-1 blocks here), before any 422. */
    protected function authorizeBeforeValidation(): void
    {
        $policy = app(StudentAccessPolicy::class);
        $policy->authorizeRead($this->user());
        $policy->resolveScope($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'nullable', Rule::in(Student::STATUSES)],
            'instrument' => ['sometimes', 'nullable', 'string', 'max:64'],
            'payment' => ['sometimes', 'nullable', Rule::in(Student::PAYMENTS)],
            'teacher_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'sort' => ['sometimes', 'nullable', Rule::in(StudentService::sorts())],
        ];
    }
}
