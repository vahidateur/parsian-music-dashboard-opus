<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;
use App\Models\AttendanceRecord;

/** Query of GET attendance (snake_case, as ApiAttendanceRepository.toQuery sends). */
final class ListAttendanceRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی حضور معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'session_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'student_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', AttendanceRecord::STATUSES)],
            'since' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'until' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }
}
