<?php

namespace App\Domain\Gallery;

use App\Domain\Media\MediaReferences;
use App\Domain\Media\MediaService;
use App\Models\GalleryAlbum;
use App\Models\GalleryImage;
use App\Models\MediaAsset;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Gallery persistence and domain rules of the caller's organization.
 *
 * Two aggregates, one repository: albums own their images the way the demo
 * repository always did — deleting an album removes its image rows, and an
 * image row that leaves (single or cascade delete) frees its media asset
 * only when no record still references it (the global parent check). Update
 * verbs never drop a media reference, so they never free anything: changing
 * a cover or a caption keeps every byte it found.
 *
 * `sort_order` on images is 0-based and contiguous within the album (the
 * demo contract); adding appends, removing renumbers, reorder splices. Album
 * order is a display sequence assigned as max+1.
 *
 * This service carries NO actor and makes NO authorization decision: gallery
 * authorization lives in GalleryPolicy, which the controller calls before
 * reaching this service.
 */
final class GalleryService
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly MediaReferences $references,
        private readonly MediaService $media,
    ) {}

    /* ------------------------------------------------------------ albums */

    /**
     * @param  array<string, mixed>  $filters  search
     */
    public function listAlbums(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = GalleryAlbum::query();
        if (filled($filters['search'] ?? null)) {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('description', 'like', $like));
        }

        return $query->orderBy('sort_order')->orderBy('created_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getAlbum(string $id): GalleryAlbum
    {
        $album = GalleryAlbum::query()->whereKey($id)->first();
        if ($album === null) {
            throw ApiException::notFound('ALBUM_NOT_FOUND', "آلبوم با شناسهٔ {$id} یافت نشد.");
        }

        return $album;
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function createAlbum(array $input): GalleryAlbum
    {
        $album = new GalleryAlbum;
        $album->id = 'gl_'.strtolower((string) Str::ulid());
        $album->organization_id = $this->tenant->organizationId();
        $album->title = trim((string) ($input['title'] ?? ''));
        $album->description = (string) ($input['description'] ?? '');
        $album->cover_media_id = $this->normalizedMediaId($input['coverMediaId'] ?? null);
        $album->sort_order = (int) ($input['sortOrder'] ?? $this->nextAlbumOrder());

        $album->save();

        return $album->refresh();
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function updateAlbum(GalleryAlbum $album, array $input): GalleryAlbum
    {
        if (array_key_exists('title', $input)) {
            $album->title = trim((string) $input['title']);
        }
        if (array_key_exists('description', $input)) {
            $album->description = (string) $input['description'];
        }
        if (array_key_exists('coverMediaId', $input)) {
            $album->cover_media_id = $this->normalizedMediaId($input['coverMediaId']);
        }
        if (array_key_exists('sortOrder', $input)) {
            $album->sort_order = (int) $input['sortOrder'];
        }

        $album->save();

        return $album->refresh();
    }

    public function deleteAlbum(GalleryAlbum $album): void
    {
        $images = GalleryImage::query()->where('album_id', $album->id)->orderBy('sort_order')->get();

        DB::transaction(function () use ($album, $images): void {
            foreach ($images as $image) {
                $image->delete();
            }
            $album->delete();
        });

        // Rows first, bytes after: the reference check must not see the rows
        // this delete just removed as reasons to keep the assets.
        $freed = [];
        foreach ($images as $image) {
            $freed[] = $image->media_id;
        }
        $freed[] = $album->cover_media_id;
        foreach (array_values(array_unique(array_filter($freed))) as $mediaId) {
            $this->releaseIfOrphaned($mediaId);
        }
    }

    /* ------------------------------------------------------------ images */

    /**
     * @param  array<string, mixed>  $filters  albumId
     */
    public function listImages(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = GalleryImage::query();
        if (filled($filters['albumId'] ?? null)) {
            $query->where('album_id', trim((string) $filters['albumId']));
        }

        return $query->orderBy('sort_order')->orderBy('created_at')->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }

    public function getImage(string $id): GalleryImage
    {
        $image = GalleryImage::query()->whereKey($id)->first();
        if ($image === null) {
            throw ApiException::notFound('GALLERY_IMAGE_NOT_FOUND', "تصویر با شناسهٔ {$id} یافت نشد.");
        }

        return $image;
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function addImage(array $input): GalleryImage
    {
        $album = $this->getAlbum(trim((string) ($input['albumId'] ?? '')));

        $image = new GalleryImage;
        $image->id = 'gi_'.strtolower((string) Str::ulid());
        $image->organization_id = $this->tenant->organizationId();
        $image->album_id = $album->id;
        $image->media_id = trim((string) ($input['mediaId'] ?? ''));
        $image->caption = trim((string) ($input['caption'] ?? ''));
        $image->alt = trim((string) ($input['alt'] ?? ''));
        $image->sort_order = (int) ($input['sortOrder'] ?? $this->imageCount($album->id));

        $image->save();

        return $image->refresh();
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function updateImage(GalleryImage $image, array $input): GalleryImage
    {
        if (array_key_exists('caption', $input)) {
            $image->caption = trim((string) $input['caption']);
        }
        if (array_key_exists('alt', $input)) {
            $image->alt = trim((string) $input['alt']);
        }

        $image->save();

        return $image->refresh();
    }

    public function removeImage(GalleryImage $image): void
    {
        $albumId = $image->album_id;
        $mediaId = $image->media_id;

        DB::transaction(function () use ($image, $albumId): void {
            $image->delete();
            $this->renumberAlbum($albumId);
        });

        $this->releaseIfOrphaned($mediaId);
    }

    public function reorderImage(GalleryImage $image, int $newOrder): GalleryImage
    {
        $siblings = GalleryImage::query()->where('album_id', $image->album_id)
            ->orderBy('sort_order')->orderBy('created_at')->orderBy('id')->get();

        if ($newOrder < 0 || $newOrder >= $siblings->count()) {
            throw ApiException::validation('GALLERY_IMAGE_INVALID', 'جایگاه تصویر معتبر نیست.', [
                'sortOrder' => ['خارج از محدوده است'],
            ]);
        }

        DB::transaction(function () use ($image, $siblings, $newOrder): void {
            $without = $siblings->reject(fn (GalleryImage $row) => $row->id === $image->id)->values();
            $ordered = $without->slice(0, $newOrder)->concat([$image])->concat($without->slice($newOrder))->values();
            foreach ($ordered as $index => $row) {
                if ($row->sort_order !== $index) {
                    $row->sort_order = $index;
                    $row->save();
                }
            }
        });

        return $this->getImage($image->id);
    }

    /* ------------------------------------------------------------ wiring */

    /** @return array<string, mixed> */
    public static function albumToWire(GalleryAlbum $album): array
    {
        $wire = [
            'id' => $album->id,
            'title' => $album->title,
            'description' => $album->description,
            'createdAt' => $album->created_at?->toJSON(),
            'sortOrder' => $album->sort_order,
        ];
        if ($album->cover_media_id !== null && $album->cover_media_id !== '') {
            $wire['coverMediaId'] = $album->cover_media_id;
        }

        return $wire;
    }

    /** @return array<string, mixed> */
    public static function imageToWire(GalleryImage $image): array
    {
        return [
            'id' => $image->id,
            'albumId' => $image->album_id,
            'mediaId' => $image->media_id,
            'caption' => $image->caption,
            'alt' => $image->alt,
            'sortOrder' => $image->sort_order,
            'createdAt' => $image->created_at?->toJSON(),
        ];
    }

    /* ------------------------------------------------------------ private */

    private function nextAlbumOrder(): int
    {
        return (int) GalleryAlbum::query()->max('sort_order') + 1;
    }

    private function imageCount(string $albumId): int
    {
        return GalleryImage::query()->where('album_id', $albumId)->count();
    }

    private function renumberAlbum(string $albumId): void
    {
        $rows = GalleryImage::query()->where('album_id', $albumId)
            ->orderBy('sort_order')->orderBy('created_at')->orderBy('id')->get();
        foreach ($rows->values() as $index => $row) {
            if ($row->sort_order !== $index) {
                $row->sort_order = $index;
                $row->save();
            }
        }
    }

    private function normalizedMediaId(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $id = trim((string) $value);

        return $id === '' ? null : $id;
    }

    /**
     * Frees a media asset the gallery no longer reaches — metadata and bytes
     * together, through `MediaService` — and keeps it while ANY record still
     * references it. A reference that appeared between the check and the
     * delete surfaces as a 409, which is the same "keep it" answer.
     */
    private function releaseIfOrphaned(?string $mediaId): void
    {
        if ($mediaId === null || trim($mediaId) === '') {
            return;
        }
        $id = trim($mediaId);
        if ($this->references->isStillReferenced($id)) {
            return;
        }
        $asset = MediaAsset::query()->whereKey($id)->first();
        if ($asset === null) {
            return;
        }
        try {
            $this->media->delete($asset);
        } catch (ApiException $e) {
            if ($e->errorCode !== 'MEDIA_IN_USE') {
                throw $e;
            }
        }
    }
}
