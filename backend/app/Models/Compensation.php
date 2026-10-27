<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One private-lesson make-up obligation of an organization.
 *
 * Composite primary key `(organization_id, id)`, like the other domains.
 * Pair-lifetime uniqueness is a database unique key on
 * `(organization_id, original_session_id, student_id)` — never an upsert.
 *
 * `attempts` is the append-only booking ledger (JSON); every derived answer
 * (status, current attempt, broken chain) is computed on read from these
 * facts plus scheduling's own rows.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $original_session_id
 * @property string $class_id
 * @property string $student_id
 * @property string $reason
 * @property string $required_at
 * @property string $required_by_user_id
 * @property list<array{sessionId: string, scheduledAt: string, scheduledByUserId: string}> $attempts
 * @property string|null $original_attendance_acknowledged_at
 * @property string|null $completed_at
 * @property string|null $completed_by_user_id
 */
class Compensation extends Model
{
    /** @use HasFactory<\Database\Factories\CompensationFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'compensations';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'original_session_id', 'class_id', 'student_id', 'reason',
        'required_at', 'required_by_user_id', 'attempts',
        'original_attendance_acknowledged_at', 'completed_at', 'completed_by_user_id',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'attempts' => 'array',
            'required_at' => 'datetime',
            'original_attendance_acknowledged_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query)
    {
        return $query
            ->where('organization_id', $this->getOriginal('organization_id') ?? $this->getAttribute('organization_id'))
            ->where('id', $this->getOriginal('id') ?? $this->getAttribute('id'));
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSelectQuery($query)
    {
        return $this->setKeysForSaveQuery($query);
    }
}
