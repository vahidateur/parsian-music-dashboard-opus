<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use App\Models\PieceAssignment;
use Illuminate\Validation\Rule;

/**
 * Body of PATCH /piece-assignments/{id} (TS `UpdateAssignmentInput`).
 *
 * The contract's update type is
 * `Partial<Pick<PieceAssignment, "status"|"targetDate"|"notes"|"teacherId">>`
 * — so `studentId` and `pieceId` are deliberately NOT accepted. An assignment
 * cannot be moved to a different student or a different piece by patching; it
 * must be closed and a new one created, which is what keeps "one open
 * assignment per (student, piece)" truthful.
 */
final class UpdateAssignmentRequest extends ApiFormRequest
{
    protected string $errorCode = 'ASSIGNMENT_INVALID';

    protected string $errorMessage = 'اطلاعات تخصیص معتبر نیست.';

    /** Permission before validation: a caller without progress.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ProgressPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in(PieceAssignment::STATUSES)],
            'targetDate' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_NOTES],
            'teacherId' => ['sometimes', 'nullable', 'string', TenantRules::teacherExists()],
        ];
    }
}
