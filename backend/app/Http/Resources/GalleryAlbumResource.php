<?php

namespace App\Http\Resources;

use App\Domain\Gallery\GalleryService;
use App\Models\GalleryAlbum;

/** Wire shape = TS `GalleryAlbum` (camelCase). */
final class GalleryAlbumResource
{
    /** @return array<string, mixed> */
    public static function toWire(GalleryAlbum $album): array
    {
        return GalleryService::albumToWire($album);
    }
}
