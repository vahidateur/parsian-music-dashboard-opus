<?php

namespace Tests\Feature;

use App\Models\LearningContent;
use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Learning material is a media parent — the server side of the product's own
 * contract.
 *
 * `src/domains/media/mediaReferences.ts` (X1) enumerates every persisted
 * `MediaAsset.id` reference, including `learningContent.mediaId`, and the
 * learning handoff records a server branch reading it under `learning.read`.
 * These cases pin the server half of that promise:
 *
 *   - an asset learning content still references cannot be freed (409), or a
 *     delete would strand material pointing at freed bytes;
 *   - its bytes are readable by whoever holds `learning.read`, and by nobody
 *     else merely holding the id.
 */
class LearningMediaTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function uploadImage(): string
    {
        $file = UploadedFile::fake()->createWithContent('material.png', $this->pngBytes());

        return $this->post('/api/v1/media', [
            'kind' => 'image',
            'mimeType' => 'image/png',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    public function test_a_referenced_asset_cannot_be_freed(): void
    {
        $this->actingAsRole('administrator');
        $orgId = $this->defaultOrganization()->id;
        $mediaId = $this->uploadImage();

        LearningContent::factory()->create(['organization_id' => $orgId, 'media_id' => $mediaId]);

        $this->deleteJson("/api/v1/media/$mediaId")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'MEDIA_IN_USE');
        $this->assertNotNull(MediaAsset::query()->whereKey($mediaId)->first());
    }

    public function test_learning_bytes_follow_learning_read(): void
    {
        $this->actingAsRole('manager');
        $orgId = $this->defaultOrganization()->id;
        $mediaId = $this->uploadImage();

        LearningContent::factory()->create(['organization_id' => $orgId, 'media_id' => $mediaId]);

        // Staff holds `learning.read`: the material opens for them, bytes and
        // listing alike.
        $this->actingAsRole('staff');
        $this->get("/api/v1/media/$mediaId/bytes")->assertOk();
        $response = $this->getJson('/api/v1/media?per_page=200')->assertOk();
        $this->assertContains($mediaId, array_column($response->json('data'), 'id'));

        // Accounting holds no learning id: the id alone grants nothing.
        $this->actingAsRole('accountant');
        $this->get("/api/v1/media/$mediaId/bytes")->assertStatus(403);
    }
}
