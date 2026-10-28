<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Classes of an organization. `enrolled`, `waitlist` and `studentIds` of
     * the wire shape are computed from enrollments, never stored.
     */
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('title');
            $table->string('instrument');
            $table->string('teacher_id');
            $table->foreign('teacher_id')->references('id')->on('teachers');
            $table->string('room_id');
            $table->foreign('room_id')->references('id')->on('rooms');
            $table->string('kind');
            $table->string('level');
            $table->string('program_id')->nullable();
            $table->string('level_id')->nullable();
            $table->json('days');
            $table->string('time');
            $table->integer('duration');
            $table->integer('capacity');
            $table->integer('attendance_avg')->default(0);
            $table->bigInteger('tuition');
            $table->integer('term_progress')->default(0);
            $table->string('status')->default('active');
            $table->timestamps();
            $table->index(['organization_id', 'teacher_id']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
