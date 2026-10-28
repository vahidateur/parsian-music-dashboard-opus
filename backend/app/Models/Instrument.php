<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A teachable instrument (or subject, e.g. theory) offered by an organization.
 *
 * The table's primary key is `(organization_id, id)` where `id === slug`, so
 * two organizations may both define `piano` or `santoor` without colliding.
 * Look rows up with `where('id', …)` (the tenant global scope adds
 * `organization_id`); saves and deletes are keyed on both columns below,
 * matching `App\Models\Role`.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $slug
 * @property string $name
 * @property string $description
 * @property string|null $image_id
 * @property bool $active
 * @property int $sort_order
 */
class Instrument extends Model
{
    /** @use HasFactory<\Database\Factories\InstrumentFactory> */
    use BelongsToOrganization, HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'slug', 'name', 'description', 'image_id', 'active', 'sort_order',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
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
