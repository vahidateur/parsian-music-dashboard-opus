<?php

namespace Database\Factories;

use App\Models\AcademyClass;
use App\Models\Organization;
use App\Models\Room;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Pass organization_id, teacher_id and room_id explicitly for rows that must
 * share one organization.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AcademyClass>
 */
class AcademyClassFactory extends Factory
{
    protected $model = AcademyClass::class;

    public function definition(): array
    {
        return [
            'id' => 'cl_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'title' => 'کلاس پیانو',
            'instrument' => 'piano',
            'teacher_id' => fn (array $attributes) => Teacher::factory()->create(['organization_id' => $attributes['organization_id']])->id,
            'room_id' => fn (array $attributes) => Room::factory()->create(['organization_id' => $attributes['organization_id']])->id,
            'kind' => 'group',
            'level' => 'سطح ۱',
            'program_id' => null,
            'level_id' => null,
            'days' => [1, 3],
            'time' => '17:00',
            'duration' => 60,
            'capacity' => 6,
            'attendance_avg' => 0,
            'tuition' => 1000000,
            'term_progress' => 0,
            'status' => 'active',
        ];
    }
}
