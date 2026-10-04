<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Library resources of an organization — the catalogue metadata only.
     *
     * The file bytes behind a row are NOT stored here: `media_id` is an opaque
     * reference into the media domain, and upload/download are separate
     * endpoints that are outside this slice. `size` and `duration` are derived
     * display labels, so they are not columns.
     */
    public function up(): void
    {
        Schema::create('resources', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            // Provenance: who contributed the resource. Not an authorization field.
            $table->string('teacher_id')->nullable()->index();
            $table->foreign('teacher_id')->references('id')->on('teachers')->nullOnDelete();

            $table->string('title');
            $table->string('composer')->default('');
            $table->string('kind');                 // sheet | audio | video | doc
            $table->string('instrument');           // InstrumentId — free string, see limitation 8
            $table->string('level')->default('');   // descriptive vocabulary, not an FK
            $table->string('media_id')->nullable(); // opaque media reference, no FK by design

            $table->unsignedInteger('pages')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->json('peaks')->nullable();
            $table->unsignedInteger('uses')->default(0);

            $table->string('visibility')->default('students'); // students | teachers
            $table->json('restricted_student_ids')->nullable();
            $table->boolean('active')->default(true);

            $table->timestamps();

            $table->index(['organization_id', 'kind']);
            $table->index(['organization_id', 'instrument']);
            $table->index(['organization_id', 'visibility']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resources');
    }
};
