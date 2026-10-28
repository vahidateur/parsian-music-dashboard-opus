<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One image row in a showcase album. The bytes live in the media domain;
 * this row only names the asset.
 *
 * Composite primary key `(organization_id, id)`, like `roles`,
 * `instruments` and the learning tables. `sort_order` is 0-based and
 * contiguous within the album — it, not the id, defines the display order.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $album_id
 * @property string $media_id
 * @property string $caption
 * @property string $alt
 * @property int $sort_order
 */
class GalleryImage extends Model
{
    /** @use HasFactory<\Database\Factories\GalleryImageFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'gallery_images';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'album_id', 'media_id', 'caption', 'alt', 'sort_order',
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
