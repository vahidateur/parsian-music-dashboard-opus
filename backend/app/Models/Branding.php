<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The academy's identity record: exactly one row per organization, keyed by
 * `organization_id` (no surrogate id, no `organization_id` column to scope
 * on — like `organizations`, this model IS the tenant's row).
 *
 * @property string $organization_id
 * @property string $academy_name
 * @property string $tagline
 * @property string|null $logo_media_id
 * @property string|null $favicon_media_id
 * @property string $primary_color
 * @property string $accent_color
 * @property string $text_color
 * @property string $persian_font
 */
class Branding extends Model
{
    protected $table = 'branding';

    public $incrementing = false;

    /** The primary key IS the organization: one identity row per academy. */
    protected $primaryKey = 'organization_id';

    protected $keyType = 'string';

    protected $fillable = [
        'organization_id', 'academy_name', 'tagline', 'logo_media_id',
        'favicon_media_id', 'primary_color', 'accent_color', 'text_color',
        'persian_font',
    ];

    protected function casts(): array
    {
        return [];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query)
    {
        return $query->where('organization_id', $this->getOriginal('organization_id') ?? $this->getAttribute('organization_id'));
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
