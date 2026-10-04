<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Organization settings — the server's copy of `OrganizationSettings`.
 *
 * WHY THESE COLUMNS LIVE ON `organizations`
 *
 * The academy has exactly one set of rules and exactly one organization row, so
 * the settings ARE the tenant record, not a child of it. Putting them here keeps
 * a single authoritative source for the academy name (`organizations.name` is
 * the `name` field of `OrganizationSettings`) and makes tenant isolation
 * structural: the row is always loaded by `whereKey(TenantContext)`, so another
 * organization's settings are not reachable by construction.
 *
 * The values below are the shipped defaults from
 * `src/domains/organization/types.ts` (`DEFAULT_ORGANIZATION_SETTINGS`), not
 * invented ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('tagline')->default('تالار هنر، جادو و موسیقی')->after('name');
            $table->string('locale', 16)->default('fa-IR')->after('tagline');
            $table->string('direction', 3)->default('rtl')->after('locale');
            $table->string('calendar', 16)->default('jalali')->after('direction');
            $table->string('currency', 16)->default('toman')->after('calendar');

            // 0 = شنبه … 6 = جمعه, the product's own convention (WeekdayIndex).
            $table->unsignedTinyInteger('first_weekday')->default(0)->after('currency');

            /* ---- session rules ---- */
            $table->unsignedSmallInteger('default_session_minutes')->default(60)->after('status');
            $table->unsignedSmallInteger('session_gap_minutes')->default(10)->after('default_session_minutes');
            $table->unsignedSmallInteger('cancellation_grace_hours')->default(24)->after('session_gap_minutes');
            $table->unsignedSmallInteger('max_makeups_per_term')->default(2)->after('cancellation_grace_hours');

            /* ---- working hours ---- */
            $table->string('working_day_start', 5)->default('08:00')->after('max_makeups_per_term');
            $table->string('working_day_end', 5)->default('21:00')->after('working_day_start');
            // Nullable on purpose: a row written before this migration has no
            // value, and `closed_weekdays` absent means "the shipped default
            // [6]", never "no closed day" — the same rule
            // `withRuleDefaults()` applies on the client.
            $table->json('closed_weekdays')->nullable()->after('working_day_end');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn([
                'tagline',
                'locale',
                'direction',
                'calendar',
                'currency',
                'first_weekday',
                'default_session_minutes',
                'session_gap_minutes',
                'cancellation_grace_hours',
                'max_makeups_per_term',
                'working_day_start',
                'working_day_end',
                'closed_weekdays',
            ]);
        });
    }
};
