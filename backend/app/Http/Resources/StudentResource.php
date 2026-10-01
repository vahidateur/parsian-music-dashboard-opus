<?php

namespace App\Http\Resources;

use App\Domain\Students\StudentService;
use App\Models\Student;

/**
 * Wire shape = TS `Student` (camelCase): first-class columns plus the
 * deferred fields stored verbatim in `students.deferred`.
 */
final class StudentResource
{
    /** @return array<string, mixed> */
    public static function toWire(Student $student): array
    {
        $deferred = [...StudentService::DEFERRED_DEFAULTS, ...($student->deferred ?? [])];

        $wire = [
            'id' => $student->id,
            'nationalId' => $student->national_id,
            'name' => $student->name,
        ];
        if (isset($deferred['photoMediaId']) && $deferred['photoMediaId'] !== '') {
            $wire['photoMediaId'] = $deferred['photoMediaId'];
        }
        $wire += [
            'instrument' => $student->instrument,
            'teacherId' => $student->teacher_id ?? '',
            'level' => $student->level,
            'levelStep' => $student->level_step,
            'status' => $student->status,
            'payment' => $student->payment,
            'sessionsUsed' => $deferred['sessionsUsed'],
            'sessionsTotal' => $deferred['sessionsTotal'],
            'attendance' => $deferred['attendance'],
            'progress' => $deferred['progress'],
            'since' => $student->since,
            'age' => $student->age,
            'phone' => $student->phone,
        ];
        if ($student->guardian !== null && $student->guardian !== '') {
            $wire['guardian'] = $student->guardian;
        }
        if (isset($deferred['nextClass']) && is_array($deferred['nextClass'])) {
            $wire['nextClass'] = $deferred['nextClass'];
        }

        return $wire + [
            'lastSeen' => $deferred['lastSeen'],
            'balance' => $deferred['balance'],
            'notes' => $deferred['notes'],
            'activity' => $deferred['activity'],
            'skills' => $deferred['skills'],
        ];
    }
}
