<?php

namespace App\Http\Requests\Compensation;

use App\Domain\Compensation\CompensationPolicy;
use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Scheduling\SessionRules;
use App\Http\Requests\TenantRules;

/**
 * Body of POST /compensations/{id}/schedule (TS `ScheduleCompensationInput`,
 * minus the actor).
 *
 * A SUBSET of a session create: the class is the obligation's own (never
 * accepted here) and a make-up is always a plain scheduled session. Field
 * rules mirror the scheduling domain's own (`SessionRules`) so a value the
 * calendar refuses is refused here with the same field errors.
 */
final class ScheduleCompensationRequest extends ApiFormRequest
{
    protected string $errorCode = 'COMPENSATION_INVALID';

    protected string $errorMessage = 'اطلاعات جلسهٔ جبرانی معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->assertTeacherLinked($this->user());
        app(CompensationPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $fields = SessionRules::fields();

        return [
            'date' => ['required', ...$fields['date']],
            'startTime' => ['required', ...$fields['startTime']],
            'endTime' => ['required', ...$fields['endTime']],
            'roomId' => ['sometimes', 'string', 'max:64', TenantRules::assignableRoom()],
            'teacherId' => ['sometimes', 'string', 'max:64', TenantRules::assignableTeacher()],
            'acknowledgeWarnings' => $fields['acknowledgeWarnings'],
        ];
    }
}
