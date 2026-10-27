<?php

namespace App\Domain\Branding;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class BrandingPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'branding.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'branding.write');
    }
}
