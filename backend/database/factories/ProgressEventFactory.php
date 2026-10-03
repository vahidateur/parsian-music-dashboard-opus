<?php

namespace Database\Factories;

use App\Models\PieceAssignment;
use App\Models\ProgressEvent;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ProgressEvent> */
class ProgressEventFactory extends Factory
{
    protected $model = ProgressEvent::class;

    public function definition(): array
    {
        return [
            'id' => 'pe_'.$this->faker->unique()->numerify('############'),
            'recorded_at' => $this->faker->dateTimeBetween('-8 weeks', 'now'),
            'range_start' => 1,
            'range_end' => 8,
            'range_label' => null,
            'tempo_bpm' => 72,
            'target_tempo_bpm' => 92,
            'mastery' => $this->faker->numberBetween(40, 80),
            'practice_minutes' => $this->faker->numberBetween(15, 45),
            'teacher_note' => null,
            'student_note' => null,
            'source' => ProgressEvent::SOURCE_TEACHER,
            'session_id' => null,
        ];
    }

    /**
     * Bind the event to a real assignment in the SAME organization.
     *
     * `student_id` and `piece_id` are copied from the assignment — never
     * supplied by the caller — which is the server-authoritative rule the
     * service enforces at write time too.
     */
    public function forAssignment(PieceAssignment $assignment): static
    {
        return $this->state(fn (): array => [
            'organization_id' => $assignment->organization_id,
            'assignment_id' => $assignment->id,
            'student_id' => $assignment->student_id,
            'piece_id' => $assignment->piece_id,
        ]);
    }

    /** Convenience for tenancy tests: resolve an assignment for a student. */
    public function forStudent(Student $student): static
    {
        $assignment = PieceAssignment::query()
            ->where('organization_id', $student->organization_id)
            ->where('student_id', $student->id)
            ->firstOrFail();

        return $this->forAssignment($assignment);
    }
}
