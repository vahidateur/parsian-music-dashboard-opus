<?php

namespace Database\Factories;

use App\Models\Instrument;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Instrument>
 */
class InstrumentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'ins_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'slug' => 'ins_'.strtolower((string) Str::ulid()),
            'name' => fake()->word(),
            'description' => '',
            'image_id' => null,
            'active' => true,
            'sort_order' => 1,
        ];
    }
}
