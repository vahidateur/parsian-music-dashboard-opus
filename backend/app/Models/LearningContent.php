<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One piece of teaching material. Exists once, globally, and is *linked* to
 * levels — never duplicated per student or per level.
 *
 * Composite primary key `(organization_id, id)`, like `roles` and
 * `instruments`.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $title
 * @property string $description
 * @property string $type
 * @property string|null $media_id
 * @property string|null $author
 * @property string|null $teacher_id
 * @property string|null $instrument_id
 * @property string $visibility
 * @property bool $active
 */
class LearningContent extends Model
{
    /** @use HasFactory<\Database\Factories\LearningContentFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'learning_contents';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'title', 'description', 'type', 'media_id', 'author',
        'teacher_id', 'instrument_id', 'visibility', 'active',
    ];

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
