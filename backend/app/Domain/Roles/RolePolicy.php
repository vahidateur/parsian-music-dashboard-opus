<?php

namespace App\Domain\Roles;

use App\Models\User;
use App\Support\Authorization\PermissionGate;
use App\Support\Tenancy\TenantContext;

/**
 * Read: any authenticated member of the organization. No permission id names
 * role-read (roles.read does NOT exist and is not invented); the shell reads the
 * matrix in every session (useRolePolicySync) and it only reveals vocabulary
 * /auth/me already discloses. Implementation-level choice, flagged for owner
 * review in docs/engineering/BACKEND_STATUS.md.
 *
 * Write: roles.write through the single PermissionGate.
 */
final class RolePolicy
{
    public function __construct(
        private readonly PermissionGate $gate,
        private readonly TenantContext $tenant,
    ) {}

    public function authorizeRead(User $actor): void
    {
        if ($actor->organization_id !== $this->tenant->organizationId()) {
            throw TenantContext::unresolved();
        }
    }

    public function authorizeWrite(User $actor): void
    {
        $this->authorizeRead($actor);
        $this->gate->authorize($actor, 'roles.write');
    }
}
