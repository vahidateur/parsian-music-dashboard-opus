<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Instruments of an organization.
     *
     * `id` equals `slug` within an organization (preserving the historical ids
     * `piano`, `violin`, … that existing student, teacher, class, resource and
     * piece rows store). The primary key is `(organization_id, id)` — the same
     * composite-key pattern `roles` uses — so two organizations may both define
     * `piano` or `santoor` without colliding.
     */
    public function up(): void
    {
        Schema::create('instruments', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('slug', 64);
            $table->string('name', 120);
            $table->text('description');
            $table->string('image_id', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->integer('sort_order')->default(0);

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->unique(['organization_id', 'slug']);
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'sort_order']);
        });

        // Non-destructive backfill when `org_demo` already exists (e.g. a live
        // local database migrated forward without re-seeding). On a fresh
        // test database `organizations` is empty here and DemoDatasetSeeder
        // seeds the same rows when called.
        if (
            Schema::hasTable('organizations')
            && DB::table('organizations')->where('id', 'org_demo')->exists()
            && ! DB::table('instruments')->where('organization_id', 'org_demo')->exists()
        ) {
            $now = now();
            $defaults = [
                ['id' => 'piano', 'slug' => 'piano', 'name' => 'پیانو', 'description' => 'ساز کلیدی؛ پایهٔ هارمونی و تئوری موسیقی.', 'active' => true, 'sort_order' => 1],
                ['id' => 'guitar', 'slug' => 'guitar', 'name' => 'گیتار', 'description' => 'ساز زهی مضرابی؛ کلاسیک، پاپ و فلامنکو.', 'active' => true, 'sort_order' => 2],
                ['id' => 'voice', 'slug' => 'voice', 'name' => 'آواز', 'description' => 'آموزش آواز، تنفس و تربیت شنوایی.', 'active' => true, 'sort_order' => 3],
                ['id' => 'violin', 'slug' => 'violin', 'name' => 'ویولن', 'description' => 'ساز زهی آرشه‌ای؛ ستون ارکستر زهی.', 'active' => true, 'sort_order' => 4],
                ['id' => 'drums', 'slug' => 'drums', 'name' => 'درامز', 'description' => 'ساز کوبه‌ای؛ ریتم و هماهنگی گروهی.', 'active' => true, 'sort_order' => 5],
                ['id' => 'theory', 'slug' => 'theory', 'name' => 'تئوری', 'description' => 'تئوری موسیقی، سلفژ و دیکتهٔ موسیقی.', 'active' => true, 'sort_order' => 6],
            ];
            foreach ($defaults as $row) {
                DB::table('instruments')->insert([
                    'organization_id' => 'org_demo',
                    ...$row,
                    'image_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('instruments');
    }
};
