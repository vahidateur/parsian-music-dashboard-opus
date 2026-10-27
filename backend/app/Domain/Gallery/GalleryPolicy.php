<?php

namespace App\Domain\Gallery;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class GalleryPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'gallery.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'gallery.write');
    }
}
