<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/** Body of POST sessions/{id}/reschedule (TS RescheduleInput). */
final class RescheduleSessionRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_INVALID';

    protected string $errorMessage = 'اطلاعات جابه‌جایی جلسه معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'teacherId' => ['sometimes', 'string', 'max:64'],
            'roomId' => ['sometimes', 'string', 'max:64'],
            'reason' => ['required', 'string', 'min:2', 'max:500'],
            'acknowledgeWarnings' => ['sometimes', 'boolean'],
        ];
    }
}
