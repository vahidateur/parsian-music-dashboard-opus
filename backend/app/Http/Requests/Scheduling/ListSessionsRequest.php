<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/** Query of GET sessions (snake_case, as ApiSchedulingRepository.toQuery sends). */
final class ListSessionsRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی جلسه معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'class_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'teacher_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'room_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'nullable', 'string', 'in:scheduled,cancelled,completed'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'active_only' => ['sometimes', 'nullable', 'in:0,1,true,false'],
        ];
    }
}
