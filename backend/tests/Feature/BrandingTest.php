<?php

namespace Tests\Feature;

use App\Models\Branding;
use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class BrandingTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /** A real 1x1 PNG for the logo path. */
    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function uploadImage(): string
    {
        $file = UploadedFile::fake()->createWithContent('logo.png', $this->pngBytes());

        return $this->post('/api/v1/media', [
            'kind' => 'image',
            'mimeType' => 'image/png',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        $this->getJson('/api/v1/branding')->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        $this->patchJson('/api/v1/branding', ['academyName' => 'x'])->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
    }

    public function test_reading_requires_branding_read(): void
    {
        // Academy identity renders for every authenticated surface — reading
        // it is never personal data, so every role holds `branding.read`,
        // accounting included.
        foreach (['administrator', 'manager', 'teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/branding')
                ->assertOk()
                ->assertJsonPath('data.academyName', 'آموزشگاه موسیقی پارسیان');
        }
    }

    public function test_writing_requires_branding_write(): void
    {
        // Only the administrator curates the academy identity — the same
        // boundary as `settings.write`, which already gates the name and
        // tagline through the organization record. A manager opens Settings
        // (settings.read) but cannot save identity there or here.
        $this->actingAsRole('administrator');
        $this->patchJson('/api/v1/branding', ['academyName' => 'آکادمی تست'])
            ->assertOk()
            ->assertJsonPath('data.academyName', 'آکادمی تست');

        foreach (['manager', 'teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->patchJson('/api/v1/branding', ['academyName' => 'آکادمی تست'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'branding.write');
        }
    }

    public function test_forbidden_precedes_validation(): void
    {
        // The policy runs before validation, so an unauthorized caller learns
        // nothing about field rules.
        $this->actingAsRole('manager');

        $this->patchJson('/api/v1/branding', ['academyName' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'branding.write');
        $this->patchJson('/api/v1/branding', ['primaryColor' => 'not-a-color'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'branding.write');
    }

    public function test_admin_patch_round_trip_with_validation(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/branding', ['academyName' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BRANDING_INVALID');
        $this->patchJson('/api/v1/branding', ['primaryColor' => 'red'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BRANDING_INVALID');
        $this->patchJson('/api/v1/branding', ['persianFont' => 'Comic Sans'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BRANDING_INVALID');
        $this->patchJson('/api/v1/branding', ['logoMediaId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BRANDING_INVALID');

        $saved = $this->patchJson('/api/v1/branding', [
            'academyName' => 'آکادمی پروب',
            'tagline' => 'شعار پروب',
            'primaryColor' => '#112233',
            'accentColor' => '#445566',
            'textColor' => '#FFFFFF',
            'persianFont' => 'Estedad',
        ])->assertOk()->assertJsonPath('data.academyName', 'آکادمی پروب');
        $this->assertNotEmpty($saved->json('data.updatedAt'));

        // The write persisted: a fresh read answers the saved record.
        $this->getJson('/api/v1/branding')
            ->assertOk()
            ->assertJsonPath('data', $saved->json('data'));

        // A cleared media reference is "no logo", not a missing file.
        $this->patchJson('/api/v1/branding', ['logoMediaId' => ''])
            ->assertOk()
            ->assertJsonMissingPath('data.logoMediaId');
    }

    public function test_tenant_isolation_is_per_organization(): void
    {
        $this->actingAsRole('administrator');
        $this->patchJson('/api/v1/branding', ['academyName' => 'آکادمی الف'])->assertOk();

        $foreign = $this->makeOrganization();
        $this->actingAsRole('administrator', [], $foreign);
        // Another organization's identity is never queried, let alone shown:
        // the caller reads its own record (defaults here), never A's.
        $this->getJson('/api/v1/branding')
            ->assertOk()
            ->assertJsonPath('data.academyName', 'آموزشگاه موسیقی پارسیان');
    }

    public function test_referenced_logo_cannot_be_freed_and_reads_follow_branding_read(): void
    {
        $this->actingAsRole('administrator');
        $mediaId = $this->uploadImage();
        $this->patchJson('/api/v1/branding', ['logoMediaId' => $mediaId])->assertOk();

        // Still referenced: refused, never freed under the record.
        $this->deleteJson("/api/v1/media/$mediaId")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'MEDIA_IN_USE');
        $this->assertNotNull(MediaAsset::query()->whereKey($mediaId)->first());

        // Any role that may open the identity may read its bytes; the id
        // alone grants nothing to a role without `branding.read`... but every
        // role holds it, so the negative case is the cross-tenant stranger.
        // (There is no role without the read id by design: identity is public
        // within the product the way the login page already shows it.)
        $this->actingAsRole('staff');
        $this->get("/api/v1/media/$mediaId/bytes")->assertOk();
        $this->actingAsRole('accountant');
        $this->get("/api/v1/media/$mediaId/bytes")->assertOk();

        $foreign = $this->makeOrganization();
        $this->actingAsRole('administrator', [], $foreign);
        // Not even found: the asset lookup itself is tenant-scoped, so a
        // foreign organization never reaches the authorization question.
        $this->get("/api/v1/media/$mediaId/bytes")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'MEDIA_NOT_FOUND');
    }

    public function test_branding_permissions_exist_in_the_vocabulary(): void
    {
        $this->assertContains('branding.read', config('permissions.vocabulary'));
        $this->assertContains('branding.write', config('permissions.vocabulary'));
    }
}
