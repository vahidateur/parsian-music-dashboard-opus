<?php

namespace Database\Factories;

use App\Models\GalleryAlbum;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GalleryAlbum>
 */
class GalleryAlbumFactory extends Factory
{
    protected $model = GalleryAlbum::class;

    public function definition(): array
    {
        return [
            'id' => 'gl_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'title' => 'آلبوم '.fake()->unique()->numerify('####'),
            'description' => '',
            'cover_media_id' => null,
            'sort_order' => 0,
        ];
    }
}
