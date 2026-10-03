<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\AttendanceRecord;

/** Body of POST attendance/bulk (TS BulkRecordInput). One transaction server-side. */
final class BulkAttendanceRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_INVALID';

    protected string $errorMessage = 'اطلاعات ثبت گروهی حضور معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sessionId' => ['required', 'string', 'max:64'],
            'entries' => ['required', 'array', 'min:1', 'max:500'],
            'entries.*.studentId' => ['required', 'string', 'max:64', 'distinct:strict'],
            'entries.*.status' => ['required', 'string', 'in:'.implode(',', AttendanceRecord::STATUSES)],
            // `note` is the contract key (TS `BulkAttendanceEntry.note`);
            // `notes` is accepted as a deprecated alias.
            'entries.*.note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'entries.*.notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'acknowledgeWarnings' => ['sometimes', 'boolean'],
        ];
    }
}
