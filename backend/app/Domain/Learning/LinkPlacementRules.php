<?php

namespace App\Domain\Learning;

/** Field rules for level↔content link and placement writes. */
final class LinkPlacementRules
{
    /** @return array<string, list<mixed>> */
    public static function attachFields(): array
    {
        return [
            // The caller's independently resolved program (I13 Checkpoint 2):
            // the level must belong to it, or the write is refused.
            'contentId' => ['required', 'string', 'max:64'],
            'programId' => ['required', 'string', 'max:64'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function assignFields(): array
    {
        return [
            'studentId' => ['required', 'string', 'max:64'],
            'programId' => ['required', 'string', 'max:64'],
            'levelId' => ['required', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:4000'],
            // Defaults to now server-side; validated here so a garbage value
            // is a 422, not a database error.
            'effectiveDate' => ['nullable', 'string', 'max:64', 'date'],
        ];
    }
}
