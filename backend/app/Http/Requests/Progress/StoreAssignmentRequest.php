<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use App\Models\PieceAssignment;
use Illuminate\Validation\Rule;

/**
 * Body of POST /piece-assignments (TS `CreateAssignmentInput`).
 *
 * Both references are resolved through TENANT-SCOPED rules, not `Rule::exists`
 * — the latter queries the table directly and would happily accept another
 * organization's student or piece. `assignablePiece()` also rejects an inactive
 * piece, which the client contract refuses with a `pieceId` field error.
 */
final class StoreAssignmentRequest extends ApiFormRequest
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
            'studentId' => ['required', 'string', TenantRules::studentExists()],
            'pieceId' => ['required', 'string', TenantRules::assignablePiece()],
            // Provenance for accountability, never an authorization input.
            'teacherId' => ['sometimes', 'nullable', 'string', TenantRules::teacherExists()],
            'status' => ['sometimes', Rule::in(PieceAssignment::STATUSES)],
            'assignedAt' => ['sometimes', 'nullable', 'date'],
            'targetDate' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_NOTES],
        ];
    }
}
