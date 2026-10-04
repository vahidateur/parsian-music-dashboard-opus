<?php

namespace Database\Factories;

use App\Models\AcademyClass;
use App\Models\ClassSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ClassSession> */
class ClassSessionFactory extends Factory
{
    protected $model = ClassSession::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $startHour = $this->faker->numberBetween(8, 18);
        $start = sprintf('%02d:00', $startHour);
        $end = sprintf('%02d:%02d', $startHour + 1, 30);

        return [
            'id' => 'ses_'.strtolower((string) $this->faker->unique()->regexify('[a-z0-9]{10}')),
            'class_id' => AcademyClass::factory(),
            'date' => now()->addDays($this->faker->numberBetween(1, 30))->toDateString(),
            'start_time' => $start,
            'end_time' => $end,
            'teacher_id' => 't1',
            'room_id' => 'r1',
            'status' => 'scheduled',
            'origin' => 'generated',
        ];
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => 'cancelled', 'cancel_reason' => 'لغو آزمایشی']);
    }

    public function manual(): static
    {
        return $this->state(fn () => ['origin' => 'manual']);
    }
}
