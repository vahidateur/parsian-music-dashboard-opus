<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // How the single accepted payment arrived: the academy's POS
            // terminal or a card-to-card transfer the accountant verified
            // against the bank receipt. The reference carries the transfer
            // tracking code when there is one.
            $table->string('paid_method', 16)->nullable()->after('paid_by_user_id');
            $table->string('paid_reference', 64)->nullable()->after('paid_method');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['paid_method', 'paid_reference']);
        });
    }
};
