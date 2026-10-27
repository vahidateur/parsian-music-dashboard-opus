<?php

namespace App\Http\Requests\Compensation;

use App\Domain\Compensation\CompensationPolicy;
use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST /compensations (TS `RegisterCompensationInput`, minus the
 * actor: the server records the authenticated user, never a client-supplied
 * sender — the same rule as chat's `from`).
 */
final class StoreCompensationRequest extends ApiFormRequest
{
    protected string $errorCode = 'COMPENSATION_INVALID';

    protected string $errorMessage = 'اطلاعات جبرانی معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        // PB-1 (resolved 2026-10-02, option A) is a scope question and is
        // answered BEFORE the permission check, so an unlinked teacher gets
        // OWNER_DECISION_REQUIRED_PB1 rather than a bare FORBIDDEN — the same
        // precedence the shipped sessions slice uses.
        app(SessionPolicy::class)->assertTeacherLinked($this->user());
        app(CompensationPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'originalSessionId' => ['required', 'string', 'max:64'],
            'studentId' => ['required', 'string', 'max:64'],
            'reason' => ['required', 'string', 'max:2000'],
            'acknowledgedOriginalAttendance' => ['sometimes', 'boolean'],
        ];
    }
}
