<?php

namespace App\Http\Requests;

use App\Models\Room;
use App\Models\Teacher;
use Closure;

/** Existence rules for references that must live in the caller's organization. */
final class TenantRules
{
    /**
     * The referenced teacher must exist in the caller's organization. The
     * tenant-scoped model query means another organization's id fails too.
     */
    public static function teacherExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '') {
                return;
            }
            if (! is_string($value) || ! Teacher::query()->whereKey($value)->exists()) {
                $fail('مدرس انتخاب‌شده وجود ندارد.');
            }
        };
    }

    /** Teacher must exist in the organization and not be inactive. */
    public static function assignableTeacher(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $teacher = is_string($value) ? Teacher::query()->whereKey($value)->first() : null;
            if ($teacher === null) {
                $fail('مدرس یافت نشد.');
            } elseif ($teacher->status === 'inactive') {
                $fail('مدرس غیرفعال است.');
            }
        };
    }

    /**
     * Room must exist in the organization and be active. Data integrity only:
     * this is a model query, not room authorization (rooms stay PB-3 blocked).
     */
    public static function assignableRoom(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $room = is_string($value) ? Room::query()->whereKey($value)->first() : null;
            if ($room === null) {
                $fail('اتاق یافت نشد.');
            } elseif (! $room->active) {
                $fail('اتاق غیرفعال است.');
            }
        };
    }
}
