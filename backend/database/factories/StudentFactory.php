<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Support\NationalId;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Student>
 */
class StudentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'st_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'national_id' => NationalId::withCheckDigit('1'.fake()->unique()->numerify('########')),
            'name' => fake()->name(),
            'instrument' => 'piano',
            'teacher_id' => null,
            'level' => 'سطح ۱',
            'level_step' => 1,
            'status' => 'active',
            'payment' => 'paid',
            'age' => 15,
            'phone' => '0912'.fake()->numerify('#######'),
            'guardian' => null,
            'since' => 'مهر ۱۴۰۳',
            'deferred' => [],
        ];
    }
}
