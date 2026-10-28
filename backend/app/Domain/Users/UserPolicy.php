<?php

namespace App\Domain\Users;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/** users.read / users.write, through the single PermissionGate. */
final class UserPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'users.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'users.write');
    }
}
