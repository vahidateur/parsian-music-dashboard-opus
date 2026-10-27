<?php

namespace Database\Factories;

use App\Models\GalleryAlbum;
use App\Models\GalleryImage;
use App\Models\MediaAsset;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GalleryImage>
 */
class GalleryImageFactory extends Factory
{
    protected $model = GalleryImage::class;

    public function definition(): array
    {
        return [
            'id' => 'gi_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'album_id' => GalleryAlbum::factory(),
            'media_id' => MediaAsset::factory(),
            'caption' => 'تصویر '.fake()->numerify('####'),
            'alt' => 'متن جایگزین '.fake()->numerify('####'),
            'sort_order' => 0,
        ];
    }
}
