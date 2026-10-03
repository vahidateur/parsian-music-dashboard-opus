<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Pass organization_id, student_id and piece_id explicitly.
 *
 * They are NOT defaulted to factories on purpose: `Student::factory()` and
 * `Piece::factory()` would each create their OWN organization, and the
 * resulting assignment would then sit in a third. That is not a fixture, it is
 * a cross-tenant row that the tenant scope would correctly hide.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PieceAssignment>
 */
class PieceAssignmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'as_'.strtolower((string) Str::ulid()),
            'teacher_id' => null,
            'status' => 'planned',
            'assigned_at' => now(),
            'target_date' => null,
            'closed_at' => null,
            'notes' => '',
            'latest' => null,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => [
            'status' => 'completed',
            'closed_at' => now(),
        ]);
    }

    public function learning(): static
    {
        return $this->state(fn () => ['status' => 'learning']);
    }
}
