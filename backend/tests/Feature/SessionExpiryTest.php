<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Server-enforced session expiry (idle 30 min, absolute 10 h).
 *
 * The policy lives in EnforceSessionExpiry, which runs BEFORE auth:sanctum
 * (Sanctum touches last_used_at while authenticating, so only a pre-touch
 * read can observe staleness). Boundary semantics: a token is expired when
 * inactivity (or age) REACHES the limit — exactly 30:00 of silence is out.
 */
class SessionExpiryTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function liveToken(): PersonalAccessToken
    {
        $user = $this->actingAsRole('manager');

        return $user->tokens()->orderByDesc('id')->firstOrFail();
    }

    public function test_request_just_inside_the_idle_window_passes(): void
    {
        $this->liveToken();
        $this->travel(29)->minutes();

        $this->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_idle_boundary_is_expired(): void
    {
        $token = $this->liveToken();
        $this->travel(30)->minutes();

        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');

        // The breach revokes: the row is gone, so a replay is indistinguishable
        // from a revoked token (no oracle for which death it died).
        $this->assertNull(PersonalAccessToken::query()->whereKey($token->id)->first());
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_idle_beyond_the_boundary_is_expired(): void
    {
        $this->liveToken();
        $this->travel(45)->minutes();

        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');
    }

    public function test_absolute_lifetime_applies_despite_recent_activity(): void
    {
        $token = $this->liveToken();
        $token->forceFill([
            'created_at' => now()->subMinutes(601),
            'last_used_at' => now(),
        ])->save();

        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_ABSOLUTE_EXPIRED');
        $this->assertNull(PersonalAccessToken::query()->whereKey($token->id)->first());
    }

    public function test_absolute_takes_priority_when_both_ceilings_breach(): void
    {
        $this->liveToken();
        $this->travel(601)->minutes();

        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_ABSOLUTE_EXPIRED');
    }

    public function test_missing_invalid_and_revoked_credentials_keep_their_code(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');

        $this->useToken('1|not-a-real-token');
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');

        $user = $this->makeUser('manager');
        $this->useToken($this->tokenFor($user));
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_expiry_envelope_carries_no_token_or_account_detail(): void
    {
        $user = $this->makeUser('manager');
        $plain = $this->tokenFor($user);
        $this->useToken($plain);
        $this->travel(31)->minutes();

        $response = $this->getJson('/api/v1/auth/me');
        $response->assertStatus(401)->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');

        $body = $response->json('error');
        $this->assertSame(['code', 'message'], array_keys($body));
        $this->assertStringNotContainsString($plain, $response->getContent());
        $this->assertStringNotContainsString($user->email, $response->getContent());
    }

    public function test_expiry_is_enforced_across_protected_routes(): void
    {
        // A breach revokes the token, so each route needs its own live token:
        // the second request on a dead token reads as revoked (by design).
        foreach (['/api/v1/sessions', '/api/v1/compensations'] as $uri) {
            $user = $this->makeUser('manager');
            $this->useToken($this->tokenFor($user));
            $this->travel(31)->minutes();
            $this->getJson($uri)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');
            $this->travelBack();
        }
    }

    public function test_logout_then_repeated_logout(): void
    {
        $user = $this->makeUser('manager');
        $this->useToken($this->tokenFor($user));

        // First logout revokes with 204; the client clears its copy regardless.
        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // The token is gone: reuse and repeated logout both read as anonymous.
        // (Server-side logout is therefore one-shot; client-side clearing is
        // what makes repeated logout safe — ApiAuthRepository clears in
        // `finally`, already covered by apiAuthPersistence.test.ts.)
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->postJson('/api/v1/auth/logout')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_concurrent_valid_requests_pass_and_stale_timestamps_expire(): void
    {
        $token = $this->liveToken();

        // Two back-to-back requests both pass; each touches last_used_at.
        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->getJson('/api/v1/auth/me')->assertOk();

        // A row gone stale since (another writer, clock skew, restored backup)
        // expires on next use — the decision always reads the current row.
        $token->forceFill(['last_used_at' => now()->subMinutes(31)])->save();
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');
    }

    public function test_activity_extends_the_idle_window(): void
    {
        $this->liveToken();
        $this->travel(29)->minutes();
        $this->getJson('/api/v1/auth/me')->assertOk();

        // The request above touched last_used_at: 29 more minutes of silence
        // from there is still inside the window (29 < 30).
        $this->travel(29)->minutes();
        $this->getJson('/api/v1/auth/me')->assertOk();

        $this->travel(30)->minutes();
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'AUTH_SESSION_IDLE_EXPIRED');
    }
}
