<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * An organization's saved role record (label, scope, permission override).
 *
 * The table's primary key is (organization_id, id). Eloquent has no composite
 * keys, so look rows up with `where('id', …)` (the tenant scope adds the
 * organization) rather than `find()`; saves and deletes are keyed on both
 * columns below.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $label
 * @property string $scope
 * @property list<string>|null $permissions
 */
class Role extends Model
{
    use BelongsToOrganization;

    const CREATED_AT = null;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'label', 'scope', 'permissions'];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'updated_at' => 'datetime',
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
