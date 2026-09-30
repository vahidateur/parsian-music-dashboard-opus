<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class UsersTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    public function test_unauthenticated_is_401(): void
    {
        $this->getJson('/api/v1/users')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/users', [])->assertStatus(401);
    }

    public function test_admin_crud_round_trip(): void
    {
        $this->actingAsRole('administrator');

        $created = $this->postJson('/api/v1/users', [
            'name' => 'Reza Karimi',
            'email' => 'Reza@Example.test',
            'role' => 'staff',
            'phone' => '0912 000 1111',
        ]);
        $created->assertCreated()
            ->assertJsonPath('data.name', 'Reza Karimi')
            ->assertJsonPath('data.email', 'reza@example.test')
            ->assertJsonPath('data.role', 'staff')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.phone', '0912 000 1111')
            ->assertJsonMissingPath('data.organization_id')
            ->assertJsonMissingPath('data.organizationId')
            ->assertJsonMissingPath('data.password');
        $id = $created->json('data.id');
        $this->assertStringStartsWith('usr_', $id);
        $this->assertNotNull($created->json('data.createdAt'));

        $this->getJson("/api/v1/users/$id")
            ->assertOk()
            ->assertJsonPath('data', $created->json('data'));

        $this->patchJson("/api/v1/users/$id", ['name' => 'Reza K.', 'status' => 'disabled', 'phone' => ''])
            ->assertOk()
            ->assertJsonPath('data.name', 'Reza K.')
            ->assertJsonPath('data.status', 'disabled')
            ->assertJsonMissingPath('data.phone');

        $this->getJson("/api/v1/users/$id")->assertJsonPath('data.name', 'Reza K.');

        $list = $this->getJson('/api/v1/users')->assertOk();
        $this->assertContains($id, array_column($list->json('data'), 'id'));

        $this->deleteJson("/api/v1/users/$id")->assertNoContent();
        $this->getJson("/api/v1/users/$id")->assertStatus(404)->assertJsonPath('error.code', 'USER_NOT_FOUND');
    }

    public function test_manager_can_read_but_not_write(): void
    {
        $this->actingAsRole('manager');

        $this->getJson('/api/v1/users')->assertOk();
        $this->postJson('/api/v1/users', ['name' => 'X Y', 'email' => 'x@example.test', 'role' => 'staff'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'users.write');
    }

    public function test_forbidden_precedes_validation(): void
    {
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/users', [])->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_teacher_cannot_read_users(): void
    {
        $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/users')->assertStatus(403)->assertJsonPath('error.permission', 'users.read');
    }

    public function test_validation_failure_is_422_user_invalid_with_fields(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/users', ['name' => 'A', 'email' => 'not-an-email', 'role' => 'owner', 'phone' => 'abc'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'USER_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['name', 'email', 'role', 'phone']]]);
    }

    public function test_duplicate_email_is_409_even_across_organizations(): void
    {
        $this->actingAsRole('administrator');
        $this->makeUser('staff', ['email' => 'taken@example.test'], $this->makeOrganization());

        $this->postJson('/api/v1/users', ['name' => 'Some One', 'email' => 'TAKEN@example.test', 'role' => 'staff'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'USER_EMAIL_TAKEN')
            ->assertJsonStructure(['error' => ['fields' => ['email']]]);
    }

    public function test_other_organization_user_is_404(): void
    {
        $this->actingAsRole('administrator');
        $foreign = $this->makeUser('staff', [], $this->makeOrganization());

        $this->getJson("/api/v1/users/{$foreign->id}")->assertStatus(404)->assertJsonPath('error.code', 'USER_NOT_FOUND');
        $this->patchJson("/api/v1/users/{$foreign->id}", ['name' => 'Hijack'])->assertStatus(404);
        $this->deleteJson("/api/v1/users/{$foreign->id}")->assertStatus(404);

        $list = $this->getJson('/api/v1/users')->assertOk();
        $this->assertNotContains($foreign->id, array_column($list->json('data'), 'id'));
        $this->assertSame(1, $list->json('meta.total'));
    }

    public function test_organization_id_in_body_is_ignored(): void
    {
        $admin = $this->actingAsRole('administrator');
        $other = $this->makeOrganization();

        $id = $this->postJson('/api/v1/users', [
            'name' => 'Some One',
            'email' => 'some@example.test',
            'role' => 'staff',
            'organization_id' => $other->id,
            'organizationId' => $other->id,
        ])->assertCreated()->json('data.id');

        $this->assertSame($admin->organization_id, User::query()->find($id)->organization_id);
    }

    public function test_set_password_then_login_with_it(): void
    {
        $this->actingAsRole('administrator');
        $target = $this->makeUser('staff', ['email' => 'desk@example.test', 'password' => null]);

        $this->getJson("/api/v1/users/{$target->id}/password")->assertOk()->assertJsonPath('data.has_password', false);

        $this->postJson("/api/v1/users/{$target->id}/password", ['password' => 'fresh-pass'])->assertNoContent();

        $this->getJson("/api/v1/users/{$target->id}/password")->assertJsonPath('data.has_password', true);

        $this->asGuest();
        $this->postJson('/api/v1/auth/login', ['email' => 'desk@example.test', 'password' => 'fresh-pass'])
            ->assertOk()
            ->assertJsonPath('data.user.id', $target->id);
    }

    public function test_weak_password_is_422(): void
    {
        $this->actingAsRole('administrator');
        $target = $this->makeUser('staff');

        $this->postJson("/api/v1/users/{$target->id}/password", ['password' => '  abc  '])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'USER_PASSWORD_WEAK')
            ->assertJsonStructure(['error' => ['fields' => ['password']]]);
    }

    public function test_empty_password_clears_and_revokes_tokens(): void
    {
        $this->actingAsRole('administrator');
        $target = $this->makeUser('staff', ['email' => 'desk@example.test', 'password' => 'old-password']);
        $this->tokenFor($target);

        $this->postJson("/api/v1/users/{$target->id}/password", ['password' => ''])->assertNoContent();

        $this->assertNull($target->fresh()->password);
        $this->assertSame(0, $target->tokens()->count());
        $this->getJson("/api/v1/users/{$target->id}/password")->assertJsonPath('data.has_password', false);
    }

    public function test_password_field_must_be_present(): void
    {
        $this->actingAsRole('administrator');
        $target = $this->makeUser('staff');

        $this->postJson("/api/v1/users/{$target->id}/password", [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'USER_PASSWORD_WEAK');
    }

    public function test_deleting_a_user_revokes_its_tokens(): void
    {
        $this->actingAsRole('administrator');
        $target = $this->makeUser('staff');
        $targetToken = $this->tokenFor($target);

        $this->deleteJson("/api/v1/users/{$target->id}")->assertNoContent();

        $this->useToken($targetToken);
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_missing_user_is_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/users/usr_missing')->assertStatus(404)->assertJsonPath('error.code', 'USER_NOT_FOUND');
        $this->getJson('/api/v1/users/usr_missing/password')->assertStatus(404);
        $this->postJson('/api/v1/users/usr_missing/password', ['password' => 'long-enough'])->assertStatus(404);
    }
}
