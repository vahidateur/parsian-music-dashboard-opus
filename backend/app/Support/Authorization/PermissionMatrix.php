<?php

namespace App\Support\Authorization;

use App\Models\Role;
use App\Models\User;

/**
 * Role → permission resolution, mirroring `permissionsForRole` in
 * src/domains/auth/permissions.ts: an organization's saved role row wins,
 * otherwise the shipped default matrix in config/permissions.php applies.
 *
 * Stored permissions are always filtered to the vocabulary, so a row can never
 * grant an id the product does not define.
 */
final class PermissionMatrix
{
    /** @return list<string> */
    public function vocabulary(): array
    {
        return config('permissions.vocabulary');
    }

    /** @return list<string> */
    public function roles(): array
    {
        return config('permissions.roles');
    }

    public function isPermission(string $permission): bool
    {
        return in_array($permission, $this->vocabulary(), true);
    }

    public function isRole(string $role): bool
    {
        return in_array($role, $this->roles(), true);
    }

    /** @return list<string> */
    public function defaultPermissions(string $role): array
    {
        return array_values(config("permissions.defaults.$role", []));
    }

    /**
     * @return array{id: string, label: string, scope: string, permissions: list<string>, customized: bool}
     */
    public function defaultRecord(string $role): array
    {
        return [
            'id' => $role,
            'label' => (string) config("permissions.labels.$role", $role),
            'scope' => (string) config("permissions.scopes.$role", ''),
            'permissions' => $this->defaultPermissions($role),
            'customized' => false,
        ];
    }

    /**
     * Same rule as `sameAsDefault` in src/domains/auth/roleRepository.ts.
     *
     * @param  list<string>  $permissions
     */
    public function isCustomized(string $role, string $label, string $scope, array $permissions): bool
    {
        $default = $this->defaultRecord($role);
        $same = $label === $default['label']
            && $scope === $default['scope']
            && count($permissions) === count($default['permissions'])
            && array_diff($permissions, $default['permissions']) === [];

        return ! $same;
    }

    /**
     * @param  array<mixed>  $permissions
     * @return list<string>
     */
    public function filterToVocabulary(array $permissions): array
    {
        $vocabulary = $this->vocabulary();
        $kept = [];
        foreach ($permissions as $permission) {
            if (is_string($permission) && in_array($permission, $vocabulary, true) && ! in_array($permission, $kept, true)) {
                $kept[] = $permission;
            }
        }

        return $kept;
    }

    /** The permissions the principal holds in its own organization. */
    public function permissionsFor(User $user): array
    {
        if (! $this->isRole((string) $user->role)) {
            return [];
        }

        // Explicit organization filter: this runs during login, before the
        // tenant context exists, and the organization is the principal's own.
        $row = Role::withoutGlobalScopes()
            ->where('organization_id', $user->organization_id)
            ->where('id', $user->role)
            ->first();

        if ($row !== null && is_array($row->permissions)) {
            return $this->filterToVocabulary($row->permissions);
        }

        return $this->defaultPermissions($user->role);
    }
}
