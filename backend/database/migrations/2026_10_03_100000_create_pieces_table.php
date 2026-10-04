<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A musical work in the academy's repertoire (TS `Piece`).
     *
     * A piece is deliberately NOT a LearningContent and not a media asset:
     * progress is tracked against the work, never against the PDF that carries
     * it. `content_ids` therefore holds opaque references to supporting
     * resources, with no foreign key — the learning domain has no server
     * presence (PB-3 remains Option A for it).
     */
    public function up(): void
    {
        Schema::create('pieces', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('title');
            $table->string('composer')->default('');
            // InstrumentId is an open string in the client contract whose
            // validity comes from the academy's instrument list; no instruments
            // table exists on the server (PB-3), so this is not a foreign key.
            $table->string('instrument_id');
            // Advisory anchors. No programs or levels table exists (learning
            // domain, PB-3), so these are references by value, never enforced.
            $table->string('program_id')->nullable();
            $table->string('recommended_level_id')->nullable();

            $table->text('description');
            // measure | section | page | timestamp | freeform
            $table->string('range_unit');
            // Total extent in `range_unit`; null means "no denominator", so a
            // completion percentage is not derivable and must not be invented.
            $table->unsignedInteger('total_range')->nullable();
            $table->json('content_ids')->nullable();
            $table->boolean('active')->default(true);

            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->index(['organization_id', 'instrument_id']);
            $table->index(['organization_id', 'active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pieces');
    }
};
