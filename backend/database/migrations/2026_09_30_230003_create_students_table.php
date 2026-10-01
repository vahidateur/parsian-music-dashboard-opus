<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Students of an organization. `teacher_id` is a display/assignment field
     * only and is NEVER an authorization source (T-02 uses enrollments).
     * `deferred` holds the wire fields owned by domains not built yet.
     */
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('national_id');
            $table->string('name');
            $table->string('instrument');
            $table->string('teacher_id')->nullable()->index();
            $table->string('level');
            $table->unsignedTinyInteger('level_step');
            $table->string('status');
            $table->string('payment');
            $table->integer('age');
            $table->string('phone');
            $table->string('guardian')->nullable();
            $table->string('since');
            $table->json('deferred');
            $table->timestamps();
            $table->unique(['organization_id', 'national_id']);
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'teacher_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
