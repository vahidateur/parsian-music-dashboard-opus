<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Room>
 */
class RoomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'r_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'name' => 'Room '.fake()->unique()->numerify('####'),
            'kind' => 'piano',
            'capacity' => 6,
            'occupancy' => 0,
            'active' => true,
        ];
    }
}
