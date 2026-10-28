<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A curriculum for one instrument. An instrument may offer several programs,
 * each with its own number of levels.
 *
 * Composite primary key `(organization_id, id)`, like `roles` and
 * `instruments`. Look rows up with `where('id', …)` (the tenant scope adds
 * the organization); saves and deletes are keyed on both columns.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $instrument_id
 * @property string $name
 * @property string $description
 * @property bool $active
 */
class LearningProgram extends Model
{
    /** @use HasFactory<\Database\Factories\LearningProgramFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'learning_programs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'instrument_id', 'name', 'description', 'active'];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
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
