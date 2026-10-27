<?php

namespace App\Domain\Instruments;

use App\Models\Instrument;
use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class InstrumentPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'instruments.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'instruments.write');
    }
}
