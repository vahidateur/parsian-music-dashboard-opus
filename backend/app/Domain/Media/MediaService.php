<?php

namespace App\Domain\Media;

use App\Models\MediaAsset;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Iso;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Media persistence — metadata in the database, bytes on the private disk.
 *
 * THE SPLIT
 *   metadata → `media_assets` (this service)
 *   bytes    → the `local` disk (`storage/app/private`), addressed by
 *              `storage_path`
 *
 * The bytes are NEVER written where a web server can serve them directly.
 * The panel is private and the files are personal data (a student's face), so
 * the only way to read a byte is `GET /media/{id}/bytes`, which authenticates
 * the caller and authorizes the READER against the record that shows the
 * asset. A public symlink would turn a member photo into a URL anyone can
 * fetch.
 *
 * TENANT ISOLATION
 * Every query goes through `MediaAsset`, which carries the
 * `BelongsToOrganization` global scope: reads are constrained to the current
 * tenant, and with no resolved tenant the scope matches NOTHING (fail
 * closed). New rows take `organization_id` from the context — request input
 * never supplies one. The storage path is derived from the tenant, so two
 * organizations can never address each other's files.
 */
final class MediaService
{
    /** The disk the bytes live on. Private: no public URL, no symlink. */
    private const DISK = 'local';

    public function __construct(
        private readonly MediaReferences $references,
        private readonly MediaReferenceLock $referenceLock,
    ) {}

    /**
     * The assets the actor may see.
     *
     * The visible set is decided by the policy (it owns the permissions and
     * the scope); this method only pages it.
     *
     * @param  list<string>  $visibleIds
     * @param  array<string, mixed>  $filters  validated query (kind, search)
     */
    public function paginateVisible(array $visibleIds, array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        return MediaAsset::query()
            ->when(filled($filters['kind'] ?? null), fn (Builder $q): Builder => $q->where('kind', $filters['kind']))
            ->when(filled($filters['search'] ?? null), fn (Builder $q): Builder => $q->where('filename', 'like', '%'.$filters['search'].'%'))
            ->whereIn('id', $visibleIds)
            ->orderByDesc('created_at')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function findOrFail(string $id): MediaAsset
    {
        $asset = MediaAsset::query()->whereKey($id)->first();

        if ($asset === null) {
            throw ApiException::notFound('MEDIA_NOT_FOUND', 'فایل یافت نشد.');
        }

        return $asset;
    }

    /**
     * Stores a new binary and its metadata as one coordinated operation.
     *
     * The database transaction rolls metadata back when the storage write
     * fails. Storage is not transactional, so if bytes were written but the
     * database transaction later fails, the catch below compensates by deleting
     * those bytes. A failed compensation is logged for operator recovery.
     *
     * @param  array<string, mixed>  $input  validated input (kind, filename, mimeType, bytes, …)
     */
    public function create(User $actor, array $input): MediaAsset
    {
        $bytes = $input['bytes'];
        $kind = $input['kind'];
        $mimeType = $this->validatedMimeType($kind, $input['mimeType'] ?? null, $bytes);
        $filename = MediaRules::sanitizeFilename((string) ($input['filename'] ?? 'file'));
        $id = 'md_'.strtolower((string) Str::ulid());
        $path = $this->storagePath($id);
        $writeAttempted = false;
        $bytesWritten = false;

        try {
            return DB::transaction(function () use ($actor, $id, $kind, $filename, $mimeType, $bytes, $path, $input, &$writeAttempted, &$bytesWritten): MediaAsset {
                $asset = new MediaAsset;
                $asset->id = $id;
                $asset->kind = $kind;
                $asset->filename = $filename;
                $asset->mime_type = $mimeType;
                $asset->size_bytes = strlen($bytes);
                $asset->storage_path = $path;
                $asset->uploaded_by = $actor->id;
                if (isset($input['width'])) {
                    $asset->width = (int) $input['width'];
                }
                if (isset($input['height'])) {
                    $asset->height = (int) $input['height'];
                }
                if (isset($input['durationSeconds'])) {
                    $asset->duration_seconds = (int) $input['durationSeconds'];
                }
                if (! empty($input['peaks']) && is_array($input['peaks'])) {
                    $asset->peaks = $input['peaks'];
                }

                $asset->save();

                $writeAttempted = true;
                try {
                    $written = Storage::disk(self::DISK)->put($path, $bytes);
                } catch (\Throwable $cause) {
                    $this->logOperationFailure('upload_write', $id, 'exception', $cause);
                    throw $this->uploadFailure();
                }

                // Laravel's filesystem adapter may return false instead of
                // throwing when a disk is configured with `throw => false`.
                if ($written !== true) {
                    $this->logOperationFailure('upload_write', $id, 'returned_false');
                    throw $this->uploadFailure();
                }

                $bytesWritten = true;

                return $asset->refresh();
            });
        } catch (ApiException $failure) {
            // The transaction has rolled back before this catch is reached.
            // A failed put may still have left a partial object, so compensate
            // after any attempted write, not only after a reported success.
            if ($writeAttempted || $bytesWritten) {
                $this->removeBytesAfterRollback($id, $path);
            }

            throw $failure;
        } catch (\Throwable $cause) {
            // Database failures can happen before or after the storage write.
            // Keep the API response generic in either case, and compensate
            // only when a write was attempted (it may have left partial bytes).
            $operation = $bytesWritten ? 'upload_commit' : 'upload_metadata';
            $this->logOperationFailure($operation, $id, 'exception', $cause);
            if ($writeAttempted || $bytesWritten) {
                $this->removeBytesAfterRollback($id, $path);
            }

            throw $this->uploadFailure();
        }
    }

    /**
     * Frees an unreferenced asset under the shared reference-row lock.
     *
     * Every reference writer takes this same MediaAsset row lock and verifies
     * that the bytes exist before committing its reference. Holding the lock
     * from the global reference check through storage deletion and metadata
     * deletion prevents a concurrent writer from attaching while bytes are
     * being removed. If SQL fails after the object is gone, the metadata row
     * may remain; reference writers then refuse it because its bytes are
     * absent, and retrying this delete is safe for the configured local disk.
     *
     * Storage and SQL are not a distributed transaction. A database failure
     * after byte deletion is recoverable by retrying this operation, but a
     * simultaneous storage failure may still require operator recovery.
     */
    public function delete(MediaAsset $asset): void
    {
        try {
            DB::transaction(function () use ($asset): void {
                $locked = $this->referenceLock->lockAsset($asset->id);

                // A second concurrent DELETE can finish after the first one;
                // the already-removed asset is an idempotent success.
                if ($locked === null) {
                    return;
                }

                if ($this->references->isStillReferenced($locked->id)) {
                    throw ApiException::conflict('MEDIA_IN_USE', 'این فایل هنوز در یک رکورد استفاده شده است.');
                }

                try {
                    $deleted = Storage::disk(self::DISK)->delete($locked->storage_path);
                } catch (\Throwable $cause) {
                    $this->logOperationFailure('delete_bytes', $locked->id, 'exception', $cause);
                    throw $this->deleteFailure();
                }

                // With the configured private local disk, deleting an already-
                // missing object is an idempotent success, allowing recovery
                // after a prior SQL failure that left metadata behind.
                if ($deleted !== true) {
                    $this->logOperationFailure('delete_bytes', $locked->id, 'returned_false');
                    throw $this->deleteFailure();
                }

                try {
                    if ($locked->delete() !== true) {
                        throw new \RuntimeException('Media metadata delete was refused.');
                    }
                } catch (\Throwable $cause) {
                    $this->logOperationFailure('delete_metadata', $locked->id, 'exception', $cause);
                    throw $this->deleteFailure();
                }
            });
        } catch (ApiException $failure) {
            throw $failure;
        } catch (\Throwable $cause) {
            // Includes a commit failure after the private bytes were deleted.
            $this->logOperationFailure('delete_metadata', $asset->id, 'exception', $cause);
            throw $this->deleteFailure();
        }
    }

    private function uploadFailure(): ApiException
    {
        return new ApiException(500, 'MEDIA_STORAGE_FAILED', 'ذخیرهٔ فایل ناموفق بود.');
    }

    private function deleteFailure(): ApiException
    {
        return new ApiException(500, 'MEDIA_DELETE_FAILED', 'حذف فایل کامل نشد. دوباره تلاش کنید.');
    }

    /**
     * Best-effort compensation after the database has rolled back an upload.
     * Failure is logged so the private-storage orphan can be investigated.
     */
    private function removeBytesAfterRollback(string $assetId, string $path): void
    {
        try {
            if (Storage::disk(self::DISK)->delete($path) !== true) {
                $this->logOperationFailure('upload_rollback_cleanup', $assetId, 'returned_false');
            }
        } catch (\Throwable $cause) {
            $this->logOperationFailure('upload_rollback_cleanup', $assetId, 'exception', $cause);
        }
    }

    /**
     * Log only operational identifiers and exception type, never an adapter's
     * message (which can contain private paths, URLs or credentials).
     */
    private function logOperationFailure(string $operation, string $assetId, string $failure, ?\Throwable $cause = null): void
    {
        \Illuminate\Support\Facades\Log::error('Media operation failed.', [
            'operation' => $operation,
            'asset_id' => $assetId,
            'disk' => self::DISK,
            'failure' => $failure,
            'exception_class' => $cause === null ? null : $cause::class,
        ]);
    }

    /**
     * The bytes of an asset, for the authenticated download endpoint.
     */
    public function bytes(MediaAsset $asset): string
    {
        $disk = Storage::disk(self::DISK);

        if (! $disk->exists($asset->storage_path)) {
            throw ApiException::notFound('MEDIA_NOT_FOUND', 'فایل یافت نشد.');
        }

        return $disk->get($asset->storage_path);
    }

    /**
     * The MIME type the asset is stored under.
     *
     * The client's claim is only a HINT: the type must be on the allow-list
     * for the kind, and the bytes must carry the matching signature. A file
     * that lies about its type is rejected, not re-labelled.
     */
    private function validatedMimeType(string $kind, ?string $claimed, string $bytes): string
    {
        $allowed = MediaRules::allowedTypesFor($kind);

        if ($claimed === null || ! in_array($claimed, $allowed, true)) {
            throw ApiException::validation('MEDIA_INVALID', 'فایل انتخاب‌شده معتبر نیست.', [
                'mimeType' => ['قالب مجاز نیست. قالب‌های مجاز: '.implode('، ', $allowed)],
            ]);
        }

        $max = MediaRules::maxBytesFor($kind);
        if ($bytes === '') {
            throw ApiException::validation('MEDIA_INVALID', 'فایل انتخاب‌شده معتبر نیست.', [
                'bytes' => ['فایل خالی است.'],
            ]);
        }
        if (strlen($bytes) > $max) {
            throw ApiException::validation('MEDIA_INVALID', 'فایل انتخاب‌شده معتبر نیست.', [
                'bytes' => ['حجم فایل بیش از حد مجاز است (حداکثر '.intdiv($max, 1024 * 1024).' مگابایت).'],
            ]);
        }

        if (! MediaRules::matchesSignature($claimed, substr($bytes, 0, 16))) {
            throw ApiException::validation('MEDIA_INVALID', 'فایل انتخاب‌شده معتبر نیست.', [
                'bytes' => ['محتوای فایل با قالب اعلام‌شده هم‌خوان نیست.'],
            ]);
        }

        return $claimed;
    }

    /**
     * Where the bytes live, derived from the tenant and the asset id.
     *
     * The path is never taken from the client, and the filename the client
     * sent is NOT part of it — a display name must never become a path.
     */
    private function storagePath(string $id): string
    {
        $organizationId = app(\App\Support\Tenancy\TenantContext::class)->organizationId();

        return 'media/'.$organizationId.'/'.$id;
    }

    /** The wire shape of an asset. Never carries the storage path. */
    public static function toWire(MediaAsset $asset): array
    {
        $wire = [
            'id' => $asset->id,
            'kind' => $asset->kind,
            'filename' => $asset->filename,
            'mimeType' => $asset->mime_type,
            'sizeBytes' => $asset->size_bytes,
            'createdAt' => Iso::format($asset->created_at),
        ];

        if ($asset->width !== null) {
            $wire['width'] = $asset->width;
        }
        if ($asset->height !== null) {
            $wire['height'] = $asset->height;
        }
        if ($asset->duration_seconds !== null) {
            $wire['durationSeconds'] = $asset->duration_seconds;
        }
        if (is_array($asset->peaks) && $asset->peaks !== []) {
            $wire['peaks'] = $asset->peaks;
        }

        return $wire;
    }
}
