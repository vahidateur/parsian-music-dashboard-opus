<?php

namespace App\Http\Requests\Progress;

use App\Domain\Progress\ProgressPolicy;
use App\Domain\Progress\ProgressRules;
use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\TenantRules;
use App\Models\ProgressEvent;
use Illuminate\Validation\Rule;

/**
 * Body of POST /progress-events (TS `RecordProgressInput`).
 *
 * `studentId` and `pieceId` are deliberately absent: they are copied from the
 * assignment by the service. Accepting them would let a caller file an event
 * against one student's assignment while attributing it to another.
 *
 * `assignmentId` is validated as a plain string here, NOT for existence. The
 * contract answers an unknown assignment with 404 ASSIGNMENT_NOT_FOUND, which
 * is what the service's tenant-scoped `findOrFail()` throws — and that is also
 * what a foreign organization's id produces, so it leaks nothing.
 *
 * `sessionId` is the one reference that IS checked, via `TenantRules`: the link
 * is provenance for the timeline, but a cross-tenant id must not be storable.
 *
 * DOCUMENTED DEVIATION — the contract bounds these fields with `Number.isFinite`
 * and would therefore accept 72.5 BPM or measure 1.5, but every one of them is
 * stored in an integer column and a fractional measure is not a meaningful
 * value. They are validated as integers so the API answers 422 instead of
 * truncating on write or failing with a 500.
 */
final class StoreProgressEventRequest extends ApiFormRequest
{
    protected string $errorCode = 'PROGRESS_INVALID';

    protected string $errorMessage = 'اطلاعات پیشرفت معتبر نیست.';

    /** Permission before validation: a caller without progress.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(ProgressPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'assignmentId' => ['required', 'string'],
            // The one always-required measurement.
            'mastery' => [
                'required',
                'integer',
                'min:'.ProgressRules::MASTERY_MIN,
                'max:'.ProgressRules::MASTERY_MAX,
            ],
            'tempoBpm' => [
                'sometimes',
                'nullable',
                'integer',
                'min:'.ProgressRules::TEMPO_MIN,
                'max:'.ProgressRules::TEMPO_MAX,
            ],
            'targetTempoBpm' => [
                'sometimes',
                'nullable',
                'integer',
                'min:'.ProgressRules::TEMPO_MIN,
                'max:'.ProgressRules::TEMPO_MAX,
            ],
            'practiceMinutes' => [
                'sometimes',
                'nullable',
                'integer',
                'min:'.ProgressRules::PRACTICE_MINUTES_MIN,
                'max:'.ProgressRules::PRACTICE_MINUTES_MAX,
            ],
            'rangeStart' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.ProgressRules::MAX_RANGE_VALUE],
            'rangeEnd' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.ProgressRules::MAX_RANGE_VALUE],
            'rangeLabel' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_TITLE],
            // Back-datable: the moment of the observation, not of the insert.
            'recordedAt' => ['sometimes', 'nullable', 'date'],
            'teacherNote' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_NOTES],
            'studentNote' => ['sometimes', 'nullable', 'string', 'max:'.ProgressRules::MAX_NOTES],
            // Provenance of the entry, never an authorization input.
            'source' => ['required', Rule::in(ProgressEvent::SOURCES)],
            'sessionId' => ['sometimes', 'nullable', 'string', TenantRules::sessionExists()],
        ];
    }
}
