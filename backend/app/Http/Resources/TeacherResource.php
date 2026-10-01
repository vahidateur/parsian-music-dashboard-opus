<?php

namespace App\Http\Resources;

use App\Models\Teacher;

/** Wire shape = TS `Teacher` (camelCase), read unmapped by ApiTeacherRepository. */
final class TeacherResource
{
    /** @return array<string, mixed> */
    public static function toWire(Teacher $teacher): array
    {
        $wire = [
            'id' => $teacher->id,
            'name' => $teacher->name,
        ];
        if ($teacher->photo_media_id !== null && $teacher->photo_media_id !== '') {
            $wire['photoMediaId'] = $teacher->photo_media_id;
        }

        return [
            ...$wire,
            'instrument' => $teacher->instrument,
            'title' => $teacher->title,
            'students' => $teacher->students,
            'utilization' => $teacher->utilization,
            'weeklyHours' => $teacher->weekly_hours,
            'contractHours' => $teacher->contract_hours,
            'attendanceRate' => $teacher->attendance_rate,
            'retention' => $teacher->retention,
            'todayClasses' => $teacher->today_classes ?? [],
            'availability' => $teacher->availability ?? [],
            'since' => $teacher->since,
            'phone' => $teacher->phone,
            'status' => $teacher->status,
            'bio' => $teacher->bio,
        ];
    }
}
