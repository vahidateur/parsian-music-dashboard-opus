<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One real, dated occurrence of a class — the entity the TS `Session` type
 * describes (`src/domains/scheduling/types.ts`).
 *
 * A session is MATERIALIZED, not derived, because it carries per-occurrence
 * state a computed value cannot hold: cancellation with a reason, a substitute
 * teacher, a one-off room change, and the attendance records that hang off it.
 *
 * `date` is a Gregorian ISO date (YYYY-MM-DD) and `start_time` / `end_time` are
 * 24-hour HH:mm, because sessions are range-queried, sorted and bucketed — a
 * Jalali display string cannot do any of that correctly. Jalali stays a UI
 * concern.
 *
 * No `students` column: the roster is derived from active enrollments at the
 * session's date, so a student who joins in week 6 never appears on week 2.
 *
 * The table is `class_sessions`, not `sessions`: the framework's own session
 * store already owns `sessions` (created by the base
 * `0001_01_01_000000_create_users_table` migration, which carries the
 * `session:table` stub). Same reason `AcademyClass` lives on `classes` — the
 * domain name collides with something the framework or the SQL dialect
 * reserves, so the table is named for the model.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('class_id');
            $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
            $table->string('date');                       // YYYY-MM-DD
            $table->string('start_time');                 // HH:mm, inclusive
            $table->string('end_time');                   // HH:mm, exclusive
            $table->string('teacher_id');                 // per-occurrence snapshot
            $table->string('room_id');                    // per-occurrence snapshot
            $table->string('status')->default('scheduled');
            $table->string('origin')->default('generated');
            $table->string('cancel_reason')->nullable();
            $table->string('rescheduled_from_id')->nullable();
            $table->string('rescheduled_to_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'date']);
            $table->index(['organization_id', 'class_id', 'date']);
            $table->index(['organization_id', 'teacher_id', 'date']);
            $table->index(['organization_id', 'room_id', 'date']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_sessions');
    }
};
