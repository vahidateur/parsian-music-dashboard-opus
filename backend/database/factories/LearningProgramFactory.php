<?php

namespace Database\Factories;

use App\Models\LearningProgram;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LearningProgram>
 */
class LearningProgramFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'pg_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'instrument_id' => 'piano',
            'name' => fake()->words(3, true),
            'description' => '',
            'active' => true,
        ];
    }
}
