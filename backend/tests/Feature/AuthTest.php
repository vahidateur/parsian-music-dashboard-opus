<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function loginUser(string $role = 'manager', array $attributes = []): User
    {
        return $this->makeUser($role, [
            'email' => 'person@example.test',
            'password' => 'secret-pass',
            ...$attributes,
        ]);
    }

    public function test_login_returns_session_envelope_without_organization_id(): void
    {
        $user = $this->loginUser('manager', ['phone' => '09120000000', 'teacher_id' => null]);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'Person@Example.test', 'password' => 'secret-pass']);

        $response->assertOk()
            ->assertJsonStructure(['data' => [
                'user' => ['id', 'name', 'email', 'role', 'status', 'teacher_id', 'created_at', 'updated_at'],
                'permissions',
                'token',
                'expires_at',
            ]])
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.role', 'manager')
            ->assertJsonPath('data.user.status', 'active')
            ->assertJsonPath('data.permissions', config('permissions.defaults.manager'));

        $body = $response->getContent();
        $this->assertStringNotContainsString('organization_id', $body);
        $this->assertStringNotContainsString('organizationId', $body);
        $this->assertStringNotContainsString($user->organization_id, $body);
        $this->assertNotSame('', $response->json('data.token'));
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $response->json('data.expires_at'));
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T/', $response->json('data.user.created_at'));
    }

    public function test_wrong_password_and_unknown_email_are_indistinguishable(): void
    {
        $this->loginUser();

        $wrong = $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'nope-nope']);
        $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'ghost@example.test', 'password' => 'nope-nope']);

        $wrong->assertStatus(401)->assertJsonPath('error.code', 'AUTH_INVALID_CREDENTIALS');
        $unknown->assertStatus(401)->assertJsonPath('error.code', 'AUTH_INVALID_CREDENTIALS');
        $this->assertSame($wrong->json('error.message'), $unknown->json('error.message'));
    }

    public function test_user_without_password_cannot_log_in(): void
    {
        $this->loginUser('manager', ['password' => null]);

        $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'anything'])
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_INVALID_CREDENTIALS');
    }

    public function test_missing_fields_is_422_with_fields(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => ''])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'AUTH_MISSING_FIELDS')
            ->assertJsonStructure(['error' => ['code', 'message', 'fields' => ['email', 'password']]]);
    }

    public function test_disabled_user_login_is_403(): void
    {
        $this->loginUser('manager', ['status' => 'disabled']);

        $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'secret-pass'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'AUTH_USER_DISABLED');
    }

    public function test_suspended_organization_login_is_403(): void
    {
        $organization = Organization::factory()->suspended()->create();
        $this->makeUser('manager', ['email' => 'person@example.test', 'password' => 'secret-pass'], $organization);

        $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'secret-pass'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'ORGANIZATION_SUSPENDED');
    }

    public function test_sixth_login_attempt_in_a_minute_is_rate_limited(): void
    {
        $this->loginUser();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'wrong-pass'])
                ->assertStatus(401);
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'secret-pass'])
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    public function test_me_returns_session_with_empty_token(): void
    {
        $user = $this->actingAsRole('teacher', ['teacher_id' => 't1']);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.teacher_id', 't1')
            ->assertJsonPath('data.token', '')
            ->assertJsonPath('data.permissions', config('permissions.defaults.teacher'))
            ->assertJsonMissingPath('data.user.organization_id');
    }

    public function test_me_without_token_is_401(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertExactJson(['error' => ['code' => 'AUTH_UNAUTHENTICATED', 'message' => 'برای ادامه وارد شوید.']]);
    }

    public function test_invalid_token_is_401(): void
    {
        $this->useToken('1|not-a-real-token');

        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_logout_revokes_the_token(): void
    {
        $this->loginUser();
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'person@example.test', 'password' => 'secret-pass'])
            ->json('data.token');

        $this->useToken($token);
        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_expired_token_is_401(): void
    {
        $this->actingAsRole('manager');
        $this->getJson('/api/v1/auth/me')->assertOk();

        $this->travel(config('sanctum.expiration') + 1)->minutes();

        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_disabled_user_with_live_token_is_403(): void
    {
        $user = $this->actingAsRole('manager');
        $user->forceFill(['status' => 'disabled'])->save();

        $this->getJson('/api/v1/auth/me')->assertStatus(403)->assertJsonPath('error.code', 'AUTH_USER_DISABLED');
    }

    public function test_suspended_organization_with_live_token_is_403(): void
    {
        $user = $this->actingAsRole('manager');
        Organization::query()->whereKey($user->organization_id)->update(['status' => 'suspended']);

        $this->getJson('/api/v1/auth/me')->assertStatus(403)->assertJsonPath('error.code', 'ORGANIZATION_SUSPENDED');
    }

    public function test_every_role_receives_its_default_matrix(): void
    {
        foreach (config('permissions.roles') as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/auth/me')
                ->assertOk()
                ->assertJsonPath('data.permissions', config("permissions.defaults.$role"));
        }
    }
}
