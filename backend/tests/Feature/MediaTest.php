<?php

namespace Tests\Feature;

use App\Domain\Media\MediaReferenceLock;
use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Instrument;
use App\Models\MediaAsset;
use App\Models\Resource;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Media — the binary store behind the member photos.
 *
 * WHAT IS ASSERTED HERE
 *  - the wire contract of `src/domains/media/apiRepository.ts`: the camelCase
 *    shape, the paged envelope, and the 201/204/404 statuses;
 *  - the validation policy, server-side: the allow-list, the magic-byte check
 *    (a file that lies about its type is refused) and the size ceiling;
 *  - PER-OBJECT authorization: a teacher's photo is readable by a teacher who
 *    may see that student, and NOT by a teacher who may not — the scope rule
 *    (T-02) applied to bytes rather than to rows;
 *  - the lifetime rule: an asset a record still references cannot be freed,
 *    whatever the uploader is.
 */
class MediaTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const BASE = '/api/v1/media';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /** A real 1x1 PNG — the bytes must carry the signature, not just the name. */
    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function upload(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        $file = $overrides['file'] ?? UploadedFile::fake()->createWithContent('photo.png', $this->pngBytes());
        $attributes = [
            'kind' => 'image',
            'mimeType' => 'image/png',
        ];

        return $this->post(self::BASE, $attributes + [
            'file' => $file,
        ], ['Accept' => 'application/json']);
    }

    /* ------------------------------------------------------------------ */
    /* authentication                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->asGuest();

        $this->getJson(self::BASE)->assertStatus(401);
        $this->post(self::BASE, [], ['Accept' => 'application/json'])->assertStatus(401);
        $this->getJson(self::BASE.'/md_missing')->assertStatus(401);
        $this->getJson(self::BASE.'/md_missing/bytes')->assertStatus(401);
        $this->deleteJson(self::BASE.'/md_missing')->assertStatus(401);
    }

    /* ------------------------------------------------------------------ */
    /* upload                                                               */
    /* ------------------------------------------------------------------ */

    public function test_an_actor_who_may_write_a_record_can_upload(): void
    {
        // The staff member registers students, so a student photo is theirs
        // to upload. The accountant holds no write permission at all.
        $this->actingAsRole('staff');
        $this->upload()->assertCreated()->assertJsonPath('data.kind', 'image')
            ->assertJsonPath('data.mimeType', 'image/png')
            ->assertJsonPath('data.filename', 'photo.png');

        $this->actingAsRole('accountant');
        $this->upload()
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_the_bytes_are_stored_on_the_private_disk_and_not_in_the_database(): void
    {
        $this->actingAsRole('administrator');
        $id = $this->upload()->assertCreated()->json('data.id');

        $asset = MediaAsset::query()->whereKey($id)->firstOrFail();

        Storage::disk('local')->assertExists($asset->storage_path);
        $this->assertSame($this->pngBytes(), Storage::disk('local')->get($asset->storage_path));

        // The metadata row never holds the bytes.
        $this->assertStringNotContainsString($this->pngBytes(), json_encode($asset->toArray()));
    }

    public function test_a_false_storage_put_fails_the_upload_and_rolls_back_metadata_and_partial_bytes(): void
    {
        $this->actingAsRole('administrator');
        $writtenPath = null;
        $baseDisk = Storage::disk('local');
        $disk = \Mockery::mock($baseDisk)->makePartial();
        $disk->shouldReceive('put')->once()->andReturnUsing(function (string $path, string $bytes) use ($baseDisk, &$writtenPath): bool {
            $writtenPath = $path;
            $baseDisk->put($path, $bytes);

            return false;
        });
        Storage::set('local', $disk);

        $this->upload()
            ->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_STORAGE_FAILED')
            ->assertJsonPath('error.message', 'ذخیرهٔ فایل ناموفق بود.');

        $this->assertDatabaseCount('media_assets', 0);
        $this->assertIsString($writtenPath);
        Storage::disk('local')->assertMissing($writtenPath);
    }

    public function test_failed_upload_cleanup_is_logged_without_leaking_storage_details(): void
    {
        $this->actingAsRole('administrator');
        $secret = '/private/storage/cleanup-adapter-secret';
        $writtenPath = null;
        $baseDisk = Storage::disk('local');
        $disk = \Mockery::mock($baseDisk)->makePartial();
        $disk->shouldReceive('put')->once()->andReturnUsing(function (string $path, string $bytes) use ($baseDisk, &$writtenPath): bool {
            $writtenPath = $path;
            $baseDisk->put($path, $bytes);

            return false;
        });
        $disk->shouldReceive('delete')->once()->andThrow(new RuntimeException($secret));
        Storage::set('local', $disk);
        Log::spy();

        $response = $this->upload();
        $response->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_STORAGE_FAILED')
            ->assertJsonPath('error.message', 'ذخیرهٔ فایل ناموفق بود.');
        $this->assertStringNotContainsString($secret, $response->getContent());
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertIsString($writtenPath);
        // A storage orphan cannot be rolled back by SQL; it remains private and
        // its cleanup failure is logged so an operator can recover it.
        $baseDisk->assertExists($writtenPath);

        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'upload_write'
                && $context['failure'] === 'returned_false'
                && $context['exception_class'] === null
            ),
        )->once();
        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'upload_rollback_cleanup'
                && $context['failure'] === 'exception'
                && $context['exception_class'] === RuntimeException::class
                && ! array_key_exists('exception_message', $context)
            ),
        )->once();
    }

    public function test_a_storage_put_exception_is_sanitized_and_rolls_back_metadata_and_partial_bytes(): void
    {
        $this->actingAsRole('administrator');
        $secret = '/private/storage/adapter-secret';
        $writtenPath = null;
        $baseDisk = Storage::disk('local');
        $disk = \Mockery::mock($baseDisk)->makePartial();
        $disk->shouldReceive('put')->once()->andReturnUsing(function (string $path, string $bytes) use ($baseDisk, $secret, &$writtenPath): never {
            // Model a driver that wrote a partial object before surfacing its failure.
            $writtenPath = $path;
            $baseDisk->put($path, $bytes);
            throw new RuntimeException($secret);
        });
        Storage::set('local', $disk);
        Log::spy();

        $response = $this->upload();
        $response->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_STORAGE_FAILED')
            ->assertJsonPath('error.message', 'ذخیرهٔ فایل ناموفق بود.');
        $this->assertStringNotContainsString($secret, $response->getContent());
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertIsString($writtenPath);
        Storage::disk('local')->assertMissing($writtenPath);

        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'upload_write'
                && $context['failure'] === 'exception'
                && $context['exception_class'] === RuntimeException::class
                && ! array_key_exists('exception_message', $context)
            ),
        )->once();
    }

    public function test_a_database_failure_after_a_successful_put_rolls_back_metadata_and_compensates_bytes(): void
    {
        $uploader = $this->actingAsRole('administrator');
        $assetId = null;
        $failRefresh = true;
        DB::listen(static function (QueryExecuted $query) use (&$assetId, &$failRefresh): void {
            $sql = strtolower($query->sql);
            if ($assetId === null && str_contains($sql, 'insert') && str_contains($sql, 'media_assets')) {
                $assetId = $query->bindings[0] ?? null;

                return;
            }
            if (
                $failRefresh
                && $assetId !== null
                && str_contains($sql, 'select')
                && str_contains($sql, 'media_assets')
                && in_array($assetId, $query->bindings, true)
            ) {
                $failRefresh = false;
                throw new RuntimeException('database-refresh-internal-detail');
            }
        });
        Log::spy();

        $response = $this->upload();
        $response->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_STORAGE_FAILED')
            ->assertJsonPath('error.message', 'ذخیرهٔ فایل ناموفق بود.');
        $this->assertStringNotContainsString('database-refresh-internal-detail', $response->getContent());
        $this->assertIsString($assetId);
        $this->assertDatabaseCount('media_assets', 0);
        Storage::disk('local')->assertMissing('media/'.$uploader->organization_id.'/'.$assetId);
        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'upload_commit'
                && $context['failure'] === 'exception'
                && $context['exception_class'] === RuntimeException::class
            ),
        )->once();
    }

    public function test_a_file_that_lies_about_its_type_is_refused(): void
    {
        $this->actingAsRole('administrator');

        // HTML bytes declared as a PNG: the magic signature does not match.
        $this->upload(['file' => UploadedFile::fake()->createWithContent('evil.png', '<script>alert(1)</script>')])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MEDIA_INVALID');
    }

    public function test_a_type_outside_the_allow_list_is_refused(): void
    {
        $this->actingAsRole('administrator');

        // SVG is excluded on purpose: it is an XML document that can carry script.
        $this->upload([
            'file' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MEDIA_INVALID');
    }

    public function test_an_empty_file_is_refused(): void
    {
        $this->actingAsRole('administrator');

        $this->upload(['file' => UploadedFile::fake()->createWithContent('empty.png', '')])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MEDIA_INVALID');
    }

    /**
     * The waveform peaks travel as one form field holding a JSON array, and
     * the service must decode AND range-check it: a field that is not an
     * array, or one whose points are not numbers, is unusable for the player
     * and must be refused with the field's own error.
     */
    public function test_the_waveform_peaks_are_decoded_and_checked(): void
    {
        $this->actingAsRole('administrator');

        // Valid peaks are stored.
        $file = UploadedFile::fake()->createWithContent('audio.mp3', str_repeat("\xFF\xFB", 32));
        $ok = $this->post(self::BASE, [
            'kind' => 'audio',
            'mimeType' => 'audio/mpeg',
            'peaks' => json_encode([0, 0.5, 1]),
            'file' => $file,
        ], ['Accept' => 'application/json']);
        $ok->assertCreated()->assertJsonPath('data.peaks', [0, 0.5, 1]);

        // A field that is not a JSON array is refused.
        $this->post(self::BASE, [
            'kind' => 'audio',
            'mimeType' => 'audio/mpeg',
            'peaks' => 'not-json',
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('error.fields.peaks.0', 'قالب موج صوتی قابل خواندن نیست.');

        // A point that is not a number is refused.
        $this->post(self::BASE, [
            'kind' => 'audio',
            'mimeType' => 'audio/mpeg',
            'peaks' => json_encode([0.5, 'loud']),
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('error.fields.peaks.0', 'هر نقطهٔ موج باید عدد باشد.');
    }

    /* ------------------------------------------------------------------ */
    /* per-object authorization                                             */
    /* ------------------------------------------------------------------ */

    public function test_a_photo_is_readable_by_an_actor_who_may_see_the_student(): void
    {
        $teacher = $this->makeUser('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;

        // T-02: a teacher sees a student through an ACTIVE ENROLLMENT in their
        // own class — `students.teacher_id` is never consulted.
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t1', 'teacher_id' => 't1']);
        $student = Student::factory()->create([
            'organization_id' => $org,
            'id' => 'st_mine',
            'deferred' => ['photoMediaId' => 'md_photo'],
        ]);
        Enrollment::factory()->create([
            'organization_id' => $org,
            'student_id' => 'st_mine',
            'class_id' => 'c_t1',
            'status' => 'active',
        ]);

        $asset = MediaAsset::factory()->create([
            'id' => 'md_photo',
            'organization_id' => $org,
            'uploaded_by' => $teacher->id,
        ]);
        Storage::disk('local')->put($asset->storage_path, $this->pngBytes());

        $this->useToken($this->tokenFor($teacher));
        $this->getJson(self::BASE.'/md_photo')->assertOk()->assertJsonPath('data.id', 'md_photo');

        $bytes = $this->get(self::BASE.'/md_photo/bytes');
        $bytes->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Content-Type', 'image/png');
        $this->assertSame($this->pngBytes(), $bytes->getContent());
    }

    public function test_a_photo_of_a_student_outside_the_scope_is_not_readable(): void
    {
        // The actor teaches `t1`; the photo belongs to a student of `t2`.
        $teacher = $this->makeUser('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;

        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't2']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t2', 'teacher_id' => 't2']);
        Student::factory()->create([
            'organization_id' => $org,
            'id' => 'st_theirs',
            'deferred' => ['photoMediaId' => 'md_photo'],
        ]);
        Enrollment::factory()->create([
            'organization_id' => $org,
            'student_id' => 'st_theirs',
            'class_id' => 'c_t2',
            'status' => 'active',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_photo',
            'organization_id' => $org,
            'uploaded_by' => $teacher->id,
        ]);

        $this->useToken($this->tokenFor($teacher));
        $this->getJson(self::BASE.'/md_photo')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_a_staged_asset_is_readable_by_its_uploader_only(): void
    {
        $uploader = $this->makeUser('staff');
        MediaAsset::factory()->create([
            'id' => 'md_staged',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);

        $this->useToken($this->tokenFor($uploader));
        $this->getJson(self::BASE.'/md_staged')->assertOk();

        $other = $this->makeUser('manager');
        $this->useToken($this->tokenFor($other));
        $this->getJson(self::BASE.'/md_staged')->assertStatus(403);
    }

    /**
     * An instrument image is readable through `instruments.read` alone.
     *
     * The accountant holds `instruments.read` but neither `teachers.read`
     * nor `library.read`: the same actor must see the instrument card image
     * while a teacher's photo and a library file stay refused. That is the
     * per-object rule doing its job rather than a blanket media grant.
     */
    public function test_an_instrument_image_is_readable_with_instruments_read_only(): void
    {
        $accountant = $this->makeUser('accountant');
        $org = $accountant->organization_id;

        Instrument::factory()->create([
            'id' => 'piano',
            'slug' => 'piano',
            'name' => 'پیانو',
            'organization_id' => $org,
            'image_id' => 'md_card',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_card',
            'organization_id' => $org,
            'uploaded_by' => $accountant->id,
        ]);
        Teacher::factory()->create([
            'organization_id' => $org,
            'photo_media_id' => 'md_teacher',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_teacher',
            'organization_id' => $org,
            'uploaded_by' => $accountant->id,
        ]);
        Resource::factory()->create([
            'organization_id' => $org,
            'media_id' => 'md_file',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_file',
            'organization_id' => $org,
            'uploaded_by' => $accountant->id,
        ]);

        $this->useToken($this->tokenFor($accountant));
        $this->getJson(self::BASE.'/md_card')->assertOk()->assertJsonPath('data.id', 'md_card');
        $this->getJson(self::BASE.'/md_teacher')->assertStatus(403);
        $this->getJson(self::BASE.'/md_file')->assertStatus(403);

        $ids = $this->getJson(self::BASE.'?per_page=200')->assertOk()->json('data.*.id');
        $this->assertContains('md_card', $ids);
        $this->assertNotContains('md_teacher', $ids);
        $this->assertNotContains('md_file', $ids);
    }

    public function test_uploading_does_not_grant_read_access_once_a_record_references_the_asset(): void
    {
        // The uploader branch exists for STAGED assets. Once a record points
        // at the asset, that record's rule decides — otherwise "I uploaded it"
        // would be a way around the scope rule.
        $teacher = $this->makeUser('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;

        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't2']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t2', 'teacher_id' => 't2']);
        Student::factory()->create([
            'organization_id' => $org,
            'id' => 'st_theirs',
            'deferred' => ['photoMediaId' => 'md_photo'],
        ]);
        Enrollment::factory()->create([
            'organization_id' => $org,
            'student_id' => 'st_theirs',
            'class_id' => 'c_t2',
            'status' => 'active',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_photo',
            'organization_id' => $org,
            'uploaded_by' => $teacher->id,
        ]);

        $this->useToken($this->tokenFor($teacher));
        $this->getJson(self::BASE.'/md_photo')->assertStatus(403);
    }

    public function test_the_list_shows_only_what_the_caller_may_see(): void
    {
        $teacher = $this->makeUser('teacher', ['teacher_id' => 't1']);
        $org = $teacher->organization_id;

        Teacher::factory()->create(['organization_id' => $org, 'id' => 't1']);
        Teacher::factory()->create(['organization_id' => $org, 'id' => 't2']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t1', 'teacher_id' => 't1']);
        AcademyClass::factory()->create(['organization_id' => $org, 'id' => 'c_t2', 'teacher_id' => 't2']);

        Student::factory()->create([
            'organization_id' => $org,
            'id' => 'st_mine',
            'deferred' => ['photoMediaId' => 'md_mine'],
        ]);
        Student::factory()->create([
            'organization_id' => $org,
            'id' => 'st_theirs',
            'deferred' => ['photoMediaId' => 'md_theirs'],
        ]);
        foreach ([['st_mine', 'c_t1'], ['st_theirs', 'c_t2']] as [$studentId, $classId]) {
            Enrollment::factory()->create([
                'organization_id' => $org,
                'student_id' => $studentId,
                'class_id' => $classId,
                'status' => 'active',
            ]);
        }
        foreach (['md_mine', 'md_theirs'] as $id) {
            MediaAsset::factory()->create([
                'id' => $id,
                'organization_id' => $org,
                'uploaded_by' => $teacher->id,
            ]);
        }

        $this->useToken($this->tokenFor($teacher));
        $ids = $this->getJson(self::BASE)->assertOk()->json('data.*.id');

        $this->assertContains('md_mine', $ids);
        $this->assertNotContains('md_theirs', $ids);
    }

    /* ------------------------------------------------------------------ */
    /* lifetime                                                            */
    /* ------------------------------------------------------------------ */

    public function test_an_asset_a_record_still_references_cannot_be_freed(): void
    {
        $uploader = $this->makeUser('staff');
        Teacher::factory()->create([
            'organization_id' => $uploader->organization_id,
            'photo_media_id' => 'md_photo',
        ]);
        MediaAsset::factory()->create([
            'id' => 'md_photo',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);

        $this->useToken($this->tokenFor($uploader));
        $this->deleteJson(self::BASE.'/md_photo')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'MEDIA_IN_USE');

        $this->assertNotNull(MediaAsset::query()->whereKey('md_photo')->first());
    }

    public function test_an_unreferenced_asset_can_be_freed(): void
    {
        $uploader = $this->makeUser('staff');
        $this->useToken($this->tokenFor($uploader));

        $id = $this->upload()->assertCreated()->json('data.id');
        $asset = MediaAsset::query()->whereKey($id)->firstOrFail();

        $this->deleteJson(self::BASE.'/'.$id)->assertStatus(204);

        $this->assertNull(MediaAsset::query()->whereKey($id)->first());
        Storage::disk('local')->assertMissing($asset->storage_path);
    }

    public function test_a_false_storage_delete_keeps_the_metadata_and_reports_failure(): void
    {
        $uploader = $this->makeUser('staff');
        $asset = MediaAsset::factory()->create([
            'id' => 'md_delete_false',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);
        $baseDisk = Storage::disk('local');
        $baseDisk->put($asset->storage_path, $this->pngBytes());
        $disk = \Mockery::mock($baseDisk)->makePartial();
        $disk->shouldReceive('delete')->once()->andReturn(false);
        Storage::set('local', $disk);
        Log::spy();
        $this->useToken($this->tokenFor($uploader));

        $this->deleteJson(self::BASE.'/'.$asset->id)
            ->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_DELETE_FAILED')
            ->assertJsonPath('error.message', 'حذف فایل کامل نشد. دوباره تلاش کنید.');

        $this->assertNotNull(MediaAsset::query()->whereKey($asset->id)->first());
        $baseDisk->assertExists($asset->storage_path);
        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'delete_bytes'
                && $context['failure'] === 'returned_false'
            ),
        )->once();
    }

    public function test_a_storage_delete_exception_is_sanitized_and_keeps_metadata(): void
    {
        $uploader = $this->makeUser('staff');
        $asset = MediaAsset::factory()->create([
            'id' => 'md_delete_exception',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);
        $secret = '/private/storage/delete-adapter-secret';
        $baseDisk = Storage::disk('local');
        $baseDisk->put($asset->storage_path, $this->pngBytes());
        $disk = \Mockery::mock($baseDisk)->makePartial();
        $disk->shouldReceive('delete')->once()->andThrow(new RuntimeException($secret));
        Storage::set('local', $disk);
        Log::spy();
        $this->useToken($this->tokenFor($uploader));

        $response = $this->deleteJson(self::BASE.'/'.$asset->id);
        $response->assertStatus(500)
            ->assertJsonPath('error.code', 'MEDIA_DELETE_FAILED')
            ->assertJsonPath('error.message', 'حذف فایل کامل نشد. دوباره تلاش کنید.');
        $this->assertStringNotContainsString($secret, $response->getContent());
        $this->assertNotNull(MediaAsset::query()->whereKey($asset->id)->first());
        $baseDisk->assertExists($asset->storage_path);
        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'delete_bytes'
                && $context['failure'] === 'exception'
                && $context['exception_class'] === RuntimeException::class
                && ! array_key_exists('exception_message', $context)
            ),
        )->once();
    }

    public function test_reference_lock_requires_a_transaction_and_refuses_missing_private_bytes(): void
    {
        $uploader = $this->actingAsRole('staff');
        $asset = MediaAsset::factory()->create(['organization_id' => $uploader->organization_id]);
        $guard = app(MediaReferenceLock::class);

        try {
            $guard->lockAvailable($asset->id);
            $this->fail('A reference lock outside the write transaction cannot protect a commit.');
        } catch (\LogicException $failure) {
            $this->assertStringContainsString('inside their write transaction', $failure->getMessage());
        }

        $this->assertFalse(DB::transaction(fn (): bool => $guard->lockAvailable($asset->id)));
        Storage::disk('local')->put($asset->storage_path, $this->pngBytes());
        $this->assertTrue(DB::transaction(fn (): bool => $guard->lockAvailable($asset->id)));
    }

    public function test_a_missing_file_keeps_the_existing_idempotent_delete_behavior(): void
    {
        $uploader = $this->makeUser('staff');
        $asset = MediaAsset::factory()->create([
            'id' => 'md_file_already_missing',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);
        $this->useToken($this->tokenFor($uploader));

        Storage::disk('local')->assertMissing($asset->storage_path);
        $this->deleteJson(self::BASE.'/'.$asset->id)->assertNoContent();
        $this->assertNull(MediaAsset::query()->whereKey($asset->id)->first());
    }

    public function test_a_metadata_delete_failure_is_retryable_after_the_file_was_removed(): void
    {
        $uploader = $this->makeUser('staff');
        $asset = MediaAsset::factory()->create([
            'id' => 'md_metadata_delete_failure',
            'organization_id' => $uploader->organization_id,
            'uploaded_by' => $uploader->id,
        ]);
        Storage::disk('local')->put($asset->storage_path, $this->pngBytes());
        $this->useToken($this->tokenFor($uploader));
        Log::spy();

        $failDelete = true;
        DB::listen(static function (QueryExecuted $query) use (&$failDelete, $asset): void {
            $sql = strtolower($query->sql);
            if (
                $failDelete
                && str_contains($sql, 'delete')
                && str_contains($sql, 'media_assets')
                && in_array($asset->id, $query->bindings, true)
            ) {
                $failDelete = false;
                throw new RuntimeException('database-delete-internal-detail');
            }
        });

        $response = $this->deleteJson(self::BASE.'/'.$asset->id);
        $response->assertStatus(500)->assertJsonPath('error.code', 'MEDIA_DELETE_FAILED');
        $this->assertStringNotContainsString('database-delete-internal-detail', $response->getContent());
        $this->assertNotNull(MediaAsset::query()->whereKey($asset->id)->first());
        Storage::disk('local')->assertMissing($asset->storage_path);
        $this->assertFalse(DB::transaction(
            fn (): bool => app(MediaReferenceLock::class)->lockAvailable($asset->id),
            1,
        ), 'a writer must not attach metadata whose private bytes are missing');
        Log::shouldHaveReceived('error')->with(
            'Media operation failed.',
            \Mockery::on(static fn (array $context): bool =>
                $context['operation'] === 'delete_metadata'
                && $context['failure'] === 'exception'
                && $context['exception_class'] === RuntimeException::class
            ),
        )->once();

        // The same delete is safe to retry: a missing object is an idempotent
        // storage success, allowing the still-present metadata to be removed.
        $this->deleteJson(self::BASE.'/'.$asset->id)->assertNoContent();
        $this->assertNull(MediaAsset::query()->whereKey($asset->id)->first());
    }

    /* ------------------------------------------------------------------ */
    /* isolation                                                            */
    /* ------------------------------------------------------------------ */

    public function test_another_organizations_asset_is_invisible(): void
    {
        $mine = $this->makeUser('administrator');
        $theirs = $this->makeUser('administrator', [], $this->makeOrganization());
        MediaAsset::factory()->create([
            'id' => 'md_theirs',
            'organization_id' => $theirs->organization_id,
            'uploaded_by' => $theirs->id,
        ]);

        $this->useToken($this->tokenFor($mine));
        $this->getJson(self::BASE.'/md_theirs')->assertStatus(404);
        $this->get(self::BASE.'/md_theirs/bytes')->assertStatus(404);
    }
}
