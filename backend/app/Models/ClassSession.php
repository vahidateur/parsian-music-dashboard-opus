<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One dated occurrence of a class (table `sessions`).
 *
 * Named `ClassSession` because `Session` collides with the framework's session
 * facade in an unnamespaced import, and because
 * `src/domains/scheduling/types.ts` already uses `ClassSession` for the
 * timeline projection. This model is the `Session` entity of that file.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $class_id
 * @property string $date
 * @property string $start_time
 * @property string $end_time
 * @property string $teacher_id
 * @property string $room_id
 * @property string $status
 * @property string $origin
 * @property string|null $cancel_reason
 * @property string|null $rescheduled_from_id
 * @property string|null $rescheduled_to_id
 * @property string|null $notes
 */
class ClassSession extends Model
{
    /** @use HasFactory<\Database\Factories\ClassSessionFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['scheduled', 'cancelled', 'completed'];

    public const ORIGINS = ['generated', 'manual'];

    protected $table = 'sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'class_id', 'date', 'start_time', 'end_time', 'teacher_id', 'room_id',
        'status', 'origin', 'cancel_reason', 'rescheduled_from_id', 'rescheduled_to_id', 'notes',
    ];

    protected $hidden = ['organization_id'];

    /** Exclusive-end overlap: [aStart, aEnd) intersects [bStart, bEnd). */
    public function overlapsTime(string $startTime, string $endTime): bool
    {
        return $this->start_time < $endTime && $startTime < $this->end_time;
    }

    /** @return BelongsTo<AcademyClass, $this> */
    public function academyClass(): BelongsTo
    {
        return $this->belongsTo(AcademyClass::class, 'class_id');
    }

    /** @return HasMany<AttendanceRecord, $this> */
    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'session_id');
    }
}
