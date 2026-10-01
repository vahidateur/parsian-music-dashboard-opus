<?php

namespace App\Http\Resources;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceRecord;
use App\Support\Iso;

/**
 * Wire shapes = the TS `AttendanceRecord` / `AttendanceCorrection`
 * (camelCase), read unmapped by ApiAttendanceRepository.
 *
 * `recordedBy` / `changedBy` are exposed as the actor's display name because
 * that is what the contract ships, but the database stores the user ID — the
 * audit trail stays referential even when a person is renamed.
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
            'recordedBy' => $record->relationLoaded('recorder') && $record->recorder !== null
                ? (string) $record->recorder->name
                : '',
            'recordedAt' => Iso::format($record->created_at),
        ];

        if ($record->notes !== null && $record->notes !== '') {
            $wire['notes'] = $record->notes;
        }

        return [...$wire, 'updatedAt' => Iso::format($record->updated_at)];
    }

    /** @return array<string, mixed> */
    public static function correctionToWire(AttendanceCorrection $correction): array
    {
        return [
            'id' => $correction->id,
            'recordId' => $correction->record_id,
            'sessionId' => $correction->session_id,
            'studentId' => $correction->student_id,
            'previousStatus' => $correction->previous_status,
            'newStatus' => $correction->new_status,
            'reason' => $correction->reason,
            'changedBy' => $correction->relationLoaded('editor') && $correction->editor !== null
                ? (string) $correction->editor->name
                : '',
            'changedAt' => Iso::format($correction->created_at),
        ];
    }

    /** @return array<string, mixed> TS `SessionAttendance` */
    public static function sessionAttendanceToWire(string $sessionId, iterable $records, iterable $corrections): array
    {
        return [
            'sessionId' => $sessionId,
            'records' => array_map(self::toWire(...), is_array($records) ? $records : iterator_to_array($records)),
            'corrections' => array_map(self::correctionToWire(...), is_array($corrections) ? $corrections : iterator_to_array($corrections)),
        ];
    }
}
