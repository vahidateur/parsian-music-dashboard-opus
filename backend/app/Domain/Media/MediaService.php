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

    public function __construct(private readonly MediaReferences $references) {}

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
     * Stores a new binary: metadata first, then the bytes.
     *
     * The order matters. If the byte write fails, the metadata row is rolled
     * back rather than left dangling — a row that points at bytes which were
     * never stored is exactly the "record points at freed bytes" defect the
     * media domain's ownership transition exists to prevent.
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

        $asset = DB::transaction(function () use ($actor, $id, $kind, $filename, $mimeType, $bytes, $path, $input): MediaAsset {
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
            return $asset;
        });

        try {
            Storage::disk(self::DISK)->put($path, $bytes);
        } catch (\Throwable $cause) {
            // The metadata must not outlive a failed byte write.
            MediaAsset::query()->whereKey($asset->id)->delete();

            throw ApiException::validation('MEDIA_STORAGE_FAILED', 'ذخیرهٔ فایل ناموفق بود.', [
                'bytes' => [$cause->getMessage()],
            ]);
        }

        return $asset->refresh();
    }

    /**
     * Frees an asset: the bytes first, then the metadata.
     *
     * The order is the other way round from the create, and for the same
     * reason: a metadata row that is gone while the bytes remain is a leak,
     * while bytes that are gone while the row remains is a broken record.
     * Deleting the row first and failing to delete the bytes leaves an
     * orphan file (harmless, invisible, reclaimable); deleting the bytes
     * first and failing to delete the row leaves a record pointing at
     * nothing (visible, broken). The first is the safer failure.
     *
     * A still-referenced asset is REFUSED, not freed: the reference check is
     * global (see `MediaReferences`), so an asset another record points at
     * cannot be deleted by whoever uploaded it.
     */
    public function delete(MediaAsset $asset): void
    {
        if ($this->references->isStillReferenced($asset->id)) {
            throw ApiException::conflict('MEDIA_IN_USE', 'این فایل هنوز در یک رکورد استفاده شده است.');
        }

        Storage::disk(self::DISK)->delete($asset->storage_path);

        MediaAsset::query()->whereKey($asset->id)->delete();
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
