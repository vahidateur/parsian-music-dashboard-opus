<?php

namespace App\Domain\Learning;

/**
 * Content-eligibility rules — the server port of the pure functions in
 * `src/domains/learning/eligibility.ts`, same rules and ordering.
 *
 * ELIGIBILITY IS COMPUTED, NEVER STORED. A student's eligible content is
 * derived at read time from their placement: content linked to any *active*
 * level of the student's program whose `order` is at or below the student's
 * current level. A level marked `exclusive` only grants access when it is
 * exactly the student's level.
 *
 * ORDERING. Items sort by level order, then link order, then title. The
 * client sorts titles with the `fa` locale; this server has no `intl`
 * extension, so titles compare byte-wise — deterministic, but not identical
 * to the client's tie-break when two items share both orders. That last
 * segment only decides between items that are already equally ranked, and
 * both compositions sort the same items the same way up to that segment.
 */
final class LearningEligibility
{
    /**
     * Content the student may currently open, attributed to its lowest
     * reachable level and sorted levelOrder / sortOrder / title.
     *
     * Teacher-only material is never eligible for a student, regardless of
     * level. An unplaced student — or a placement pointing outside its own
     * program — is granted nothing, never everything.
     *
     * @param  array{id: string, program_id: string, level_id: string}|null  $placement
     * @param  list<array{id: string, program_id: string, order: int, name: string, active: bool, exclusive: bool}>  $levels
     * @param  list<array{level_id: string, content_id: string, sort_order: int}>  $links
     * @param  list<array{id: string, title: string, active: bool, visibility: string}>  $content
     * @return list<array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int}>
     */
    public static function eligibleContent(?array $placement, array $levels, array $links, array $content): array
    {
        if ($placement === null) {
            return [];
        }

        $programLevels = [];
        $current = null;
        foreach ($levels as $level) {
            if ($level['program_id'] !== $placement['program_id']) {
                continue;
            }
            $programLevels[$level['id']] = $level;
            if ($level['id'] === $placement['level_id']) {
                $current = $level;
            }
        }
        if ($current === null) {
            return [];
        }

        $reachable = [];
        foreach ($programLevels as $id => $level) {
            if (! $level['active']) {
                continue;
            }
            $ok = $level['exclusive'] ? $id === $current['id'] : $level['order'] <= $current['order'];
            if ($ok) {
                $reachable[$id] = $level;
            }
        }

        $byId = [];
        foreach ($content as $item) {
            $byId[$item['id']] = $item;
        }

        $chosen = [];
        foreach ($links as $link) {
            $level = $reachable[$link['level_id']] ?? null;
            if ($level === null) {
                continue;
            }
            $item = $byId[$link['content_id']] ?? null;
            if ($item === null || ! $item['active']) {
                continue;
            }
            if ($item['visibility'] === 'teachers') {
                continue;
            }

            $existing = $chosen[$item['id']] ?? null;
            if ($existing !== null && $existing['level_order'] <= $level['order']) {
                continue;
            }
            $chosen[$item['id']] = [
                'content' => $item,
                'level_id' => $level['id'],
                'level_order' => $level['order'],
                'level_name' => $level['name'],
                'sort_order' => $link['sort_order'],
            ];
        }

        return self::sortItems(array_values($chosen));
    }

