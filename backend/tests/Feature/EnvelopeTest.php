<?php

namespace Tests\Feature;

use App\Support\Authorization\PermissionGate;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDatasetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use InvalidArgumentException;
use RuntimeException;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class EnvelopeTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    public function test_unknown_api_route_is_404_envelope(): void
    {
        $this->getJson('/api/v1/definitely-not-a-route')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND')
            ->assertJsonStructure(['error' => ['code', 'message']]);
    }

    public function test_unknown_api_route_without_accept_header_is_still_json(): void
    {
        $this->get('/api/v1/definitely-not-a-route')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_unauthenticated_request_without_accept_header_is_401_not_redirect(): void
    {
        $this->get('/api/v1/users')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_unhandled_exception_is_500_server_error(): void
    {
        Route::get('api/v1/__boom', fn () => throw new RuntimeException('boom'));
        config(['app.debug' => false]);

        $this->getJson('/api/v1/__boom')
            ->assertStatus(500)
            ->assertExactJson(['error' => ['code' => 'SERVER_ERROR', 'message' => 'خطای داخلی سرور.']]);
    }

    public function test_page_envelope_has_snake_case_meta_and_clamps_per_page(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/users?per_page=1000&page=0')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total']])
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.per_page', 100)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_default_per_page_is_25(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/users')->assertOk()->assertJsonPath('meta.per_page', 25);
    }

    public function test_gate_rejects_unknown_permission_ids(): void
    {
        $user = $this->makeUser('administrator');

        $this->expectException(InvalidArgumentException::class);
        app(PermissionGate::class)->allows($user, 'not-a.permission');
    }

    public function test_seeder_loads_the_demo_dataset(): void
    {
        config(['demo.seed_password' => '']);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, DB::table('organizations')->count());
        $this->assertSame(12, DB::table('users')->count());
        $this->assertSame(5, DB::table('roles')->count());
        $this->assertSame(6, DB::table('instruments')->count());
        $this->assertSame('t1', DB::table('users')->where('email', 'teacher1@demo.local')->value('teacher_id'));
        // Blank seed password: nobody can sign in.
        $this->assertSame(0, DB::table('users')->whereNotNull('password')->count());
    }

    public function test_seeded_users_can_log_in_with_the_seed_password(): void
    {
        config(['demo.seed_password' => 'seed-pass-for-test']);
        $this->seed(DatabaseSeeder::class);

        $this->postJson('/api/v1/auth/login', ['email' => 'desk@demo.local', 'password' => 'seed-pass-for-test'])
            ->assertOk()
            ->assertJsonPath('data.user.id', 'usr_desk')
            ->assertJsonPath('data.user.created_at', '2026-09-01T00:00:00.000Z')
            ->assertJsonPath('data.permissions', config('permissions.defaults.staff'));

        $this->useToken($this->postJson('/api/v1/auth/login', ['email' => 'admin@demo.local', 'password' => 'seed-pass-for-test'])->json('data.token'));
        $roles = $this->getJson('/api/v1/roles')->assertOk();
        $this->assertSame([false, false, false, false, false], array_column($roles->json('data'), 'customized'));
    }

    public function test_seeder_refuses_outside_local_and_testing(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        try {
            $this->expectException(RuntimeException::class);
            (new DemoDatasetSeeder)->run();
        } finally {
            $this->assertSame(0, DB::table('users')->count());
        }
    }

    public function test_database_seeder_is_a_no_op_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        (new DatabaseSeeder)->setContainer($this->app)->run();

        $this->assertSame(0, DB::table('organizations')->count());
    }
}
