<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Models\PieceAssignment;
use Illuminate\Validation\Rule;

/** Query of GET /piece-assignments (snake_case, per `assignmentQuery()`). */
final class ListAssignmentsRequest extends ApiFormRequest
{
    protected string $errorCode = 'ASSIGNMENT_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی تخصیص معتبر نیست.';

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
            'teacher_id' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_IDENTIFIER],
            'status' => ['sometimes', 'nullable', Rule::in(PieceAssignment::STATUSES)],
            'active_only' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
