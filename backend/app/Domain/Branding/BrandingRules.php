<?php

namespace App\Domain\Branding;

/**
 * Validation vocabulary shared by the branding request.
 *
 * Mirrors `src/domains/branding/types.ts`: strict `#RRGGBB` (no shorthand,
 * no named colours — values land in CSS custom properties, §24) and the
 * closed font list. The server is the control; the client repeats the same
 * rules for fast field errors.
 */
final class BrandingRules
{
    public const HEX_PATTERN = '/^#[0-9a-fA-F]{6}$/';

    /** @var list<string> */
    public const PERSIAN_FONTS = ['Vazirmatn', 'Estedad', 'IranYekan', 'Sahel'];
}