    /**
     * Content locked on higher levels, with the honest reason
     * ("در سطح X باز می‌شود").
     *
     * Same inputs as eligible content; items already unlocked through a lower
     * level are excluded rather than duplicated, and teacher-only material
     * stays hidden.
     *
     * @param  array{id: string, program_id: string, level_id: string}|null  $placement
     * @param  list<array{id: string, program_id: string, order: int, name: string, active: bool, exclusive: bool}>  $levels
     * @param  list<array{level_id: string, content_id: string, sort_order: int}>  $links
     * @param  list<array{id: string, title: string, active: bool, visibility: string}>  $content
     * @return list<array{content: array, level_id: string, level_order: int, level_name: string, sort_order: int, reason: string}>
     */
    public static function lockedContent(?array $placement, array $levels, array $links, array $content): array
    {
        if ($placement === null) {
            return [];
        }

        $programLevels = [];
        $current = null;
        foreach ($levels as $level) {
            if ($level['program_id'] !== $placement['program_id']) {
                continue;
            }
            $programLevels[$level['id']] = $level;
            if ($level['id'] === $placement['level_id']) {
                $current = $level;
            }
        }
        if ($current === null) {
            return [];
        }

        $eligibleIds = [];
        foreach (self::eligibleContent($placement, $levels, $links, $content) as $row) {
            $eligibleIds[$row['content']['id']] = true;
        }

        $lockedLevels = [];
        foreach ($programLevels as $id => $level) {
            if (! $level['active']) {
                continue;
            }
            if ($level['exclusive']) {
                if ($id !== $current['id']) {
                    $lockedLevels[$id] = $level;
                }
                continue;
            }
            if ($level['order'] > $current['order']) {
                $lockedLevels[$id] = $level;
            }
        }

        $byId = [];
        foreach ($content as $item) {
            $byId[$item['id']] = $item;
        }

        $chosen = [];
        foreach ($links as $link) {
            $level = $lockedLevels[$link['level_id']] ?? null;
            if ($level === null) {
                continue;
            }
            if (isset($eligibleIds[$link['content_id']])) {
                continue;
            }
            $item = $byId[$link['content_id']] ?? null;
            if ($item === null || ! $item['active']) {
                continue;
            }
            if ($item['visibility'] === 'teachers') {
                continue;
            }

            $existing = $chosen[$item['id']] ?? null;
            if ($existing !== null && $existing['level_order'] <= $level['order']) {
                continue;
            }
            $chosen[$item['id']] = [
                'content' => $item,
                'level_id' => $level['id'],
                'level_order' => $level['order'],
                'level_name' => $level['name'],
                'sort_order' => $link['sort_order'],
                'reason' => "در سطح {$level['name']} باز می‌شود",
            ];
        }

        return self::sortItems(array_values($chosen));
    }

    /**
     * Which students can currently open a given content item.
     *
     * @param  list<array{id: string, program_id: string, order: int, active: bool, exclusive: bool}>  $levels
     * @param  list<array{level_id: string, content_id: string}>  $links
     * @param  list<array{student_id: string, program_id: string, level_id: string}>  $placements
     * @return list<string>
     */
    public static function eligibleStudentIds(string $contentId, array $levels, array $links, array $placements): array
    {
        $attached = [];
        foreach ($links as $link) {
            if ($link['content_id'] === $contentId) {
                $attached[$link['level_id']] = true;
            }
        }
        if ($attached === []) {
            return [];
        }

        $levelById = [];
        foreach ($levels as $level) {
            $levelById[$level['id']] = $level;
        }

        $minOrderByProgram = [];
        $exclusiveLevels = [];
        foreach (array_keys($attached) as $levelId) {
            $level = $levelById[$levelId] ?? null;
            if ($level === null || ! $level['active']) {
                continue;
            }
            if ($level['exclusive']) {
                $exclusiveLevels[$level['id']] = true;
                continue;
            }
            $seen = $minOrderByProgram[$level['program_id']] ?? null;
            if ($seen === null || $level['order'] < $seen) {
                $minOrderByProgram[$level['program_id']] = $level['order'];
            }
        }

        $out = [];
        foreach ($placements as $placement) {
            if (isset($exclusiveLevels[$placement['level_id']])) {
                $out[] = $placement['student_id'];
                continue;
            }
            $threshold = $minOrderByProgram[$placement['program_id']] ?? null;
            if ($threshold === null) {
                continue;
            }
            $level = $levelById[$placement['level_id']] ?? null;
            if ($level !== null && $level['order'] >= $threshold) {
                $out[] = $placement['student_id'];
            }
        }

        return $out;
    }

    /**
     * @param  list<array{level_order: int, sort_order: int, content: array{id?: string, title?: string}}>  $items
     * @return list<array{level_order: int, sort_order: int, content: array{id?: string, title?: string}}>
     */
    private static function sortItems(array $items): array
    {
        usort($items, static function (array $a, array $b): int {
            if ($a['level_order'] !== $b['level_order']) {
                return $a['level_order'] <=> $b['level_order'];
            }
            if ($a['sort_order'] !== $b['sort_order']) {
                return $a['sort_order'] <=> $b['sort_order'];
            }

            return strcmp((string) ($a['content']['title'] ?? ''), (string) ($b['content']['title'] ?? ''));
        });

        return $items;
    }
}
