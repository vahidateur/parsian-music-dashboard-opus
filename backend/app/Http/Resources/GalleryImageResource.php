<?php

namespace App\Http\Resources;

use App\Domain\Gallery\GalleryService;
use App\Models\GalleryImage;

/** Wire shape = TS `GalleryImage` (camelCase). */
final class GalleryImageResource
{
    /** @return array<string, mixed> */
    public static function toWire(GalleryImage $image): array
    {
        return GalleryService::imageToWire($image);
    }
}
