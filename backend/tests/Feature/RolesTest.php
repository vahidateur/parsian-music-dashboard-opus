<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class RolesTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/roles')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_list_returns_all_five_defaults(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $response = $this->getJson('/api/v1/roles')->assertOk()->assertJsonPath('meta.total', 5);

        $this->assertSame(config('permissions.roles'), array_column($response->json('data'), 'id'));
        foreach ($response->json('data') as $record) {
            $this->assertSame(config('permissions.defaults.'.$record['id']), $record['permissions']);
            $this->assertSame(config('permissions.labels.'.$record['id']), $record['label']);
            $this->assertSame(config('permissions.scopes.'.$record['id']), $record['scope']);
            $this->assertFalse($record['customized']);
        }
    }

    public function test_get_unknown_role_is_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/roles/owner')->assertStatus(404)->assertJsonPath('error.code', 'ROLE_NOT_FOUND');
        $this->patchJson('/api/v1/roles/owner', ['label' => 'Owner'])->assertStatus(404);
        $this->postJson('/api/v1/roles/owner/reset')->assertStatus(404);
    }

    public function test_non_admin_cannot_patch_or_reset(): void
    {
        $this->actingAsRole('manager');

        $this->patchJson('/api/v1/roles/staff', ['label' => 'Front desk'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'roles.write');
        $this->postJson('/api/v1/roles/staff/reset')->assertStatus(403);
    }

    public function test_granting_a_permission_changes_server_enforcement(): void
    {
        $admin = $this->actingAsRole('administrator');
        $staff = $this->makeUser('staff');
        $staffToken = $this->tokenFor($staff);

        $this->useToken($staffToken);
        $this->getJson('/api/v1/users')->assertStatus(403);

        $this->useToken($this->tokenFor($admin));
        $permissions = [...config('permissions.defaults.staff'), 'users.read'];
        $this->patchJson('/api/v1/roles/staff', ['permissions' => $permissions])
            ->assertOk()
            ->assertJsonPath('data.permissions', $permissions)
            ->assertJsonPath('data.customized', true);

        $this->useToken($staffToken);
        $this->getJson('/api/v1/users')->assertOk();
        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.permissions', $permissions);
    }

    public function test_revoking_a_permission_changes_server_enforcement(): void
    {
        $admin = $this->actingAsRole('administrator');
        $manager = $this->makeUser('manager');

        $permissions = array_values(array_diff(config('permissions.defaults.manager'), ['users.read']));
        $this->patchJson('/api/v1/roles/manager', ['permissions' => $permissions])->assertOk();

        $this->useToken($this->tokenFor($manager));
        $this->getJson('/api/v1/users')->assertStatus(403)->assertJsonPath('error.permission', 'users.read');
    }

    public function test_patch_label_round_trip_and_reset_restores_default(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/roles/teacher', ['label' => 'Instructor', 'scope' => 'Own classes'])
            ->assertOk()
            ->assertJsonPath('data.label', 'Instructor')
            ->assertJsonPath('data.scope', 'Own classes')
            ->assertJsonPath('data.permissions', config('permissions.defaults.teacher'))
            ->assertJsonPath('data.customized', true);

        $record = $this->getJson('/api/v1/roles/teacher')->assertOk();
        $record->assertJsonPath('data.label', 'Instructor');
        $this->assertNotNull($record->json('data.updatedAt'));

        $this->postJson('/api/v1/roles/teacher/reset')
            ->assertOk()
            ->assertJsonPath('data.label', config('permissions.labels.teacher'))
            ->assertJsonPath('data.customized', false);

        $this->getJson('/api/v1/roles/teacher')
            ->assertJsonPath('data.label', config('permissions.labels.teacher'))
            ->assertJsonMissingPath('data.updatedAt');
    }

    public function test_administrator_must_keep_roles_write(): void
    {
        $this->actingAsRole('administrator');

        $permissions = array_values(array_diff(config('permissions.vocabulary'), ['roles.write']));
        $this->patchJson('/api/v1/roles/administrator', ['permissions' => $permissions])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ROLE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['permissions']]]);
    }

    public function test_unknown_permission_is_422(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/roles/staff', ['permissions' => ['students.read', 'not-a.permission']])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ROLE_INVALID');
    }

    public function test_short_label_is_422(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/roles/staff', ['label' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ROLE_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['label']]]);
    }

    public function test_role_edits_are_per_organization(): void
    {
        $this->actingAsRole('administrator');
        $this->patchJson('/api/v1/roles/staff', ['label' => 'Front desk'])->assertOk();

        $this->actingAsRole('administrator', [], $this->makeOrganization());
        $this->getJson('/api/v1/roles/staff')
            ->assertOk()
            ->assertJsonPath('data.label', config('permissions.labels.staff'))
            ->assertJsonPath('data.customized', false);
    }
}
