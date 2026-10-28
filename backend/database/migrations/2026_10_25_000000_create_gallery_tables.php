<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Academy showcase: albums and their images, per organization.
     *
     * Keys follow the composite pattern (`roles`, `instruments`, learning):
     * the primary key is `(organization_id, id)` so two organizations never
     * collide, and the tenant global scope keeps every query inside the
     * caller's organization.
     *
     * No cascading foreign keys between these tables on purpose: deleting an
     * album removes its images (the service deletes the rows), and deleting
     * an image or an album releases a media asset only when no record still
     * references it. A cascading FK would silently do what the service must
     * decide — the service enforces every invariant instead.
     *
     * `sort_order` is 0-based and contiguous within an album for images
     * (like the demo repository), and a display sequence for albums.
     */
    public function up(): void
    {
        Schema::create('gallery_albums', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('title', 120);
            $table->text('description');
            $table->string('cover_media_id', 64)->nullable();
            $table->integer('sort_order')->default(0);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'sort_order']);
        });

        Schema::create('gallery_images', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('album_id', 64);
            $table->string('media_id', 64);
            $table->string('caption', 255);
            $table->string('alt', 500);
            $table->integer('sort_order')->default(0);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'album_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gallery_images');
        Schema::dropIfExists('gallery_albums');
    }
};
