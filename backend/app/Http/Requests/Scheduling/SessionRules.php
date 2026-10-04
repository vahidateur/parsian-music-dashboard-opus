<?php

namespace App\Http\Requests\Scheduling;

use App\Models\ClassSession;
use Illuminate\Validation\Rule;

/** Field rules shared by the session write requests (camelCase wire keys). */
final class SessionRules
{
    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        return [
            'classId' => ['string', 'max:64'],
            'date' => ['date_format:Y-m-d'],
            'startTime' => ['date_format:H:i'],
            'endTime' => ['date_format:H:i'],
            'teacherId' => ['string', 'max:64'],
            'roomId' => ['string', 'max:64'],
            'status' => ['string', Rule::in(ClassSession::STATUSES)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'acknowledgeWarnings' => ['sometimes', 'boolean'],
        ];
    }
}
