<?php

namespace App\Domain\Teachers;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/** teachers.read / teachers.write, through the single PermissionGate. */
final class TeacherPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'teachers.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'teachers.write');
    }
}
