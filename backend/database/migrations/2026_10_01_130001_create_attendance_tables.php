<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Attendance: the records themselves, and the append-only correction log.
 *
 * `attendance_records` models "who was where, and what the outcome was, for one
 * student at one session" — the TS `AttendanceRecord`.
 *
 * `attendance_corrections` exists because the fixture allowed silent overwrites:
 * an attendance mark could be changed with no record of the previous value or
 * who changed it. Here a correction is ALWAYS an insert, and the service
 * exposes no update or delete path at all. `previous_status` and
 * `new_status` are stored on the log rather than reconstructed, so the history
 * survives even if the parent record is later replaced.
 *
 * How long a student was late is stored as the `late` STATUS, not a numeric
 * minutes field: `attendance.json` records lateness as a mark, not a duration,
 * so a minutes column would hold invented precision.
 *
 * UNIQUE(session_id, student_id) is a real DB constraint, not a service-level
 * check — the invariant cannot be violated by a concurrent request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('session_id');
            $table->foreign('session_id')->references('id')->on('class_sessions')->cascadeOnDelete();
            $table->string('student_id');
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->string('status');                     // present|absent|late|excused
            $table->text('notes')->nullable();
            // No FOREIGN KEY on the actor column: an audit trail that
            // disappears when a user is deleted is not an audit trail. The id
            // is still resolvable while the user exists, and it is always the
            // authenticated user's id — never a client-supplied value.
            $table->string('recorded_by_user_id');
            $table->timestamps();

            // One record per student per session — enforced by the database.
            $table->unique(['session_id', 'student_id']);
            $table->index(['organization_id', 'session_id']);
            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'status']);
        });

        Schema::create('attendance_corrections', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('record_id');                  // kept even if the record is deleted
            $table->string('session_id');
            $table->string('student_id');
            $table->string('previous_status');
            $table->string('new_status');
            $table->text('reason');
            $table->string('changed_by_user_id');         // Traceable to a user for auditing (no FK — see above).
            $table->timestamps();

            $table->index(['organization_id', 'session_id']);
            $table->index(['organization_id', 'record_id']);
            $table->index(['organization_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_corrections');
        Schema::dropIfExists('attendance_records');
    }
};
