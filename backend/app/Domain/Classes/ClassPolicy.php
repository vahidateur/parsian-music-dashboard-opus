<?php

namespace App\Domain\Classes;

use App\Models\User;
use App\Support\Authorization\PermissionGate;

/**
 * classes.read / classes.write, through the single PermissionGate.
 *
 * Class reads are org-wide (T-02 governs student reads only). Enrollments use
 * the same two permissions (no enrollment permission exists in the vocabulary).
 */
final class ClassPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function authorizeRead(User $actor): void
    {
        $this->gate->authorize($actor, 'classes.read');
    }

    public function authorizeWrite(User $actor): void
    {
        $this->gate->authorize($actor, 'classes.write');
    }
}
