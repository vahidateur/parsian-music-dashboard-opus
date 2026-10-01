<?php

namespace App\Http\Requests\Teachers;

use App\Models\Teacher;
use Illuminate\Validation\Rule;

/** Field rules shared by StoreTeacherRequest and UpdateTeacherRequest (camelCase wire keys). */
final class TeacherRules
{
    /**
     * Same character set as the local repository's phone check: the demo
     * dataset stores partially masked numbers ("۰۹۱۲ ··· ۴۵۱۲").
     */
    public const PHONE_REGEX = '/^[0-9۰-۹\s+·-]{6,}$/u';

    /** Fields a create must carry. */
    public const REQUIRED = ['name', 'instrument', 'title', 'since', 'phone', 'status'];

    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        return [
            'name' => ['string', 'min:2', 'max:120'],
            'photoMediaId' => ['nullable', 'string', 'max:64'],
            'instrument' => ['string', 'max:64'],
            'title' => ['string', 'max:120'],
            'students' => ['integer', 'min:0'],
            'utilization' => ['integer', 'min:0', 'max:100'],
            'weeklyHours' => ['integer', 'min:0'],
            'contractHours' => ['integer', 'min:0'],
            'attendanceRate' => ['integer', 'min:0', 'max:100'],
            'retention' => ['integer', 'min:0', 'max:100'],
            'todayClasses' => ['array'],
            'todayClasses.*' => ['string', 'max:64'],
            'availability' => ['array'],
            'availability.*' => ['array'],
            'availability.*.*' => ['integer'],
            'since' => ['string', 'max:32'],
            'phone' => ['string', 'max:32', 'regex:'.self::PHONE_REGEX],
            'status' => ['string', Rule::in(Teacher::STATUSES)],
            'bio' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
