<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/** PATCH sessions/{id}: only the movable occurrence fields (TS UpdateSessionInput). */
final class UpdateSessionRequest extends ApiFormRequest
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
            'date' => ['sometimes', ...$fields['date']],
            'startTime' => ['sometimes', ...$fields['startTime']],
            'endTime' => ['sometimes', ...$fields['endTime']],
            'teacherId' => ['sometimes', ...$fields['teacherId']],
            'roomId' => ['sometimes', ...$fields['roomId']],
            'notes' => $fields['notes'],
            'acknowledgeWarnings' => $fields['acknowledgeWarnings'],
        ];
    }
}
