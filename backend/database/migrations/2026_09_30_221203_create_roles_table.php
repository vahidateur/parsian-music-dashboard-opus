<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per edited role per organization. A missing row (or a null
     * `permissions` column) means the shipped default in config/permissions.php.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('id');
            $table->string('label');
            $table->string('scope');
            $table->json('permissions')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->primary(['organization_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
