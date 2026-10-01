<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/** Body of POST sessions/check-conflicts (TS SessionCandidate). */
final class CheckConflictsRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_INVALID';

    protected string $errorMessage = 'اطلاعات بررسی تداخل معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'classId' => ['required', 'string', 'max:64'],
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'teacherId' => ['required', 'string', 'max:64'],
            'roomId' => ['required', 'string', 'max:64'],
        ];
    }
}
