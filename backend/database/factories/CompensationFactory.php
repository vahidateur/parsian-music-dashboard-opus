<?php

namespace Database\Factories;

use App\Models\Compensation;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Compensation>
 */
class CompensationFactory extends Factory
{
    protected $model = Compensation::class;

    public function definition(): array
    {
        return [
            'id' => 'cp_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'original_session_id' => 'se_'.strtolower((string) Str::ulid()),
            'class_id' => 'cl_'.strtolower((string) Str::ulid()),
            'student_id' => 'st_'.strtolower((string) Str::ulid()),
            'reason' => 'جلسهٔ جبرانی',
            'required_at' => now(),
            'required_by_user_id' => 'u_admin',
            'attempts' => [],
            'original_attendance_acknowledged_at' => null,
            'completed_at' => null,
            'completed_by_user_id' => null,
        ];
    }
}
