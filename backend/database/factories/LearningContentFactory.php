<?php

namespace Database\Factories;

use App\Models\LearningContent;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LearningContent>
 */
class LearningContentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'lc_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'title' => fake()->words(3, true),
            'description' => '',
            'type' => 'document',
            'media_id' => null,
            'author' => null,
            'teacher_id' => null,
            'instrument_id' => null,
            'visibility' => 'students',
            'active' => true,
        ];
    }
}
