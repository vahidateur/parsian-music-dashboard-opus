<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Private-lesson make-up obligations, per organization.
     *
     * One row per (original session, frozen student) pair, for the pair's
     * lifetime — enforced by the unique key, never by convention. The ledger
     * (`attempts`) is a JSON column: append-only lines naming the booked
     * sessions; status is derived on read, never stored (a stored status
     * would be a second source of truth `cancelSession` would have to
     * maintain, which this slice must not touch).
     *
     * Keys follow the composite pattern (`roles`, `instruments`, chat):
     * the primary key is `(organization_id, id)` so two organizations never
     * collide, and the tenant global scope keeps every query inside the
     * caller's organization. No cascading FKs to sessions/students/classes:
     * an obligation must survive its own fulfilment being cancelled or
     * deleted, and a cascade would silently do what the service must refuse
     * or report.
     */
    public function up(): void
    {
        Schema::create('compensations', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('original_session_id', 64);
            $table->string('class_id', 64);
            $table->string('student_id', 64);
            $table->text('reason');
            $table->timestamp('required_at');
            $table->string('required_by_user_id', 64);
            $table->json('attempts');
            $table->timestamp('original_attendance_acknowledged_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('completed_by_user_id', 64)->nullable();

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->unique(['organization_id', 'original_session_id', 'student_id'], 'compensations_pair_unique');
            $table->index(['organization_id', 'class_id']);
            $table->index(['organization_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compensations');
    }
};
