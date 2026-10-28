<?php

namespace App\Domain\Learning;

/**
 * Field rules shared by store/update level requests (camelCase wire keys).
 *
 * `order` is accepted on create (append by default, insert-and-shift when
 * given) and deliberately ABSENT on update: order changes go through the
 * reorder endpoint, which keeps siblings contiguous. Accepting it in PATCH
 * would open a gap with a single write.
 */
final class LevelRules
{
    /** @return array<string, list<mixed>> */
    public static function createFields(): array
    {
        return [
            'programId' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'min:1', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'objectives' => ['array'],
            'objectives.*' => ['string'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'active' => ['boolean'],
            'exclusive' => ['boolean'],
            'prerequisiteLevelIds' => ['array'],
            'prerequisiteLevelIds.*' => ['string', 'max:64'],
            'order' => ['integer', 'min:1'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function updateFields(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:1', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'objectives' => ['array'],
            'objectives.*' => ['string'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'active' => ['boolean'],
            'exclusive' => ['boolean'],
            'prerequisiteLevelIds' => ['array'],
            'prerequisiteLevelIds.*' => ['string', 'max:64'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function reorderFields(): array
    {
        return ['order' => ['required', 'integer', 'min:1']];
    }
}
