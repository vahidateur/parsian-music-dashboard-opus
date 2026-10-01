<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/** Body of POST sessions (TS CreateSessionInput). */
final class StoreSessionRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_INVALID';

    protected string $errorMessage = 'اطلاعات جلسه معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $fields = SessionRules::fields();

        return [
            'classId' => ['required', ...$fields['classId']],
            'date' => ['required', ...$fields['date']],
            'startTime' => ['required', ...$fields['startTime']],
            'endTime' => ['required', ...$fields['endTime']],
            'teacherId' => ['sometimes', ...$fields['teacherId']],
            'roomId' => ['sometimes', ...$fields['roomId']],
            'status' => ['sometimes', ...$fields['status']],
            'notes' => $fields['notes'],
            'acknowledgeWarnings' => $fields['acknowledgeWarnings'],
        ];
    }
}
