<?php

namespace App\Http\Resources;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Support\Iso;

/**
 * Wire shapes = the TS `AttendanceRecord` / `AttendanceCorrection`
 * (camelCase), read unmapped by ApiAttendanceRepository.
 *
 * CONTRACT AUTHORITY (resolved 2026-10-04). The TS types in
 * `src/domains/attendance/types.ts` are the authoritative wire contract. This
 * class previously emitted `recordedBy` / `changedBy` as the actor's DISPLAY
 * NAME and justified it with "that is what the contract ships". That claim was
 * false, and it contradicted this file's own first line. The contract ships a
 * USER ID:
 *
 *   - DECISIONS.md §12 (owner decision, in force, in front of users):
 *     "Provenance comes from the authenticated principal (`recorderId =
 *     user?.id`) ... so `changedByUserId` is a fact about the session rather
 *     than a claim by the operator."
 *   - DECISIONS.md §24 and GOVERNANCE_CHECKPOINT.md both name
 *     `recordedByUserId` as provenance, not ACL.
 *   - OPEN_ITEMS.md records the owner requirement that the recorder "must come
 *     from the authenticated user rather than a fixture name".
 *   - `AttendanceService` states the same rule verbatim and already implements
 *     it: `recorded_by_user_id` / `changed_by_user_id` are set from
 *     `$actor->id`, never from a request body.
 *   - The database column is `recorded_by_user_id`, so the ID is available
 *     here with no schema change.
 *
 * The four deviating keys are therefore corrected. The previous `recordedBy` /
 * `changedBy` / `notes` / `recordId` keys are RETAINED as deprecated aliases so
 * existing backend assertions keep passing; they are display conveniences, and
 * no consumer may treat them as the canonical provenance field.
 */
final class AttendanceResource
{
    /** @return array<string, mixed> */
    public static function toWire(AttendanceRecord $record): array
    {
        $wire = [
            'id' => $record->id,
            'sessionId' => $record->session_id,
            'studentId' => $record->student_id,
            'status' => $record->status,
            // Canonical provenance: the authenticated user's ID (§12).
            'recordedByUserId' => (string) $record->recorded_by_user_id,
            // Deprecated display alias, retained for existing assertions.
            'recordedBy' => $record->relationLoaded('recorder') && $record->recorder !== null
                ? (string) $record->recorder->name
                : '',
            'recordedAt' => Iso::format($record->created_at),
        ];

        if ($record->notes !== null && $record->notes !== '') {
            // `note` is the contract key; `notes` is the deprecated alias.
            $wire['note'] = $record->notes;
            $wire['notes'] = $record->notes;
        }

        return [...$wire, 'updatedAt' => Iso::format($record->updated_at)];
    }

    /** @return array<string, mixed> */
    public static function correctionToWire(AttendanceCorrection $correction): array
    {
        return [
            'id' => $correction->id,
            // `attendanceRecordId` is the contract key; `recordId` is the
            // deprecated alias.
            'attendanceRecordId' => $correction->record_id,
            'recordId' => $correction->record_id,
            'sessionId' => $correction->session_id,
            'studentId' => $correction->student_id,
            'previousStatus' => $correction->previous_status,
            'newStatus' => $correction->new_status,
            'reason' => $correction->reason,
            // Canonical provenance: the authenticated user's ID (§12).
            'changedByUserId' => (string) $correction->changed_by_user_id,
            // Deprecated display alias, retained for existing assertions.
            'changedBy' => $correction->relationLoaded('editor') && $correction->editor !== null
                ? (string) $correction->editor->name
                : '',
            'changedAt' => Iso::format($correction->created_at),
        ];
    }

    /**
     * TS `SessionAttendance`.
     *
     * The contract ships a PRE-JOINED view — the roster with each student's
     * mark attached, plus the derived counts and the lock flag — not the raw
     * record and correction lists. The backend previously returned only
     * `{ sessionId, records, corrections }`, which no frontend consumer can
     * read as `SessionAttendance`. Both shapes are now returned: the contract
     * keys are canonical, the raw lists are retained for existing consumers.
     *
     * @param  list<array{studentId: string, studentName: string, photoMediaId?: string}>  $roster
     * @return array<string, mixed>
     */
    public static function sessionAttendanceToWire(ClassSession $session, iterable $records, iterable $corrections, array $roster = []): array
    {
        $wireRecords = array_map(self::toWire(...), is_array($records) ? $records : iterator_to_array($records));

        $byStudent = [];
        foreach ($wireRecords as $wire) {
            $byStudent[$wire['studentId']] = $wire;
        }

        $rows = [];
        $recorded = 0;
        foreach ($roster as $student) {
            $record = $byStudent[$student['studentId']] ?? null;

            // Absent key, never a placeholder: "not taken" and "absent" are
            // different facts, and a disputed absence turns on exactly that
            // distinction — the same rule LocalAttendanceRepository applies.
            if ($record === null) {
                $rows[] = ['student' => $student];
                continue;
            }

            $recorded++;
            $rows[] = ['student' => $student, 'record' => $record];
        }

        return [
            'sessionId' => $session->id,
            // ---- contract keys (TS `SessionAttendance`) ----
            'roster' => $rows,
            'recorded' => $recorded,
            'expected' => count($rows),
            'locked' => $session->status === 'cancelled',
            // ---- retained for existing consumers ----
            'records' => $wireRecords,
            'corrections' => array_map(self::correctionToWire(...), is_array($corrections) ? $corrections : iterator_to_array($corrections)),
        ];
    }
}
