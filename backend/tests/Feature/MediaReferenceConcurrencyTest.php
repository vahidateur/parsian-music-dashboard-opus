<?php

namespace Tests\Feature;

use App\Domain\Media\MediaReferenceLock;
use App\Domain\Media\MediaService;
use App\Models\MediaAsset;
use App\Models\Organization;
use App\Models\Resource;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

/**
 * Real row-lock integration tests. SQLite does not implement SELECT ... FOR
 * UPDATE, so these two interleavings run in the MySQL 8 CI leg only; the
 * service-level failure/retry cases remain covered by MediaTest on both DBs.
 */
class MediaReferenceConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    private const COMPETING_CONNECTION = 'media_reference_competitor';

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('MySQL row-lock interleavings are exercised in the dedicated MySQL CI leg.');
        }

        Storage::fake('local');
        $config = config('database.connections.'.DB::getDefaultConnection());
        config(['database.connections.'.self::COMPETING_CONNECTION => $config]);
        DB::purge(self::COMPETING_CONNECTION);
        DB::connection(self::COMPETING_CONNECTION)->statement('SET SESSION innodb_lock_wait_timeout = 1');
    }

    public function test_a_reference_writer_cannot_attach_while_delete_holds_the_asset_lock(): void
    {
        [$organization, $asset, $path] = $this->makeAsset();
        app(TenantContext::class)->set($organization->id);

        $competitor = DB::connection(self::COMPETING_CONNECTION);
        $guard = app(MediaReferenceLock::class);
        $baseDisk = Storage::disk('local');
        $disk = Mockery::mock($baseDisk)->makePartial();
        $writerWasBlocked = false;
        $disk->shouldReceive('delete')->once()->andReturnUsing(function (string $deletePath) use ($competitor, $guard, $asset, $baseDisk, &$writerWasBlocked): bool {
            try {
                $competitor->transaction(
                    fn (): bool => $guard->lockAvailable($asset->id, self::COMPETING_CONNECTION),
                );
            } catch (QueryException $failure) {
                $writerWasBlocked = str_contains($failure->getMessage(), 'Lock wait timeout exceeded');
            }

            if (! $writerWasBlocked) {
                throw new \RuntimeException('Concurrent reference writer was not blocked by the media delete lock.');
            }

            return $baseDisk->delete($deletePath);
        });
        Storage::set('local', $disk);

        app(MediaService::class)->delete($asset);

        $this->assertTrue($writerWasBlocked);
        $this->assertNull(MediaAsset::query()->whereKey($asset->id)->first());
        $baseDisk->assertMissing($path);
        $this->assertFalse($competitor->transaction(
            fn (): bool => $guard->lockAvailable($asset->id, self::COMPETING_CONNECTION),
        ), 'after delete commits, the serialized writer must not see an available asset');
    }

    public function test_delete_waits_for_a_reference_writer_then_refuses_to_free_its_bytes(): void
    {
        [$organization, $asset, $path] = $this->makeAsset();
        app(TenantContext::class)->set($organization->id);

        $writer = DB::connection();
        $competitor = DB::connection(self::COMPETING_CONNECTION);
        $guard = app(MediaReferenceLock::class);
        $writer->beginTransaction();
        try {
            $this->assertTrue($guard->lockAvailable($asset->id));
            Resource::factory()->create([
                'organization_id' => $organization->id,
                'media_id' => $asset->id,
            ]);

            try {
                $competitor->transaction(function () use ($asset): void {
                    MediaAsset::on(self::COMPETING_CONNECTION)
                        ->whereKey($asset->id)
                        ->lockForUpdate()
                        ->first();
                });
                $this->fail('Media delete must wait while a reference writer owns the asset lock.');
            } catch (QueryException $failure) {
                $this->assertStringContainsString('Lock wait timeout exceeded', $failure->getMessage());
            }

            $writer->commit();
        } catch (\Throwable $failure) {
            if ($writer->transactionLevel() > 0) {
                $writer->rollBack();
            }
            throw $failure;
        }

        $this->assertNotNull(MediaAsset::query()->whereKey($asset->id)->first());
        Storage::disk('local')->assertExists($path);
        $this->assertTrue($this->app->make(\App\Domain\Media\MediaReferences::class)->isStillReferenced($asset->id));
        try {
            app(MediaService::class)->delete($asset);
            $this->fail('A committed reference must prevent deletion.');
        } catch (\App\Support\Api\ApiException $failure) {
            $this->assertSame('MEDIA_IN_USE', $failure->errorCode);
        }
        Storage::disk('local')->assertExists($path);
    }

    /** @return array{Organization, MediaAsset, string} */
    private function makeAsset(): array
    {
        $organization = Organization::factory()->create();
        $id = 'md_lock_'.strtolower((string) Str::ulid());
        $path = 'media/'.$organization->id.'/'.$id;
        $asset = MediaAsset::factory()->create([
            'id' => $id,
            'organization_id' => $organization->id,
            'storage_path' => $path,
        ]);
        Storage::disk('local')->put($path, 'private-media-test-bytes');

        return [$organization, $asset, $path];
    }
}
