<?php

namespace App\Domain\Instruments;

use App\Domain\Media\MediaRules;
use App\Http\Requests\TenantRules;
use Illuminate\Validation\Rule;

final class InstrumentRules
{
    public const REQUIRED = ['name', 'slug'];

    public const SLUG_PATTERN = '/^[a-z][a-z0-9_-]{1,30}$/';

    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        $rules = [];
        foreach (self::rawFields() as $field => $fieldRules) {
            if (in_array($field, self::REQUIRED, true)) {
                $rules[$field] = ['required', ...$fieldRules];
            } else {
                $rules[$field] = ['sometimes', ...$fieldRules];
            }
        }

        return $rules;
    }

    /** @return array<string, list<mixed>> */
    public static function rawFields(): array
    {
        return [
            'name' => ['string', 'min:2', 'max:120'],
            'slug' => ['string', 'min:2', 'max:32', 'regex:'.self::SLUG_PATTERN],
            'description' => ['nullable', 'string', 'max:1000'],
            'imageId' => ['nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'active' => ['boolean'],
            'sortOrder' => ['integer', 'min:1', 'max:10000'],
        ];
    }
}
