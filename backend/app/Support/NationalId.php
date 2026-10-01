<?php

namespace App\Support;

/**
 * Iranian national ID (کد ملی): server port of the pure functions in
 * src/lib/nationalId.ts (normalizeNationalId / validateNationalId), same
 * rules and messages.
 */
final class NationalId
{
    private const DIGIT_MAP = [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ];

    public const MESSAGES = [
        'required' => 'کد ملی الزامی است.',
        'length' => 'کد ملی باید ۱۰ رقم باشد.',
        'repeated' => 'کد ملی معتبر نیست.',
        'checksum' => 'کد ملی معتبر نیست.',
    ];

    /** ASCII digits only; 8–9 digit values are zero-padded to 10. */
    public static function normalize(string $input): string
    {
        $ascii = preg_replace('/\D/', '', strtr(trim($input), self::DIGIT_MAP)) ?? '';
        $length = strlen($ascii);

        return $length >= 8 && $length < 10 ? str_pad($ascii, 10, '0', STR_PAD_LEFT) : $ascii;
    }

    /** Failure reason (key of MESSAGES), or null when valid. */
    public static function validate(string $input): ?string
    {
        $value = self::normalize($input);
        if ($value === '') {
            return 'required';
        }
        if (strlen($value) !== 10) {
            return 'length';
        }
        if (preg_match('/^(\d)\1{9}$/', $value) === 1) {
            return 'repeated';
        }

        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += (int) $value[$i] * (10 - $i);
        }
        $remainder = $sum % 11;
        $check = (int) $value[9];
        $ok = $remainder < 2 ? $check === $remainder : $check === 11 - $remainder;

        return $ok ? null : 'checksum';
    }

    /** Appends the check digit to 9 digits (used by factories). */
    public static function withCheckDigit(string $nineDigits): string
    {
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += (int) $nineDigits[$i] * (10 - $i);
        }
        $remainder = $sum % 11;

        return $nineDigits.($remainder < 2 ? $remainder : 11 - $remainder);
    }
}
