<?php

namespace App\Domain\Compensation;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class CompensationPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'schedule.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'schedule.write');
    }
}
