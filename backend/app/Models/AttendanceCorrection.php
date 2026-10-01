<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An INSERT-ONLY audit log row. There is deliberately no `delete()` or `save()`
 * path in `AttendanceService`: a correction is appended, never rewritten.
 *
 * @property string $id
 * @property string $record_id
 * @property string $session_id
 * @property string $student_id
 * @property string $previous_status
 * @property string $new_status
 * @property string $reason
 * @property string $changed_by_user_id
 */
class AttendanceCorrection extends Model
{
    use BelongsToOrganization;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'record_id', 'session_id', 'student_id', 'previous_status', 'new_status', 'reason', 'changed_by_user_id',
    ];

    protected $hidden = ['organization_id'];

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
