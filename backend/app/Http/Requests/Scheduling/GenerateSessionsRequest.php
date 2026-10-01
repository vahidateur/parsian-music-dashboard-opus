<?php

namespace App\Http\Requests\Scheduling;

use App\Domain\Scheduling\SessionPolicy;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST sessions/generate (TS GenerateInput). `?preview=1` is read by
 * the controller, not validated here: the body is identical for a preview and a
 * commit, and the authorization differs, not the payload.
 */
final class GenerateSessionsRequest extends ApiFormRequest
{
    protected string $errorCode = 'SESSION_GENERATION_WINDOW_INVALID';

    protected string $errorMessage = 'بازهٔ تولید جلسه معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        // Preview is read-only, so schedule.read is enough; the commit path
        // re-authorizes with schedule.write inside the service.
        app(SessionPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'classId' => ['required', 'string', 'max:64'],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d'],
            'confirmUpdates' => ['sometimes', 'boolean'],
        ];
    }
}
