<?php

namespace App\Http\Requests\Teachers;

use App\Domain\Teachers\TeacherPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\Teacher;
use Illuminate\Validation\Rule;

/** Query of GET teachers (snake_case, as ApiTeacherRepository.toQuery sends). */
final class ListTeachersRequest extends ApiFormRequest
{
    protected string $errorCode = 'TEACHER_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی مدرس معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(TeacherPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'instrument' => ['sometimes', 'nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'nullable', Rule::in(Teacher::STATUSES)],
            'assignable' => ['sometimes', 'nullable', Rule::in(['0', '1', 'true', 'false'])],
            'sort' => ['sometimes', 'nullable', Rule::in(['name', 'utilization', 'students'])],
            'dir' => ['sometimes', 'nullable', Rule::in(['asc', 'desc'])],
        ];
    }
}
