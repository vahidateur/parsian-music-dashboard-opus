<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Learning curriculum of an organization: programs per instrument, ordered
     * levels per program, teaching material linked to levels, and one active
     * student placement (per student, per the repository contract).
     *
     * Keys follow the composite pattern (`roles`, `instruments`): the primary
     * key is `(organization_id, id)` so two organizations never collide, and
     * the tenant global scope keeps every query inside the caller's
     * organization.
     *
     * No cascading foreign keys between these tables on purpose: deletion is
     * REFUSED while references exist (a program with levels, a level with
     * linked content or placed students), and a cascading FK would silently
     * do what the service must refuse. The service enforces every invariant
     * inside transactions instead.
     */
    public function up(): void
    {
        Schema::create('learning_programs', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            // Free string, validated against `instruments` in the service: an
            // academy names the instrument a curriculum is for, and the row
            // must keep resolving even if instruments are renamed.
            $table->string('instrument_id', 64);
            $table->string('name', 120);
            $table->text('description');
            $table->boolean('active')->default(true);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'instrument_id']);
        });

        Schema::create('learning_levels', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('program_id', 64);
            // 1-based, contiguous and unique within the program. The ladder is
            // renumbered transactionally on insert, move and delete.
            $table->unsignedInteger('order');
            $table->string('name', 120);
            $table->text('description');
            $table->json('objectives');
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->boolean('exclusive')->default(false);
            $table->json('prerequisite_level_ids');

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->unique(['organization_id', 'program_id', 'order']);
            $table->index(['organization_id', 'program_id']);
        });

        Schema::create('learning_contents', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('title', 200);
            $table->text('description');
            // pdf | image | audio | voice | video | document
            $table->string('type', 16);
            // Opaque media reference, no FK by design (same boundary as
            // `resources.media_id`): the bytes live in the media domain.
            $table->string('media_id', 64)->nullable();
            $table->string('author', 120)->nullable();
            $table->string('teacher_id', 64)->nullable();
            // Optional: theory and ear training are instrument-agnostic.
            $table->string('instrument_id', 64)->nullable();
            // students | teachers
            $table->string('visibility', 16)->default('students');
            $table->boolean('active')->default(true);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'type']);
        });

        Schema::create('level_content_links', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('level_id', 64);
            $table->string('content_id', 64);
            // 0-based ordering of content within the level.
            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->unique(['organization_id', 'level_id', 'content_id']);
            $table->index(['organization_id', 'level_id']);
        });

        Schema::create('student_placements', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('student_id', 64);
            $table->string('program_id', 64);
            $table->string('level_id', 64);
            $table->timestamp('assigned_at')->nullable();
            // Append-only journey: each entry records both ends of a move.
            $table->json('history');

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            // One active placement per student (the repository contract:
            // re-placing moves the single row and appends history).
            $table->unique(['organization_id', 'student_id']);
            $table->index(['organization_id', 'program_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_placements');
        Schema::dropIfExists('level_content_links');
        Schema::dropIfExists('learning_contents');
        Schema::dropIfExists('learning_levels');
        Schema::dropIfExists('learning_programs');
    }
};
