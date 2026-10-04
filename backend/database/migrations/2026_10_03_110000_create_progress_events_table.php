<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The append-only progress log (TS `ProgressEvent`).
     *
     * APPEND-ONLY is a routing guarantee first: no PUT, PATCH or DELETE route
     * exists for an event, so correcting a mistake appends a new event rather
     * than rewriting the past — which is exactly what the client contract
     * states and why a chart can never silently change shape.
     *
     * `student_id` and `piece_id` are carried on the row because the contract
     * defines them on the event, but they are never accepted from the client:
     * the service copies them from the assignment the event belongs to.
     *
     * ORDERING is by `recorded_at`, tie-broken by `id` — the contract's
     * `sortByTime()`. No sequence column is introduced, because the contract
     * does not define one and a back-dated entry must be able to land before
     * an earlier-created one.
     */
    public function up(): void
    {
        Schema::create('progress_events', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('assignment_id')->index();
            $table->foreign('assignment_id')->references('id')->on('piece_assignments')->cascadeOnDelete();

            // Denormalized from the assignment. The contract defines them on
            // the event so analytics never has to join to find the subject.
            $table->string('student_id')->index();
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();

            $table->string('piece_id')->index();
            $table->foreign('piece_id')->references('id')->on('pieces')->cascadeOnDelete();

            // Back-datable: the moment of the observation, not of the insert.
            $table->timestamp('recorded_at');

            $table->unsignedInteger('range_start')->nullable();
            $table->unsignedInteger('range_end')->nullable();
            $table->string('range_label')->nullable();
            $table->unsignedInteger('tempo_bpm')->nullable();
            $table->unsignedInteger('target_tempo_bpm')->nullable();
            // 0–100, the one always-required measurement.
            $table->unsignedInteger('mastery');
            $table->unsignedInteger('practice_minutes')->nullable();
            $table->text('teacher_note')->nullable();
            $table->text('student_note')->nullable();
            // teacher | student | system — provenance, never authorization.
            $table->string('source');
            $table->string('session_id')->nullable();

            $table->timestamps();

            // The query patterns the contract actually uses: per student over
            // time, and per assignment over time.
            $table->index(['organization_id', 'student_id', 'recorded_at']);
            $table->index(['organization_id', 'assignment_id', 'recorded_at']);
            $table->index(['organization_id', 'piece_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_events');
    }
};
