<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\AttendanceRecord;

/**
 * Body of POST attendance/{id}/correct (TS CorrectionInput). A reason is
 * REQUIRED: a change with no stated reason is not an audit trail.
 */
final class CorrectAttendanceRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_CORRECTION_REASON_REQUIRED';

    protected string $errorMessage = 'دلیل اصلاح باید نوشته شود.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:'.implode(',', AttendanceRecord::STATUSES)],
            'reason' => ['required', 'string', 'min:2', 'max:500'],
        ];
    }
}
