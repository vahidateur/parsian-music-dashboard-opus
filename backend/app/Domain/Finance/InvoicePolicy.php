<?php

namespace App\Domain\Finance;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

final class InvoicePolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'finance.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'finance.write');
    }

    public function authorizePay(User $actor): void
    {
        $this->gate->authorize($actor, 'finance.pay');
    }
}
