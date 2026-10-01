<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST sessions/{id}/cancel. A reason is REQUIRED: a cancellation
 * without one is unauditable, and this is the record a dispute turns on.
 */
final class CancelSessionRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_CANCEL_REASON_REQUIRED';

    protected string $errorMessage = 'دلیل لغو باید نوشته شود.';

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
        return [
            'reason' => ['required', 'string', 'min:2', 'max:500'],
        ];
    }
}
