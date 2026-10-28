<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Teachers of an organization; phone is unique per organization. */
    public function up(): void
    {
        Schema::create('teachers', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('name');
            $table->string('photo_media_id')->nullable();
            $table->string('instrument');
            $table->string('title');
            $table->integer('students')->default(0);
            $table->integer('utilization')->default(0);
            $table->integer('weekly_hours')->default(0);
            $table->integer('contract_hours')->default(0);
            $table->integer('attendance_rate')->default(0);
            $table->integer('retention')->default(0);
            $table->json('today_classes');
            $table->json('availability');
            $table->string('since');
            $table->string('phone');
            $table->string('status');
            $table->text('bio');
            $table->timestamps();
            $table->unique(['organization_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teachers');
    }
};
