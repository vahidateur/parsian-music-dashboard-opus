<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\AttendancePolicy;
use App\Http\Requests\ApiFormRequest;

/** Query of GET sessions/with-attendance. */
final class WithAttendanceRequest extends ApiFormRequest
{
    protected string $errorCode = 'ATTENDANCE_INVALID';

    protected string $errorMessage = 'پارامترهای جست‌وجوی جلسه‌های ثبت‌شده معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(AttendancePolicy::class)->authorizeRead($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'class_id' => ['sometimes', 'nullable', 'string', 'max:64'],
        ];
    }
}
