<?php

namespace App\Domain\Chat;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class ChatPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'messages.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'messages.write');
    }
}
