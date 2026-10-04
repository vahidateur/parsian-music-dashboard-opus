<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;

/** Query of GET /progress-events (snake_case, per the client's query builder). */
final class ListProgressEventsRequest extends ApiFormRequest
{
    protected string $errorCode = 'PROGRESS_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی پیشرفت معتبر نیست.';

    /** Permission before validation: a caller without progress.read gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ProgressPolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'student_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'piece_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'assignment_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'since' => ['sometimes', 'nullable', 'date'],
            'until' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
