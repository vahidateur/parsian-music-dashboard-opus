<?php

namespace App\Domain\Library;

use Illuminate\Support\Carbon;

/**
 * Persian display projections for a library resource.
 *
 * These mirror, label for label, the helpers the client already ships —
 * `sizeLabel()` / `durationLabel()` / `addedLabel()` in
 * src/domains/library/localRepository.ts and `faNum()` in src/lib/format.ts —
 * so a server-backed row renders the same way a demo-backed one does. The
 * values are presentation only: nothing here is persisted, and nothing here
 * decides access.
 */
final class ResourcePresenter
{
    /** The catalogue's marker for a size that has no bytes behind it. */
    public const UNKNOWN_SIZE = 'نامشخص';

    private const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    private const ASCII_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    /** Number with Persian digits and Persian separators (٬ and ٫). */
    public static function faNum(float|int $number, int $decimals = 0): string
    {
        $fixed = number_format($number, $decimals, '.', ',');

        return str_replace(
            [',', '.'],
            ['٬', '٫'],
            str_replace(self::ASCII_DIGITS, self::PERSIAN_DIGITS, $fixed),
        );
    }

    /**
     * Byte length as the Persian label the catalogue displays.
     *
     * Called with `null` by the wire resource: this slice stores metadata only,
     * so the server holds no bytes and every row reports "نامشخص". The argument
     * becomes the real byte count once the media domain reaches the backend —
     * the label itself does not change.
     */
    public static function sizeLabel(?int $bytes): string
    {
        if ($bytes === null || $bytes <= 0) {
            return self::UNKNOWN_SIZE;
        }

        if ($bytes < 1024) {
            return self::faNum($bytes).' بایت';
        }

        if ($bytes < 1024 * 1024) {
            return self::faNum((int) round($bytes / 1024)).' کیلوبایت';
        }

        return self::faNum($bytes / (1024 * 1024), 1).' مگابایت';
    }

    /** Seconds as `m:ss` in Persian digits. */
    public static function durationLabel(?int $seconds): ?string
    {
        if ($seconds === null) {
            return null;
        }

        $safe = $seconds > 0 ? (int) floor($seconds) : 0;
        $remainder = $safe % 60;
        $padded = $remainder < 10 ? '۰'.self::faNum($remainder) : self::faNum($remainder);

        return self::faNum((int) floor($safe / 60)).':'.$padded;
    }

    /** `added` is a Persian relative label, derived from the real timestamp. */
    public static function addedLabel(?Carbon $createdAt): string
    {
        if ($createdAt === null) {
            return 'امروز';
        }

        $days = (int) floor((Carbon::now()->getTimestamp() - $createdAt->getTimestamp()) / 86_400);

        if ($days <= 0) {
            return 'امروز';
        }

        if ($days === 1) {
            return 'دیروز';
        }

        return self::faNum($days).' روز پیش';
    }
}
