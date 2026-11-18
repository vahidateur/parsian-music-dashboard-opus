<?php

namespace App\Http\Resources;

use App\Models\AcademyClass;
use App\Models\User;

/**
 * Wire shape = TS `AcademyClass` (camelCase), read unmapped by
 * ApiClassRepository. Expects a model loaded through
 * ClassService::withProjection (enrolled_count, waitlist_count and the active
 * enrollments relation); the projection is never stored.
 *
 * T-02-B (B2): a teacher only reaches classes they own. The class response also
 * redacts the financial fields (`tuition`) and the inactive-enrollment count
 * (`waitlist`); the active roster (`studentIds`, `enrolled`) stays because it is
 * exactly the teacher's assigned students.
 *
 * Visibility is an allow-list, not "everyone except teacher": a missing actor or
 * a role outside the permission vocabulary fails closed and omits the same
 * fields, so an unresolved identity can never widen what is serialized.
 */
final class ClassResource
{
    /** Roles that may see the financial and student-derived class fields. */
    private const FINANCIAL_ROLES = ['administrator', 'manager', 'staff', 'accountant'];

    /** @return array<string, mixed> */
    public static function toWire(AcademyClass $class, ?User $actor = null): array
    {
        $seesFinancials = in_array($actor?->role, self::FINANCIAL_ROLES, true);

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

        $wire += [
            'days' => $class->days ?? [],
            'time' => $class->time,
            'duration' => $class->duration,
            'enrolled' => (int) ($class->enrolled_count ?? 0),
            'capacity' => $class->capacity,
            'studentIds' => $class->relationLoaded('enrollments')
                ? $class->enrollments->pluck('student_id')->values()->all()
                : [],
        ];

        if ($seesFinancials) {
            $wire['attendanceAvg'] = $class->attendance_avg;
            $wire['waitlist'] = (int) ($class->waitlist_count ?? 0);
            $wire['tuition'] = $class->tuition;
            $wire['termProgress'] = $class->term_progress;
        }

        return $wire;
    }
}
