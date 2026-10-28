<?php

namespace App\Http\Resources;

use App\Models\AcademyClass;

/**
 * Wire shape = TS `AcademyClass` (camelCase), read unmapped by
 * ApiClassRepository. Expects a model loaded through
 * ClassService::withProjection (enrolled_count, waitlist_count and the active
 * enrollments relation); the projection is never stored.
 */
final class ClassResource
{
    /** @return array<string, mixed> */
    public static function toWire(AcademyClass $class): array
    {
        $wire = [
            'id' => $class->id,
            'status' => $class->status,
            'title' => $class->title,
            'instrument' => $class->instrument,
            'teacherId' => $class->teacher_id,
            'roomId' => $class->room_id,
            'kind' => $class->kind,
            'level' => $class->level,
        ];
        if ($class->program_id !== null && $class->program_id !== '') {
            $wire['programId'] = $class->program_id;
        }
        if ($class->level_id !== null && $class->level_id !== '') {
            $wire['levelId'] = $class->level_id;
        }

        return [
            ...$wire,
            'days' => $class->days ?? [],
            'time' => $class->time,
            'duration' => $class->duration,
            'enrolled' => (int) ($class->enrolled_count ?? 0),
            'capacity' => $class->capacity,
            'attendanceAvg' => $class->attendance_avg,
            'waitlist' => (int) ($class->waitlist_count ?? 0),
            'tuition' => $class->tuition,
            'termProgress' => $class->term_progress,
            'studentIds' => $class->relationLoaded('enrollments')
                ? $class->enrollments->pluck('student_id')->values()->all()
                : [],
        ];
    }
}
