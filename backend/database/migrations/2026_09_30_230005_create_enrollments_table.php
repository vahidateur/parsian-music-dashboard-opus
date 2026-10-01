<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Student ↔ class over time. An active enrollment in a class taught by a
     * teacher is what grants that teacher read access to the student (T-02).
     */
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('organization_id');
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->string('student_id')->index();
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->string('class_id');
            $table->foreign('class_id')->references('id')->on('classes');
            $table->string('status');
            $table->string('start_date');
            $table->string('end_date')->nullable();
            $table->string('pricing_label');
            $table->bigInteger('pricing_amount');
            $table->timestamps();
            $table->index(['organization_id', 'class_id', 'status']);
        });

        // At most one open (active|waitlist) enrollment per student and class.
        // MySQL has no partial indexes; there the service's transactional
        // check is the only guard.
        if (in_array(DB::connection()->getDriverName(), ['sqlite', 'pgsql'], true)) {
            DB::statement(
                "CREATE UNIQUE INDEX enrollments_open_unique ON enrollments (student_id, class_id) WHERE status IN ('active', 'waitlist')"
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};
