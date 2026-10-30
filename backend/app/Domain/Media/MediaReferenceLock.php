<?php

namespace App\Domain\Media;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Throwable;

/**
 * Shared serialization contract for every persisted MediaAsset reference.
 *
 * Call `lockAvailable()` inside the same database transaction that writes the
 * referencing row. The row lock is held through commit and is shared with
 * MediaService::delete(). Checking the private object after taking the lock
 * also refuses to attach metadata left behind by a failed storage/DB delete.
 * Request validation may use `isAvailable()` as an early, non-authoritative
 * preflight; the transactional lock is the commit-time guarantee.
 */
final class MediaReferenceLock
{
    private const DISK = 'local';

    /**
     * Lock one tenant-visible asset and verify its private bytes still exist.
     *
     * @param  string|null  $connectionName  Optional connection alias for lock tests.
     */
    public function lockAvailable(string $mediaId, ?string $connectionName = null): bool
    {
        $asset = $this->lockAsset($mediaId, $connectionName);

        return $asset !== null && $this->bytesExist($asset);
    }

    /** The same row lock used by attachment writers, for the delete side. */
    public function lockAsset(string $mediaId, ?string $connectionName = null): ?MediaAsset
    {
        $connection = DB::connection($connectionName);
        if ($connection->transactionLevel() < 1) {
            throw new LogicException('Media references must be locked inside their write transaction.');
        }

        return MediaAsset::on($connection->getName())
            ->whereKey(trim($mediaId))
            ->lockForUpdate()
            ->first();
    }

    /** Non-locking preflight only; writers must still call lockAvailable(). */
    public function isAvailable(string $mediaId, ?string $connectionName = null): bool
    {
        $asset = MediaAsset::on($connectionName ?? DB::getDefaultConnection())
            ->whereKey(trim($mediaId))
            ->first();

        return $asset !== null && $this->bytesExist($asset);
    }

    private function bytesExist(MediaAsset $asset): bool
    {
        try {
            return Storage::disk(self::DISK)->exists($asset->storage_path);
        } catch (Throwable $cause) {
            Log::error('Media reference availability check failed.', [
                'operation' => 'reference_availability',
                'asset_id' => $asset->id,
                'disk' => self::DISK,
                'exception_class' => $cause::class,
            ]);

            return false;
        }
    }
}
