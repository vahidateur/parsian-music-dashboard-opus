<?php

namespace App\Http\Requests\Classes;

use App\Domain\Classes\ClassPolicy;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/** Query of GET classes (snake_case, as ApiClassRepository.toQuery sends). */
final class ListClassesRequest extends ApiFormRequest
{
    protected string $errorCode = 'CLASS_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی کلاس معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(ClassPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'instrument' => ['sometimes', 'nullable', 'string', 'max:64'],
            'teacher_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'room_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'nullable', Rule::in(ClassRules::STATUSES)],
            'sort' => ['sometimes', 'nullable', Rule::in(['title', 'enrolled', 'capacity'])],
            'dir' => ['sometimes', 'nullable', Rule::in(['asc', 'desc'])],
        ];
    }
}
