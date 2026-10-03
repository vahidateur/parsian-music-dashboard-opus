<?php

namespace App\Http\Resources;

use App\Domain\Organization\OrganizationRules;
use App\Models\Organization;

/** Wire shape = TS `OrganizationSettings` (src/domains/organization/types.ts). */
final class OrganizationResource
{
    /**
     * @return array{name: string, tagline: string, locale: string, direction: string, calendar: string, currency: string, firstWeekday: int, defaultSessionMinutes: int, sessionGapMinutes: int, cancellationGraceHours: int, maxMakeupsPerTerm: int, workingDayStart: string, workingDayEnd: string, closedWeekdays: list<int>, updatedAt: string}
     */
    public static function toWire(Organization $settings): array
    {
        return [
            'name' => (string) $settings->name,
            'tagline' => (string) $settings->tagline,
            'locale' => (string) $settings->locale,
            'direction' => (string) $settings->direction,
            'calendar' => (string) $settings->calendar,
            'currency' => (string) $settings->currency,
            'firstWeekday' => (int) $settings->first_weekday,

            'defaultSessionMinutes' => (int) $settings->default_session_minutes,
            'sessionGapMinutes' => (int) $settings->session_gap_minutes,
            'cancellationGraceHours' => (int) $settings->cancellation_grace_hours,
            'maxMakeupsPerTerm' => (int) $settings->max_makeups_per_term,

            'workingDayStart' => (string) $settings->working_day_start,
            'workingDayEnd' => (string) $settings->working_day_end,
            // A column written before the settings migration is NULL, and absent
            // means "the shipped default", never "no closed day" — the same rule
            // `withRuleDefaults()` applies on the client.
            'closedWeekdays' => OrganizationRules::closedWeekdays($settings),

            // Millisecond precision, matching the dataset's own format
            // (`2026-01-01T00:00:00.000Z`). Second precision is not enough: a
            // patch and the read-back that follows it land in the same second,
            // and the panel would then claim the rules were never saved.
            'updatedAt' => $settings->updated_at?->format('Y-m-d\TH:i:s.v\Z') ?? '',
        ];
    }
}
