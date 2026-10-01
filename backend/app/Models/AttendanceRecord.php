<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $session_id
 * @property string $student_id
 * @property string $status
 * @property string|null $notes
 * @property string $recorded_by_user_id
 */
class AttendanceRecord extends Model
{
    /** @use HasFactory<\Database\Factories\AttendanceRecordFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['present', 'absent', 'late', 'excused'];

    /** Statuses that count as "attended" — the TS `ATTENDED_STATUSES`. */
    public const ATTENDED = ['present', 'late'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['session_id', 'student_id', 'status', 'notes', 'recorded_by_user_id'];

    protected $hidden = ['organization_id'];

    public function attended(): bool
    {
        return in_array($this->status, self::ATTENDED, true);
    }

    /** @return BelongsTo<ClassSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }
}
