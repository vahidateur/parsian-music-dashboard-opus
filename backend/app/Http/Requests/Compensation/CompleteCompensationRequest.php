<?php

namespace App\Http\Requests\Compensation;

use App\Domain\Compensation\CompensationPolicy;
use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST /compensations/{id}/complete. Discharging needs no fields:
 * the decision is the call itself, attributed to the authenticated user.
 */
final class CompleteCompensationRequest extends ApiFormRequest
{
    protected string $errorCode = 'COMPENSATION_INVALID';

    protected string $errorMessage = 'ثبت انجام جبرانی معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(SessionPolicy::class)->assertTeacherLinked($this->user());
        app(CompensationPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
