<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Teacher>
 */
class TeacherFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 't_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'name' => fake()->name(),
            'photo_media_id' => null,
            'instrument' => 'piano',
            'title' => 'مدرس پیانو',
            'students' => 0,
            'utilization' => 50,
            'weekly_hours' => 10,
            'contract_hours' => 20,
            'attendance_rate' => 90,
            'retention' => 80,
            'today_classes' => [],
            'availability' => [],
            'since' => '۱۴۰۰',
            'phone' => '0912'.fake()->unique()->numerify('#######'),
            'status' => 'active',
            'bio' => '',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['status' => 'inactive']);
    }
}
