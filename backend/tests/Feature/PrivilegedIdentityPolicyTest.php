<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * PB-2 was resolved 2026-10-02 as option A (keep the restrictions): each case must fail closed
 * with 403 OWNER_DECISION_REQUIRED_PB2 — never silently allow or deny.
 */
class PrivilegedIdentityPolicyTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function assertPb2(TestResponse $response, string $case): void
    {
        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB2')
            ->assertJsonPath('error.decision', 'PB-2');
        $this->assertStringStartsWith("case $case:", $response->json('error.detail'));
    }

    public function test_case_a_self_edit_is_blocked(): void
    {
        $self = $this->actingAsRole('administrator');

        $this->assertPb2($this->patchJson("/api/v1/users/{$self->id}", ['name' => 'New Name']), 'a');
        $this->assertPb2($this->postJson("/api/v1/users/{$self->id}/password", ['password' => 'another-pass']), 'a');
        $this->assertPb2($this->deleteJson("/api/v1/users/{$self->id}"), 'a');

        $this->assertNotSame('New Name', $self->fresh()->name);
    }

    public function test_case_b_editing_another_administrator_is_blocked(): void
    {
        $this->actingAsRole('administrator');
        $other = $this->makeUser('administrator');

        $this->assertPb2($this->patchJson("/api/v1/users/{$other->id}", ['name' => 'Renamed']), 'b');
        $this->assertPb2($this->postJson("/api/v1/users/{$other->id}/password", ['password' => 'another-pass']), 'b');
        $this->assertPb2($this->deleteJson("/api/v1/users/{$other->id}"), 'b');

        $this->assertNotNull(User::query()->find($other->id));
    }

    public function test_case_c_granting_administrator_is_blocked(): void
    {
        $this->actingAsRole('administrator');
        $staff = $this->makeUser('staff');

        $this->assertPb2($this->postJson('/api/v1/users', [
            'name' => 'New Admin',
            'email' => 'new-admin@example.test',
            'role' => 'administrator',
        ]), 'c');
        $this->assertPb2($this->patchJson("/api/v1/users/{$staff->id}", ['role' => 'administrator']), 'c');

        $this->assertSame('staff', $staff->fresh()->role);
        $this->assertFalse(User::query()->where('email', 'new-admin@example.test')->exists());
    }

    public function test_case_d_changing_a_manager_email_is_blocked(): void
    {
        $this->actingAsRole('administrator');
        $manager = $this->makeUser('manager', ['email' => 'boss@example.test']);

        $this->assertPb2($this->patchJson("/api/v1/users/{$manager->id}", ['email' => 'new-boss@example.test']), 'd');
        $this->assertSame('boss@example.test', $manager->fresh()->email);

        // Resubmitting the unchanged email is not an email change.
        $this->patchJson("/api/v1/users/{$manager->id}", ['email' => 'BOSS@example.test', 'name' => 'Boss'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Boss');
    }

    public function test_settled_paths_stay_open(): void
    {
        $this->actingAsRole('administrator');
        $staff = $this->makeUser('staff', ['email' => 'desk@example.test']);

        $this->patchJson("/api/v1/users/{$staff->id}", ['email' => 'front-desk@example.test', 'role' => 'manager'])
            ->assertOk()
            ->assertJsonPath('data.email', 'front-desk@example.test')
            ->assertJsonPath('data.role', 'manager');
        $this->postJson("/api/v1/users/{$staff->id}/password", ['password' => 'desk-pass'])->assertNoContent();
    }
}
