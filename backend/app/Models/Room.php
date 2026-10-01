<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property string $kind
 * @property int $capacity
 * @property int $occupancy
 * @property bool $active
 */
class Room extends Model
{
    /** @use HasFactory<\Database\Factories\RoomFactory> */
    use BelongsToOrganization, HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['name', 'kind', 'capacity', 'occupancy', 'active'];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'occupancy' => 'integer',
            'active' => 'boolean',
        ];
    }
}
