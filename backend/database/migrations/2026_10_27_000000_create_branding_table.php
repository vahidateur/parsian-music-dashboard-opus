<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Academy identity, one row per organization.
     *
     * The table's primary key IS the organization: an academy has exactly
     * one identity record, keyed by `organization_id` with a cascade delete.
     * There is no surrogate id and no list endpoint — like `organization`,
     * "removing" the branding means writing the defaults back, which the
     * update path already does.
     */
    public function up(): void
    {
        Schema::create('branding', function (Blueprint $table) {
            $table->string('organization_id')->primary();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('academy_name', 80);
            $table->string('tagline', 200)->default('');
            $table->string('logo_media_id', 64)->nullable();
            $table->string('favicon_media_id', 64)->nullable();
            $table->string('primary_color', 7);
            $table->string('accent_color', 7);
            $table->string('text_color', 7);
            $table->string('persian_font', 32);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branding');
    }
};
