<?php

namespace App\Domain\Roles;

use App\Models\Role;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Authorization\PermissionMatrix;
use App\Support\Iso;
use App\Support\Tenancy\TenantContext;

/**
 * The organization's role matrix: every role is always listed; a missing row
 * is the shipped default, "reset" deletes the row.
 */
final class RoleService
{
    public function __construct(
        private readonly RolePolicy $policy,
        private readonly PermissionMatrix $matrix,
        private readonly TenantContext $tenant,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(User $actor): array
    {
        $this->policy->authorizeRead($actor);
        $rows = Role::query()->get()->keyBy('id');

        return array_map(
            fn (string $role) => $this->record($role, $rows->get($role)),
            $this->matrix->roles(),
        );
    }

    /** @return array<string, mixed> */
    public function get(User $actor, string $id): array
    {
        $this->policy->authorizeRead($actor);
        $this->assertRole($id);

        return $this->record($id, $this->row($id));
    }

    /**
     * @param  array{label?: string, scope?: string, permissions?: list<string>}  $input
     * @return array<string, mixed>
     */
    public function update(User $actor, string $id, array $input): array
    {
        $this->policy->authorizeWrite($actor);
        $this->assertRole($id);

        $current = $this->record($id, $this->row($id));
        $row = $this->row($id) ?? new Role;
        if (! $row->exists) {
            $row->organization_id = $this->tenant->organizationId();
            $row->id = $id;
        }
        $row->label = array_key_exists('label', $input) ? trim((string) $input['label']) : $current['label'];
        $row->scope = array_key_exists('scope', $input) ? trim((string) $input['scope']) : $current['scope'];
        $row->permissions = array_key_exists('permissions', $input)
            ? $this->matrix->filterToVocabulary($input['permissions'])
            : $current['permissions'];
        $row->updated_at = now();
        $row->save();

        return $this->record($id, $this->row($id));
    }

    /** @return array<string, mixed> */
    public function reset(User $actor, string $id): array
    {
        $this->policy->authorizeWrite($actor);
        $this->assertRole($id);

        Role::query()->where('id', $id)->delete();

        return $this->matrix->defaultRecord($id);
    }

    private function row(string $id): ?Role
    {
        return Role::query()->where('id', $id)->first();
    }

    private function assertRole(string $id): void
    {
        if (! $this->matrix->isRole($id)) {
            throw ApiException::notFound('ROLE_NOT_FOUND', "نقش «{$id}» وجود ندارد.");
        }
    }

    /** @return array<string, mixed> RolePolicyRecord wire shape */
    private function record(string $role, ?Role $row): array
    {
        $default = $this->matrix->defaultRecord($role);
        if ($row === null) {
            return $default;
        }

        $label = $row->label !== '' ? $row->label : $default['label'];
        $scope = $row->scope;
        $permissions = is_array($row->permissions)
            ? $this->matrix->filterToVocabulary($row->permissions)
            : $default['permissions'];

        $record = [
            'id' => $role,
            'label' => $label,
            'scope' => $scope,
            'permissions' => $permissions,
            'customized' => $this->matrix->isCustomized($role, $label, $scope, $permissions),
        ];
        if ($row->updated_at !== null) {
            $record['updatedAt'] = Iso::format($row->updated_at);
        }

        return $record;
    }
}
