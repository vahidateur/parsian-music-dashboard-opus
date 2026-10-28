<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Where a student currently sits in a program. One active placement per
 * student: re-placing moves this single row and appends to `history`, which
 * records both ends of every move for progression reporting.
 *
 * Composite primary key `(organization_id, id)`, like `roles` and
 * `instruments`, plus a unique `(organization_id, student_id)` guarding the
 * one-placement rule at the database level.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $student_id
 * @property string $program_id
 * @property string $level_id
 * @property \Illuminate\Support\Carbon|null $assigned_at
 * @property list<array<string, mixed>> $history
 */
class StudentPlacement extends Model
{
    /** @use HasFactory<\Database\Factories\StudentPlacementFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'student_placements';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'student_id', 'program_id', 'level_id', 'assigned_at', 'history'];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'history' => 'array',
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
