<?php

namespace App\Domain\Progress;

/**
 * Field limits for pieces and assignments.
 *
 * Every bound is either taken from the client contract (`src/domains/progress/
 * types.ts`: MASTERY_SCALE, TEMPO_BOUNDS, PRACTICE_MINUTES_BOUNDS,
 * MAX_RANGE_VALUE) or is a plain storage limit. The interesting semantics —
 * which student, which piece, which teacher — live in the services, which
 * resolve them against the tenant's own rows.
 */
final class ProgressRules
{
    /** Bounds copied verbatim from the client contract. */
    public const MAX_RANGE_VALUE = 100_000;

    /** `MASTERY_SCALE` — the one measurement every event carries. */
    public const MASTERY_MIN = 0;

    public const MASTERY_MAX = 100;

    /** `TEMPO_BOUNDS` — a tempo outside this range is a typo, not a tempo. */
    public const TEMPO_MIN = 20;

    public const TEMPO_MAX = 400;

    /** `PRACTICE_MINUTES_BOUNDS` — zero is meaningful ("practised elsewhere"). */
    public const PRACTICE_MINUTES_MIN = 0;

    public const PRACTICE_MINUTES_MAX = 600;

    public const MAX_TITLE = 200;

    public const MAX_COMPOSER = 200;

    public const MAX_DESCRIPTION = 5_000;

    public const MAX_NOTES = 5_000;

    public const MAX_IDENTIFIER = 100;

    public const MAX_CONTENT_IDS = 200;
}
