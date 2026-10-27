<?php

namespace App\Domain\Learning;

use App\Http\Requests\TenantRules;

/**
 * Field rules shared by store/update content requests (camelCase wire keys).
 */
final class ContentRules
{
    public const TYPES = ['pdf', 'image', 'audio', 'voice', 'video', 'document'];

    public const VISIBILITIES = ['students', 'teachers'];

    /** @return array<string, list<mixed>> */
    public static function rawFields(): array
    {
        return [
            'title' => ['string', 'min:2', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => ['string', 'in:'.implode(',', self::TYPES)],
            'mediaId' => ['nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'author' => ['nullable', 'string', 'max:120'],
            'teacherId' => ['nullable', 'string', 'max:64'],
            'instrumentId' => ['nullable', 'string', 'max:64'],
            'visibility' => ['string', 'in:'.implode(',', self::VISIBILITIES)],
            'active' => ['boolean'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function createFields(): array
    {
        $rules = [];
        foreach (self::rawFields() as $field => $fieldRules) {
            $rules[$field] = in_array($field, ['title', 'type'], true)
                ? ['required', ...$fieldRules]
                : ['sometimes', ...$fieldRules];
        }

        return $rules;
    }

    /** @return array<string, list<mixed>> */
    public static function updateFields(): array
    {
        $rules = [];
        foreach (self::rawFields() as $field => $fieldRules) {
            $rules[$field] = ['sometimes', ...$fieldRules];
        }

        return $rules;
    }
}
