<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Media assets — the metadata of every stored binary.
     *
     * THE BYTES ARE NOT HERE. `storage_path` points at the private disk
     * (`storage/app/private`), and the only way to read them is the
     * authenticated `GET /media/{id}/bytes` endpoint, which authorizes the
     * READER against the record that references the asset. A file in a
     * database blob column cannot be authorized per object, and a public
     * symlink would hand a teacher's roster to anyone who guesses a path.
     *
     * `uploaded_by` is provenance AND the last line of defense for an asset
     * nobody references yet: a freshly uploaded, not-yet-attached file can
     * still be read and freed by the session that created it.
     */
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('kind');            // image | audio | document
            $table->string('filename');        // sanitized display name, never a path
            $table->string('mime_type');       // from the allow-list, never the client's claim
            $table->unsignedBigInteger('size_bytes');

            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->json('peaks')->nullable();

            // The path ON the private disk. Never exposed on the wire.
            $table->string('storage_path');

            // Who uploaded it. Not an authorization field for referenced assets
            // (the referencing record decides that), but the only reader of an
            // asset that nothing references yet.
            $table->string('uploaded_by')->nullable()->index();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['organization_id', 'kind']);
            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
