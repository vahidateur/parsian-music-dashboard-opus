<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\AttendanceRecord;

/** Body of POST attendance (TS RecordAttendanceInput). */
final class StoreAttendanceRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_INVALID';

    protected string $errorMessage = 'اطلاعات حضور و غیاب معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sessionId' => ['required', 'string', 'max:64'],
            'studentId' => ['required', 'string', 'max:64'],
            'status' => ['required', 'string', 'in:'.implode(',', AttendanceRecord::STATUSES)],
            // `note` is the contract key (TS `RecordAttendanceInput.note`);
            // `notes` is accepted as a deprecated alias. Without this the
            // operator's note is validated away and silently dropped — the
            // request carries `note` and the service reads `notes`.
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'acknowledgeWarnings' => ['sometimes', 'boolean'],
        ];
    }
}
