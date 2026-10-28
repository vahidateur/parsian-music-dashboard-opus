<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One rung of a program. `order` is 1-based and unique within its program;
 * it — not the id — defines progression, so levels can be renamed without
 * breaking eligibility.
 *
 * Composite primary key `(organization_id, id)`, like `roles` and
 * `instruments`.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $program_id
 * @property int $order
 * @property string $name
 * @property string $description
 * @property list<string> $objectives
 * @property string|null $notes
 * @property bool $active
 * @property bool $exclusive
 * @property list<string> $prerequisite_level_ids
 */
class LearningLevel extends Model
{
    /** @use HasFactory<\Database\Factories\LearningLevelFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'learning_levels';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'program_id', 'order', 'name', 'description', 'objectives',
        'notes', 'active', 'exclusive', 'prerequisite_level_ids',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'objectives' => 'array',
            'active' => 'boolean',
            'exclusive' => 'boolean',
            'prerequisite_level_ids' => 'array',
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
