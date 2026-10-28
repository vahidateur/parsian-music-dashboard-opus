<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * An account that can sign in.
 *
 * Deliberately NOT tenant-scoped by a global scope: authentication must find
 * the user before an organization exists for the request. Every user query in
 * App\Domain\Users\UserService filters by TenantContext explicitly.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property string $email
 * @property string|null $phone
 * @property string $role
 * @property string $status
 * @property string|null $teacher_id
 * @property string|null $password
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * `organization_id` is intentionally absent: it is set by the service from
     * the tenant context, never mass-assigned from input.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'role',
        'status',
        'teacher_id',
        'password',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'organization_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    /** @return BelongsTo<Organization, $this> */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
