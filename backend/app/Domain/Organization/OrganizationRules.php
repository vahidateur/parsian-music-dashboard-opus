<?php

namespace App\Domain\Organization;

use App\Models\Organization;

/**
 * Derived answers about the academy's rules — the server's copy of
 * `src/domains/organization/rules.ts`.
 *
 * WHY THIS CLASS EXISTS
 *
 * The conflict engine cannot ask the client what the academy's rules are; a
 * rule that only exists in the browser is not enforced. This is the same
 * arithmetic as the frontend file, reading the same fields, so both sides answer
 * the same question the same way. It is a translation of an existing rule, not a
 * new interpretation of one.
 *
 * Every answer that cannot be computed returns `null` (or the shipped default is
 * left unread) rather than substituting an invented value: an unreadable rule is
 * NOT evaluated, and never silently becomes "allowed".
 *
 * Defaults match `DEFAULT_ORGANIZATION_SETTINGS` in types.ts.
 */
final class OrganizationRules
{
    /** The closed weekday an academy starts with: Friday (6). */
    public const DEFAULT_CLOSED_WEEKDAYS = [6];

    public const DEFAULT_SESSION_GAP_MINUTES = 10;

    private const TIME_OF_DAY = '/^([01]\d|2[0-3]):[0-5]\d$/';

    public static function isTimeOfDay(string $value): bool
    {
        return preg_match(self::TIME_OF_DAY, trim($value)) === 1;
    }

    /** Minutes since midnight, or `null` when the string is not a time of day. */
    public static function timeToMinutes(string $value): ?int
    {
        if (! self::isTimeOfDay($value)) {
            return null;
        }

        [$hours, $minutes] = array_map('intval', explode(':', trim($value)));

        return $hours * 60 + $minutes;
    }

    /** Inverse of `timeToMinutes`, for messages: 540 → "09:00". */
    public static function pad(int $minutes): string
    {
        return str_pad((string) intdiv($minutes, 60), 2, '0', STR_PAD_LEFT).':'
            .str_pad((string) ($minutes % 60), 2, '0', STR_PAD_LEFT);
    }

    /**
     * The bookable window in minutes since midnight; `null` when it cannot be
     * read — an unparsable clock, or a window that closes before it opens.
     *
     * @return array{start: int, end: int}|null
     */
    public static function workingWindow(Organization $settings): ?array
    {
        $start = self::timeToMinutes((string) $settings->working_day_start);
        $end = self::timeToMinutes((string) $settings->working_day_end);

        if ($start === null || $end === null || $end <= $start) {
            return null;
        }

        return ['start' => $start, 'end' => $end];
    }

    /**
     * Whether a session sits inside the bookable window.
     *
     * `null` means the question cannot be answered — an unparsable time, or a
     * window that was never configured — which callers must treat as "no
     * opinion", never as "allowed" or "forbidden".
     */
    public static function isInsideWorkingHours(Organization $settings, string $startTime, string $endTime): ?bool
    {
        $window = self::workingWindow($settings);
        $start = self::timeToMinutes($startTime);
        $end = self::timeToMinutes($endTime);

        if ($window === null || $start === null || $end === null) {
            return null;
        }

        return $start >= $window['start'] && $end <= $window['end'];
    }

    /** Days the academy does not open. A NULL column means the shipped default. */
    public static function closedWeekdays(Organization $settings): array
    {
        $days = $settings->closed_weekdays;

        // Mirrors `withRuleDefaults()`: invalid entries are dropped rather than
        // replaced, and only a value that is not a list at all — a column a row
        // predating the settings migration never had — reads as the default.
        if (! is_array($days)) {
            return self::DEFAULT_CLOSED_WEEKDAYS;
        }

        return array_values(array_filter(
            array_map('intval', $days),
            static fn (int $day): bool => $day >= 0 && $day <= 6,
        ));
    }

    public static function isClosedWeekday(Organization $settings, int $weekday): bool
    {
        return in_array($weekday, self::closedWeekdays($settings), true);
    }

    /** Expected turnaround between two sessions of one teacher or room. */
    public static function gapMinutes(Organization $settings): int
    {
        return max(0, (int) $settings->session_gap_minutes);
    }

    /**
     * The rules the scheduling engine consumes, lifted out of the record —
     * the server's `schedulingRules()`.
     *
     * @return array{closedWeekdays: list<int>, gapMinutes: int, workingHours: array{start: int, end: int}|null}
     */
    public static function schedulingRules(Organization $settings): array
    {
        return [
            'closedWeekdays' => self::closedWeekdays($settings),
            'gapMinutes' => self::gapMinutes($settings),
            'workingHours' => self::workingWindow($settings),
        ];
    }
}
