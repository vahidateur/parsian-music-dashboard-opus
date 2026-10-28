<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->string('organization_id', 64);
            $table->string('id', 64);
            $table->primary(['organization_id', 'id']);

            $table->string('student_id', 64);
            $table->string('title', 120);
            // Amount in toman. Partial payments are out of v1 scope: an
            // invoice is either due or paid, in one accepted payment.
            $table->unsignedBigInteger('amount');
            $table->string('status', 16)->default('due');
            $table->timestamp('issued_at')->useCurrent();
            $table->date('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('paid_by_user_id', 64)->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
