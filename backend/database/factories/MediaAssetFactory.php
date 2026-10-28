<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Factories\Factory<\App\Models\MediaAsset>
 */
class MediaAssetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'md_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'kind' => 'image',
            'filename' => 'photo.png',
            'mime_type' => 'image/png',
            'size_bytes' => 68,
            'width' => 1,
            'height' => 1,
            'duration_seconds' => null,
            'peaks' => null,
            'storage_path' => 'media/factory/asset',
            'uploaded_by' => null,
        ];
    }
}
