<?php

namespace App\Http\Resources;

use App\Domain\Branding\BrandingService;
use App\Models\Branding;

/** Wire shape = TS `BrandingSettings` (camelCase). */
final class BrandingResource
{
    /** @return array<string, mixed> */
    public static function toWire(Branding $branding): array
    {
        return BrandingService::toWire($branding);
    }
}
