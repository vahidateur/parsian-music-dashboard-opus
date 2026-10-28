<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A student working on a piece (TS `PieceAssignment`).
     *
     * Two invariants are enforced in the service, not by the schema, because
     * neither is expressible as a portable constraint:
     *
     *   - ONE OPEN assignment per (student, piece). A closed assignment does
     *     not block a new one, because a finished piece may be re-assigned
     *     later. A plain unique index would be wrong here.
     *   - `closed_at` is stamped when the status moves to completed/abandoned
     *     and cleared when it moves back, so the field can never lie.
     */
    public function up(): void
    {
        Schema::create('piece_assignments', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('student_id')->index();
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();

            $table->string('piece_id')->index();
            $table->foreign('piece_id')->references('id')->on('pieces')->cascadeOnDelete();

            // Who assigned it. Provenance for accountability — never an
            // authorization input.
            $table->string('teacher_id')->nullable()->index();
            $table->foreign('teacher_id')->references('id')->on('teachers')->nullOnDelete();

            // planned | learning | polishing | completed | paused | abandoned
            $table->string('status');
            $table->timestamp('assigned_at');
            $table->timestamp('target_date')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->text('notes');

            // Denormalized snapshot of the newest progress event. Null until the
            // append-only event log lands — progress-events are a later slice,
            // and this is always rebuildable from that log.
            $table->json('latest')->nullable();

            $table->timestamps();

            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'piece_id']);
            $table->index(['organization_id', 'teacher_id']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('piece_assignments');
    }
};
