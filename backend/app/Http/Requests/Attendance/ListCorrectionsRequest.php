<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;

/** Query of GET attendance/corrections. */
final class ListCorrectionsRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی اصلاحات معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'attendance_record_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'session_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'student_id' => ['sometimes', 'nullable', 'string', 'max:64'],
        ];
    }
}
