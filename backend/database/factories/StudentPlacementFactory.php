<?php

namespace Database\Factories;

use App\Models\LearningLevel;
use App\Models\LearningProgram;
use App\Models\Organization;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\StudentPlacement>
 */
class StudentPlacementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'plc_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'student_id' => Student::factory(),
            'program_id' => LearningProgram::factory(),
            'level_id' => LearningLevel::factory(),
            'assigned_at' => now(),
            'history' => [],
        ];
    }
}
