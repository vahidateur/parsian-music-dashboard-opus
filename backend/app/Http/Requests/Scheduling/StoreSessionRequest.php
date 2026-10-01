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
        // PB-1 (resolved 2026-10-02, option A) is a scope question and is
        // answered BEFORE the permission check, so a teacher with no linked
        // teacherId gets OWNER_DECISION_REQUIRED_PB1 rather than a bare
        // FORBIDDEN. Same precedence the shipped students slice uses.
        app(SessionPolicy::class)->assertTeacherLinked($this->user());
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
