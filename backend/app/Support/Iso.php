<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Support\Carbon;

/** ISO-8601 in the exact form JavaScript's `Date#toISOString()` produces. */
final class Iso
{
    public static function format(?DateTimeInterface $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return Carbon::instance($value)->utc()->format('Y-m-d\TH:i:s.v\Z');
    }
}
