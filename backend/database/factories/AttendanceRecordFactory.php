<?php

namespace Database\Factories;

use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceRecord>
 *
 * Seeded from FACTORIES, not fixtures: `attendanceRecords.json` and
 * `attendanceCorrections.json` in the dataset are both empty arrays.
 */
class AttendanceRecordFactory extends Factory
{
    protected $model = AttendanceRecord::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'id' => 'att_'.strtolower((string) $this->faker->unique()->regexify('[a-z0-9]{10}')),
            'session_id' => ClassSession::factory(),
            'student_id' => Student::factory(),
            'status' => $this->faker->randomElement(AttendanceRecord::STATUSES),
            'notes' => null,
            'recorded_by_user_id' => 'u1',
        ];
    }
}
