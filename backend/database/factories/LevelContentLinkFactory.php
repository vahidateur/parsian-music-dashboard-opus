<?php

namespace Database\Factories;

use App\Models\LevelContentLink;
use App\Models\LearningContent;
use App\Models\LearningLevel;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LevelContentLink>
 */
class LevelContentLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'lnk_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'level_id' => LearningLevel::factory(),
            'content_id' => LearningContent::factory(),
            'sort_order' => 0,
        ];
    }
}
