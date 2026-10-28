<?php

namespace App\Http\Requests\Classes;

use App\Http\Requests\TenantRules;
use Illuminate\Validation\Rule;

/** Field rules shared by StoreClassRequest and UpdateClassRequest (camelCase wire keys). */
final class ClassRules
{
    public const KINDS = ['private', 'group'];

    public const STATUSES = ['active', 'archived'];

    /** Fields a create must carry. */
    public const REQUIRED = [
        'title', 'instrument', 'teacherId', 'roomId', 'kind', 'level', 'days', 'time',
        'duration', 'capacity', 'tuition',
    ];

    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        return [
            'title' => ['string', 'min:2', 'max:120'],
            'instrument' => ['string', 'max:64'],
            'teacherId' => ['string', TenantRules::assignableTeacher()],
            'roomId' => ['string', TenantRules::assignableRoom()],
            'kind' => ['string', Rule::in(self::KINDS)],
            'level' => ['string', 'max:60'],
            'programId' => ['nullable', 'string', 'max:64'],
            'levelId' => ['nullable', 'string', 'max:64'],
            'days' => ['array', 'min:1'],
            'days.*' => ['integer', 'between:0,6'],
            'time' => ['string', 'date_format:H:i'],
            'duration' => ['integer', 'between:15,480'],
            'capacity' => ['integer', 'between:1,500'],
            'tuition' => ['integer', 'min:0'],
            'attendanceAvg' => ['integer', 'between:0,100'],
            'termProgress' => ['integer', 'between:0,100'],
            'status' => ['string', Rule::in(self::STATUSES)],
        ];
    }
}
