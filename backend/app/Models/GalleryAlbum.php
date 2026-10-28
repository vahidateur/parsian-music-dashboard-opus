<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One showcase album of an organization.
 *
 * Composite primary key `(organization_id, id)`, like `roles`,
 * `instruments` and the learning tables.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $title
 * @property string $description
 * @property string|null $cover_media_id
 * @property int $sort_order
 */
class GalleryAlbum extends Model
{
    /** @use HasFactory<\Database\Factories\GalleryAlbumFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'gallery_albums';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'title', 'description', 'cover_media_id', 'sort_order',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
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
