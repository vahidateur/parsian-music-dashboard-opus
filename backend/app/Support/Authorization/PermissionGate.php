<?php

namespace App\Support\Authorization;

use App\Models\User;
use App\Support\Api\ApiException;
use InvalidArgumentException;

/**
 * The ONE place the backend checks a permission.
 *
 * Domain policies call this; nothing else inspects roles or permission lists.
 * Asking about a permission outside the vocabulary is a programming error and
 * throws instead of silently allowing or denying.
 */
final class PermissionGate
{
    public function __construct(private readonly PermissionMatrix $matrix) {}

    public function allows(User $user, string $permission): bool
    {
        if (! $this->matrix->isPermission($permission)) {
            throw new InvalidArgumentException("Unknown permission [$permission].");
        }

        return in_array($permission, $this->matrix->permissionsFor($user), true);
    }

    public function authorize(User $user, string $permission): void
    {
        if (! $this->allows($user, $permission)) {
            throw new ApiException(403, 'FORBIDDEN', 'شما دسترسی لازم برای این کار را ندارید.', [], ['permission' => $permission]);
        }
    }
}
