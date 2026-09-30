<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The tenant. Its id is never accepted from, nor emitted on, the API wire.
 *
 * @property string $id
 * @property string $slug
 * @property string $name
 * @property string $status
 */
class Organization extends Model
{
    /** @use HasFactory<\Database\Factories\OrganizationFactory> */
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'slug', 'name', 'status'];
}
