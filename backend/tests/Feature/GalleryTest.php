<?php

namespace Tests\Feature;

use App\Domain\Gallery\GalleryService;
use App\Models\GalleryAlbum;
use App\Models\GalleryImage;
use App\Models\MediaAsset;
use App\Models\Student;
use App\Support\Api\ApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class GalleryTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /** A real 1x1 PNG — the media bytes must carry the signature, not just the name. */
    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    /** Uploads through the real media endpoint, so the asset has bytes on the (fake) disk. */
    private function uploadImage(string $filename = 'photo.png'): string
    {
        $file = UploadedFile::fake()->createWithContent($filename, $this->pngBytes());

        return $this->post('/api/v1/media', [
            'kind' => 'image',
            'mimeType' => 'image/png',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    private function makeAlbum(string $title = 'کنسرت بهار'): string
    {
        return GalleryAlbum::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'title' => $title,
        ])->id;
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function albumEndpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/gallery/albums', []],
            ['GET', "/api/v1/gallery/albums/$id", []],
            ['POST', '/api/v1/gallery/albums', ['title' => 'آلبوم X']],
            ['PATCH', "/api/v1/gallery/albums/$id", ['title' => 'آلبوم Y']],
            ['DELETE', "/api/v1/gallery/albums/$id", []],
        ];
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function imageEndpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/gallery/images', []],
            ['GET', "/api/v1/gallery/images/$id", []],
            ['POST', '/api/v1/gallery/images', ['albumId' => 'gl_x', 'mediaId' => 'md_x', 'caption' => 'c', 'alt' => 'متن جایگزین']],
            ['PATCH', "/api/v1/gallery/images/$id", ['caption' => 'تازه']],
            ['DELETE', "/api/v1/gallery/images/$id", []],
            ['POST', "/api/v1/gallery/images/$id/reorder", ['order' => 0]],
        ];
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ([...$this->albumEndpoints('gl_1'), ...$this->imageEndpoints('gi_1')] as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_reading_requires_gallery_read(): void
    {
        $albumId = $this->makeAlbum();

        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/gallery/albums')
                ->assertOk()
                ->assertJsonPath('meta.page', 1);
            $this->getJson('/api/v1/gallery/images')
                ->assertOk()
                ->assertJsonPath('meta.page', 1);
            $this->getJson("/api/v1/gallery/albums/$albumId")->assertOk();
        }

        // Accounting never opens the gallery: no `gallery.read`, like no
        // `library.read` — the showcase is not a finance surface.
        $this->actingAsRole('accountant');
        $this->getJson('/api/v1/gallery/albums')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.read');
        $this->getJson('/api/v1/gallery/images')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.read');
    }

    public function test_writing_requires_gallery_write(): void
    {
        $albumId = $this->makeAlbum();

        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/gallery/albums', ['title' => "آلبوم $role"])
                ->assertCreated()
                ->assertJsonPath('data.title', "آلبوم $role");
        }

        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/gallery/albums', ['title' => 'آلبوم تازه'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'gallery.write');
            $this->patchJson("/api/v1/gallery/albums/$albumId", ['title' => 'x'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'gallery.write');
            $this->deleteJson("/api/v1/gallery/albums/$albumId")->assertStatus(403);
            $this->postJson('/api/v1/gallery/images', ['albumId' => $albumId, 'mediaId' => 'md_x', 'caption' => 'c', 'alt' => 'متن جایگزین'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'gallery.write');
        }
    }

    public function test_forbidden_precedes_validation_and_not_found(): void
    {
        // The policy runs before validation and before the lookup, so an
        // unauthorized caller learns nothing about field rules or ids.
        $this->actingAsRole('teacher');

        $this->postJson('/api/v1/gallery/albums', ['title' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.write');
        $this->patchJson('/api/v1/gallery/albums/gl_missing', ['title' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.write');
        $this->postJson('/api/v1/gallery/images/gi_missing/reorder', ['order' => -1])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.write');
        $this->deleteJson('/api/v1/gallery/images/gi_missing')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'gallery.write');
    }

    public function test_unknown_album_and_image_are_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/gallery/albums/gl_missing')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ALBUM_NOT_FOUND');
        $this->getJson('/api/v1/gallery/images/gi_missing')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'GALLERY_IMAGE_NOT_FOUND');
        $this->patchJson('/api/v1/gallery/images/gi_missing', ['caption' => 'x'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'GALLERY_IMAGE_NOT_FOUND');
    }

    public function test_admin_album_crud_round_trip(): void
    {
        $this->actingAsRole('administrator');
        $orgId = $this->defaultOrganization()->id;
        $mediaId = $this->uploadImage();

        $created = $this->postJson('/api/v1/gallery/albums', ['title' => 'اجرا', 'description' => 'شب اول'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'اجرا')
            ->assertJsonPath('data.description', 'شب اول')
            ->assertJsonPath('data.sortOrder', 1);
        $id = $created->json('data.id');
        $this->assertStringStartsWith('gl_', $id);

        $this->getJson("/api/v1/gallery/albums/$id")->assertOk()->assertJsonPath('data', $created->json('data'));

        // Search answers on the title.
        $this->getJson('/api/v1/gallery/albums?search=اجرا')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        // The cover must name a real asset in this organization.
        $this->postJson('/api/v1/gallery/albums', ['title' => 'جلد بد', 'coverMediaId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'GALLERY_ALBUM_INVALID');
        $this->patchJson("/api/v1/gallery/albums/$id", ['coverMediaId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'GALLERY_ALBUM_INVALID');

        $this->patchJson("/api/v1/gallery/albums/$id", ['title' => 'اجرای دوم', 'description' => 'شب دوم', 'coverMediaId' => $mediaId])
            ->assertOk()
            ->assertJsonPath('data.title', 'اجرای دوم')
            ->assertJsonPath('data.coverMediaId', $mediaId);

        // Clearing the cover is stating "no cover", not naming a missing file.
        $this->patchJson("/api/v1/gallery/albums/$id", ['coverMediaId' => ''])
            ->assertOk()
            ->assertJsonMissingPath('data.coverMediaId');

        $this->deleteJson("/api/v1/gallery/albums/$id")->assertNoContent();
        $this->getJson("/api/v1/gallery/albums/$id")->assertStatus(404);
        $this->assertSame(0, GalleryAlbum::query()->where('organization_id', $orgId)->count());
    }

    public function test_image_crud_reorder_and_listing(): void
    {
        $this->actingAsRole('administrator');
        $albumId = $this->makeAlbum();
        $first = $this->uploadImage('one.png');
        $second = $this->uploadImage('two.png');

        $one = $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $first, 'caption' => 'یکی', 'alt' => 'متن جایگزین یک',
        ])->assertCreated()->assertJsonPath('data.sortOrder', 0);
        $two = $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $second, 'caption' => 'دومی', 'alt' => 'متن جایگزین دو',
        ])->assertCreated()->assertJsonPath('data.sortOrder', 1);
        $oneId = $one->json('data.id');
        $twoId = $two->json('data.id');
        $this->assertStringStartsWith('gi_', $oneId);

        // Unknown album, unknown media and a short alt are all 422, naming
        // the field — never a dangling row.
        $this->postJson('/api/v1/gallery/images', [
            'albumId' => 'gl_missing', 'mediaId' => $first, 'caption' => 'x', 'alt' => 'متن جایگزین',
        ])->assertStatus(422)->assertJsonPath('error.code', 'GALLERY_IMAGE_INVALID');
        $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => 'md_missing', 'caption' => 'x', 'alt' => 'متن جایگزین',
        ])->assertStatus(422)->assertJsonPath('error.code', 'GALLERY_IMAGE_INVALID');
        $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $first, 'caption' => 'x', 'alt' => 'ک',
        ])->assertStatus(422)->assertJsonPath('error.code', 'GALLERY_IMAGE_INVALID');

        // The album filter answers only its own rows.
        $otherAlbum = $this->postJson('/api/v1/gallery/albums', ['title' => 'آلبوم دیگر'])->assertCreated()->json('data.id');
        $this->getJson("/api/v1/gallery/images?albumId=$albumId&per_page=200")
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
        $this->getJson("/api/v1/gallery/images?albumId=$otherAlbum&per_page=200")
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->patchJson("/api/v1/gallery/images/$oneId", ['caption' => 'یکِ تازه'])
            ->assertOk()
            ->assertJsonPath('data.caption', 'یکِ تازه');

        // Reorder splices within the album; out of range is refused.
        $this->postJson("/api/v1/gallery/images/$oneId/reorder", ['order' => 1])
            ->assertOk()
            ->assertJsonPath('data.sortOrder', 1);
        $this->postJson("/api/v1/gallery/images/$oneId/reorder", ['order' => 5])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'GALLERY_IMAGE_INVALID');
        $this->assertSame(
            [$twoId, $oneId],
            GalleryImage::query()->where('album_id', $albumId)->orderBy('sort_order')->pluck('id')->all(),
        );

        $this->deleteJson("/api/v1/gallery/images/$twoId")->assertNoContent();
        // Removing renumbers the survivors contiguously.
        $this->assertSame(0, (int) GalleryImage::query()->whereKey($oneId)->value('sort_order'));
    }

    public function test_image_list_accepts_the_snake_case_wire_filter(): void
    {
        // The Api repository sends snake_case (toImageQuery); a controller
        // that only read camelCase would silently ignore the filter and leak
        // other albums' rows into the view.
        $this->actingAsRole('administrator');
        $orgId = $this->defaultOrganization()->id;
        $albumA = GalleryAlbum::factory()->create(['organization_id' => $orgId, 'title' => 'الف'])->id;
        $albumB = GalleryAlbum::factory()->create(['organization_id' => $orgId, 'title' => 'ب'])->id;
        $mediaId = function () use ($orgId): string {
            $asset = MediaAsset::factory()->create(['organization_id' => $orgId]);
            Storage::disk('local')->put($asset->storage_path, $this->pngBytes());

            return $asset->id;
        };
        $a1 = GalleryImage::factory()->create([
            'organization_id' => $orgId, 'album_id' => $albumA, 'media_id' => $mediaId(), 'sort_order' => 0,
        ])->id;
        $a2 = GalleryImage::factory()->create([
            'organization_id' => $orgId, 'album_id' => $albumA, 'media_id' => $mediaId(), 'sort_order' => 1,
        ])->id;
        $b1 = GalleryImage::factory()->create([
            'organization_id' => $orgId, 'album_id' => $albumB, 'media_id' => $mediaId(), 'sort_order' => 0,
        ])->id;

        // Snake_case (the real wire): only album A's rows, nothing else.
        $page = $this->getJson("/api/v1/gallery/images?album_id=$albumA&per_page=200")->assertOk();
        $this->assertSame([$a1, $a2], array_column($page->json('data'), 'id'));
        $this->assertSame(2, $page->json('meta.total'));

        // CamelCase keeps working (backward compatibility, never silently dropped).
        $page = $this->getJson("/api/v1/gallery/images?albumId=$albumB&per_page=200")->assertOk();
        $this->assertSame([$b1], array_column($page->json('data'), 'id'));

        // No filter: previous behavior (everything, still paged).
        $this->getJson('/api/v1/gallery/images?per_page=200')->assertOk()->assertJsonPath('meta.total', 3);
    }

    public function test_removing_an_image_frees_only_unreferenced_media(): void
    {
        $this->actingAsRole('administrator');
        $orgId = $this->defaultOrganization()->id;
        $albumId = $this->makeAlbum();
        $shared = $this->uploadImage('shared.png');
        $solo = $this->uploadImage('solo.png');

        // The shared asset is referenced by a student photo too, so the
        // gallery must keep it; the solo asset belongs to the gallery alone.
        Student::factory()->create(['organization_id' => $orgId, 'deferred' => ['photoMediaId' => $shared]]);
        $soloId = $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $solo, 'caption' => 'تنها', 'alt' => 'متن جایگزین تنها',
        ])->assertCreated()->json('data.id');
        $sharedId = $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $shared, 'caption' => 'مشترک', 'alt' => 'متن جایگزین مشترک',
        ])->assertCreated()->json('data.id');

        $this->deleteJson("/api/v1/gallery/images/$soloId")->assertNoContent();
        $this->assertNull(MediaAsset::query()->whereKey($solo)->first());

        $this->deleteJson("/api/v1/gallery/images/$sharedId")->assertNoContent();
        $this->assertNotNull(MediaAsset::query()->whereKey($shared)->first());

        // The album delete keeps the same promise: the cover it pointed at
        // stays only while something else references it.
        $coverAlbum = $this->postJson('/api/v1/gallery/albums', ['title' => 'جلددار', 'coverMediaId' => $shared])
            ->assertCreated()->json('data.id');
        $this->deleteJson("/api/v1/gallery/albums/$coverAlbum")->assertNoContent();
        $this->assertNotNull(MediaAsset::query()->whereKey($shared)->first());
        $this->assertSame(0, GalleryImage::query()->where('album_id', $albumId)->count());
    }

    public function test_gallery_bytes_follow_gallery_read(): void
    {
        $this->actingAsRole('manager');
        $albumId = $this->makeAlbum();
        $mediaId = $this->uploadImage();
        $this->postJson('/api/v1/gallery/images', [
            'albumId' => $albumId, 'mediaId' => $mediaId, 'caption' => 'قاب', 'alt' => 'متن جایگزین قاب',
        ])->assertCreated();

        // A linked teacher — one whose account points at a real teacher —
        // may open the showcase and read its bytes.
        $teacherUser = $this->makeUser('teacher', ['teacher_id' => 't_gallery']);
        \App\Models\Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't_gallery']);
        $this->useToken($this->tokenFor($teacherUser));
        $this->get("/api/v1/media/$mediaId/bytes")->assertOk();

        // An UNLINKED teacher fails closed everywhere (PB-1) — including
        // here, where the student branch runs before the gallery branch.
        // The refusal is the point; the code names the reason.
        $this->actingAsRole('teacher');
        $this->get("/api/v1/media/$mediaId/bytes")
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB1');

        // Accounting may not: no gallery.read, and the asset is nothing else.
        $this->actingAsRole('accountant');
        $this->get("/api/v1/media/$mediaId/bytes")->assertStatus(403);

        // The media list is the same projection: the manager sees the
        // gallery asset, the accountant does not.
        $this->actingAsRole('manager');
        $this->getJson('/api/v1/media?per_page=200')->assertJsonFragment(['id' => $mediaId]);
        $this->actingAsRole('accountant');
        $response = $this->getJson('/api/v1/media?per_page=200')->assertOk();
        $this->assertNotContains($mediaId, array_column($response->json('data'), 'id'));
    }

    public function test_tenant_isolation_is_404(): void
    {
        $albumId = $this->makeAlbum();
        $foreign = $this->makeOrganization();
        $this->actingAsRole('administrator', [], $foreign);

        $this->getJson("/api/v1/gallery/albums/$albumId")->assertStatus(404);
        $this->getJson('/api/v1/gallery/albums')->assertJsonPath('meta.total', 0);
    }

    public function test_gallery_permissions_exist_in_the_vocabulary(): void
    {
        $this->assertContains('gallery.read', config('permissions.vocabulary'));
        $this->assertContains('gallery.write', config('permissions.vocabulary'));
    }

    public function test_album_service_round_trip_and_tenant_isolation(): void
    {
        $org = $this->defaultOrganization();
        $this->bindTenant($org);
        $service = app(GalleryService::class);

        $album = $service->createAlbum(['title' => 'استودیو', 'description' => '']);
        $asset = MediaAsset::factory()->create(['organization_id' => $org->id]);
        Storage::disk('local')->put($asset->storage_path, $this->pngBytes());
        $image = $service->addImage([
            'albumId' => $album->id,
            'mediaId' => $asset->id,
            'caption' => 'قاب',
            'alt' => 'متن جایگزین',
        ]);
        $service->reorderImage($image, 0);
        $service->removeImage($image);
        $service->deleteAlbum($album);

        $this->assertSame(0, GalleryAlbum::query()->count());
        $this->assertSame(0, GalleryImage::query()->count());

        $foreign = GalleryAlbum::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->assertApiError('ALBUM_NOT_FOUND', 404, fn () => $service->getAlbum($foreign->id));
    }

    private function assertApiError(string $code, int $status, callable $call): void
    {
        try {
            $call();
            $this->fail("Expected ApiException $code");
        } catch (ApiException $e) {
            $this->assertSame($code, $e->errorCode);
            $this->assertSame($status, $e->status);
        }
    }
}
