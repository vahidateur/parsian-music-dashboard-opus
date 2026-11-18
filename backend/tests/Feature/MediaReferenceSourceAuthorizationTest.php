<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\ChatMessage;
use App\Models\Enrollment;
use App\Models\GalleryAlbum;
use App\Models\MediaAsset;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * A media reference must never be the source of its own authorization.
 *
 * The actor must already be entitled to read the asset in its source context
 * before a chat message, gallery image or any other parent can reference it.
 */
final class MediaReferenceSourceAuthorizationTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function png(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function media(string $id, string $organizationId, ?string $uploaderId): MediaAsset
    {
        $asset = MediaAsset::factory()->create([
            'id' => $id,
            'organization_id' => $organizationId,
            'uploaded_by' => $uploaderId,
        ]);
        Storage::disk('local')->put($asset->storage_path, $this->png());

        return $asset;
    }

    private function studentPhoto(string $studentId, string $classId, string $assetId): void
    {
        Student::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'id' => $studentId,
            'deferred' => ['photoMediaId' => $assetId],
        ]);
        Enrollment::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'student_id' => $studentId,
            'class_id' => $classId,
            'status' => 'active',
        ]);
    }

    private function conversation(): string
    {
        return $this->postJson('/api/v1/chat/conversations', [
            'name' => 'پیوست',
            'role' => 'staff',
            'topic' => 't',
            'participantIds' => [],
        ])->assertCreated()->json('data.id');
    }

    public function test_teacher_cannot_attach_an_out_of_scope_student_photo_to_a_conversation(): void
    {
        $teacher = $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't2']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t2', 'teacher_id' => 't2']);
        $this->studentPhoto('st_other', 'c_t2', 'md_other');
        $this->media('md_other', $org, $teacher->id);

        $this->get('/api/v1/media/md_other/bytes')->assertStatus(403);

        $thread = $this->conversation();
        $before = ChatMessage::query()->count();

        $this->postJson("/api/v1/chat/conversations/$thread/messages", [
            'body' => 'ببین',
            'mediaId' => 'md_other',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'MESSAGE_INVALID')
            ->assertJsonPath('error.fields.mediaId.0', 'فایل انتخاب‌شده برای این حساب مجاز نیست.');

        $this->assertSame($before, ChatMessage::query()->count());
        $this->get('/api/v1/media/md_other/bytes')->assertStatus(403);
    }

    public function test_teacher_can_attach_a_photo_from_a_student_in_their_own_scope(): void
    {
        $teacher = $this->actingAsRole('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t1', 'teacher_id' => 't1']);
        $this->studentPhoto('st_mine', 'c_t1', 'md_mine');
        $this->media('md_mine', $org, $teacher->id);

        $thread = $this->conversation();
        $this->postJson("/api/v1/chat/conversations/$thread/messages", [
            'body' => 'ببین',
            'mediaId' => 'md_mine',
        ])->assertCreated();

        $this->get('/api/v1/media/md_mine/bytes')->assertOk();
    }

    public function test_cross_tenant_media_cannot_be_attached(): void
    {
        $manager = $this->actingAsRole('manager');
        $foreign = $this->makeOrganization();
        $this->media('md_foreign', $foreign->id, null);

        $thread = $this->conversation();
        $before = ChatMessage::query()->count();

        $this->postJson("/api/v1/chat/conversations/$thread/messages", [
            'body' => 'ببین',
            'mediaId' => 'md_foreign',
        ])->assertStatus(422)->assertJsonPath('error.code', 'MESSAGE_INVALID');

        $this->assertSame($before, ChatMessage::query()->count());
    }

    public function test_gallery_cannot_reference_an_asset_the_actor_cannot_read(): void
    {
        $manager = $this->actingAsRole('manager');
        $staff = $this->makeUser('staff');
        $this->media('md_staged', $manager->organization_id, $staff->id);

        $this->get('/api/v1/media/md_staged/bytes')->assertStatus(403);

        $album = GalleryAlbum::factory()->create(['organization_id' => $manager->organization_id]);
        $before = \App\Models\GalleryImage::query()->count();

        $this->postJson('/api/v1/gallery/images', [
            'albumId' => $album->id,
            'mediaId' => 'md_staged',
            'caption' => 'تصویر',
            'alt' => 'تصویر آزمایشی',
        ])->assertStatus(422)->assertJsonPath('error.code', 'GALLERY_IMAGE_INVALID');

        $this->assertSame($before, \App\Models\GalleryImage::query()->count());
    }
}
