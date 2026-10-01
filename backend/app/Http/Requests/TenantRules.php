<?php

namespace App\Http\Requests;

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
}
