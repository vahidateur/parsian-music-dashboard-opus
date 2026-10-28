<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Pass organization_id, student_id and class_id explicitly.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Enrollment>
 */
class EnrollmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'enr_'.strtolower((string) Str::ulid()),
            'status' => 'active',
            'start_date' => '2026-09-01',
            'end_date' => null,
            'pricing_label' => 'سطح ۱',
            'pricing_amount' => 1000000,
        ];
    }
}
