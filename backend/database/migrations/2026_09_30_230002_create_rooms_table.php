<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Rooms of an organization; name is unique per organization. */
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('name');
            $table->string('kind');
            $table->integer('capacity');
            $table->integer('occupancy')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
