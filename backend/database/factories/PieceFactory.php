<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Piece>
 */
class PieceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'pc_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'title' => 'Piece '.fake()->unique()->numerify('####'),
            'composer' => '',
            'instrument_id' => 'piano',
            'program_id' => null,
            'recommended_level_id' => null,
            'description' => '',
            'range_unit' => 'measure',
            'total_range' => null,
            'content_ids' => null,
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['active' => false]);
    }
}
