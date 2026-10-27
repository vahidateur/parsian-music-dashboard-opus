<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The many-to-many edge between levels and content. One content item can serve
 * several levels (and several programs) without being copied.
 *
 * Composite primary key `(organization_id, id)`, like `roles` and
 * `instruments`.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $level_id
 * @property string $content_id
 * @property int $sort_order
 */
class LevelContentLink extends Model
{
    /** @use HasFactory<\Database\Factories\LevelContentLinkFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'level_content_links';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'level_id', 'content_id', 'sort_order'];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
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
