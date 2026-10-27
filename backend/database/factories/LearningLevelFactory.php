<?php

namespace Database\Factories;

use App\Models\LearningLevel;
use App\Models\LearningProgram;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LearningLevel>
 */
class LearningLevelFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'lv_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'program_id' => LearningProgram::factory(),
            'order' => 1,
            'name' => 'سطح ۱',
            'description' => '',
            'objectives' => [],
            'notes' => null,
            'active' => true,
            'exclusive' => false,
            'prerequisite_level_ids' => [],
        ];
    }
}
