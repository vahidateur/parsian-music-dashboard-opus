<?php

namespace App\Domain\Learning;

/**
 * Field rules shared by store/update program requests (camelCase wire keys).
 *
 * A program belongs to an EXISTING instrument: naming a missing one would
 * leave every picker that filters by it showing a program for a ghost
 * instrument.
 */
final class ProgramRules
{
    public const REQUIRED = ['name', 'instrumentId'];

    /** @return array<string, list<mixed>> */
    public static function rawFields(): array
    {
        return [
            'name' => ['string', 'min:2', 'max:120'],
            'instrumentId' => ['string', 'max:64'],
            'description' => ['nullable', 'string', 'max:2000'],
            'active' => ['boolean'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function createFields(): array
    {
        $rules = [];
        foreach (self::rawFields() as $field => $fieldRules) {
            $rules[$field] = in_array($field, self::REQUIRED, true)
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
