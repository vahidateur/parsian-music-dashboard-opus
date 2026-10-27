<?php

namespace App\Http\Resources;

use App\Models\Instrument;

/** Wire shape = TS `InstrumentRecord` (camelCase). */
final class InstrumentResource
{
    /** @return array<string, mixed> */
    public static function toWire(Instrument $instrument): array
    {
        $wire = [
            'id' => $instrument->id,
            'slug' => $instrument->slug,
            'name' => $instrument->name,
            'description' => $instrument->description,
            'active' => $instrument->active,
            'sortOrder' => $instrument->sort_order,
        ];
        if ($instrument->image_id !== null && $instrument->image_id !== '') {
            $wire['imageId'] = $instrument->image_id;
        }

        return $wire;
    }
}
