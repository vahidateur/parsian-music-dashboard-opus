<?php

namespace App\Domain\Progress;

use App\Models\Piece;
use App\Models\PieceAssignment;

/**
 * The deterministic recommendation engine — a port of
 * `src/domains/progress/recommendations.ts`.
 *
 * Rules over the analytics output: no model, no randomness, no fabricated
 * confidence. Every recommendation carries the evidence that triggered it, so a
 * teacher can disagree with the reasoning rather than with an oracle.
 *
 * Returns an empty array when nothing is worth saying. Silence is a valid
 * output; padding it with filler advice would train people to ignore the panel.
 */
final class RecommendationEngine
{
    /** Days without an event after which we nudge for a progress entry. */
    public const int STALE_EVENT_DAYS = 21;

    /** Mastery at or above which a piece is worth reviewing for completion. */
    public const int COMPLETION_MASTERY = 90;

    private const array PRIORITY_RANK = ['attention' => 0, 'suggested' => 1, 'info' => 2];

    /** `RECOMMENDATION_LABEL`, for clients that want a caption. */
    public const array KIND_LABEL = [
        'reduce_tempo' => 'کاهش موقت سرعت',
        'isolate_range' => 'تمرکز روی محدودهٔ مشکل‌دار',
        'shorten_practice' => 'تمرین کوتاه‌تر و منظم‌تر',
        'revisit_prerequisite' => 'مرور محتوای پیش‌نیاز',
        'advance_range' => 'گسترش محدودهٔ تمرین',
        'raise_tempo_target' => 'افزایش سرعت هدف',
        'teacher_review' => 'بازبینی توسط مدرس',
        'record_progress' => 'ثبت پیشرفت',
        'consider_completion' => 'بررسی برای اتمام قطعه',
    ];

    /**
     * @param  array<string, mixed>  $insight  an insight produced by `Analytics::classify()`
     * @param  array<int, array{id: string, title: string, description: string, levelOrder: int}>  $eligibleContent
     * @return array<int, array<string, mixed>>
     */
    public function recommendForAssignment(
        array $insight,
        PieceAssignment $assignment,
        ?Piece $piece,
        array $eligibleContent = [],
    ): array {
        $out = [];
        $evidence = $insight['evidence'];

        $base = [
            'assignmentId' => $assignment->id,
            'pieceId' => $assignment->piece_id,
            'evidence' => $evidence,
        ];

        $rangeText = $evidence['rangeLabel'] ?? 'محدودهٔ فعلی';
        $content = $this->relatedContent($piece, $eligibleContent);
        $tempo = $assignment->latest['tempoBpm'] ?? null;
        $mastery = $assignment->latest['mastery'] ?? null;

        switch ($insight['status']) {
            case 'possible_plateau':
                // Classic remediation, ordered from least to most disruptive.
                if (is_numeric($tempo)) {
                    $tempo = (int) $tempo;
                    $out[] = [
                        ...$base,
                        'kind' => 'reduce_tempo',
                        'priority' => 'attention',
                        'reason' => "{$evidence['rangeRepeats']} جلسهٔ متوالی روی {$rangeText} بدون تغییر محسوس در تسلط. کاهش موقت سرعت از {$tempo} به حدود ".max(20, (int) round($tempo * 0.85)).' ضرب می‌تواند گره را باز کند.',
                        'suggestedContentIds' => $content,
                    ];
                }
                $out[] = [
                    ...$base,
                    'kind' => 'isolate_range',
                    'priority' => 'attention',
                    'reason' => "تمرین {$rangeText} به‌صورت جداگانه و کوتاه، به‌جای اجرای کامل قطعه.",
                    'suggestedContentIds' => $content,
                ];
                $out[] = [
                    ...$base,
                    'kind' => 'revisit_prerequisite',
                    'priority' => 'suggested',
                    'reason' => 'مرور محتوای سطوح پیشین که همین مهارت را پوشش می‌دهد.',
                    'suggestedContentIds' => $content,
                ];
                break;

            case 'regression':
                $drop = abs((int) ($evidence['masteryChange'] ?? 0));
                $out[] = [
                    ...$base,
                    'kind' => 'teacher_review',
                    'priority' => 'attention',
                    'reason' => "تسلط {$drop} واحد کاهش یافته است. بازبینی مدرس پیش از ادامه توصیه می‌شود.",
                    'suggestedContentIds' => $content,
                ];
                $out[] = [
                    ...$base,
                    'kind' => 'shorten_practice',
                    'priority' => 'suggested',
                    'reason' => 'جلسات کوتاه‌تر و منظم‌تر معمولاً از افت ناشی از خستگی جلوگیری می‌کند.',
                    'suggestedContentIds' => [],
                ];
                break;

            case 'improving':
                $out[] = [
                    ...$base,
                    'kind' => 'advance_range',
                    'priority' => 'suggested',
                    'reason' => "تسلط {$evidence['masteryChange']} واحد بهبود یافته است؛ گسترش محدوده فراتر از {$rangeText} منطقی به نظر می‌رسد.",
                    'suggestedContentIds' => $content,
                ];
                if (is_numeric($tempo)) {
                    $tempo = (int) $tempo;
                    $out[] = [
                        ...$base,
                        'kind' => 'raise_tempo_target',
                        'priority' => 'info',
                        'reason' => "سرعت هدف را می‌توان از {$tempo} به حدود ".min(400, (int) round($tempo * 1.1)).' ضرب افزایش داد.',
                        'suggestedContentIds' => [],
                    ];
                }
                break;

            case 'slowing':
                $out[] = [
                    ...$base,
                    'kind' => 'shorten_practice',
                    'priority' => 'suggested',
                    'reason' => "پیشرفت در {$evidence['windowDays']} روز گذشته کند شده است. تمرین کوتاه‌تر اما منظم‌تر پیشنهاد می‌شود.",
                    'suggestedContentIds' => $content,
                ];
                break;

            case 'insufficient_data':
                $out[] = [
                    ...$base,
                    'kind' => 'record_progress',
                    'priority' => 'info',
                    'reason' => ($evidence['events'] ?? 0) === 0
                        ? 'هنوز پیشرفتی برای این قطعه ثبت نشده است؛ بدون داده تحلیلی ممکن نیست.'
                        : 'برای تحلیل روند دست‌کم دو ثبت پیشرفت لازم است.',
                    'suggestedContentIds' => [],
                ];
                break;

            case 'stable':
            default:
                break;
        }

        // Independent of trend: a high-mastery piece deserves a completion
        // decision.
        if (is_numeric($mastery) && (int) $mastery >= self::COMPLETION_MASTERY && $assignment->status !== 'polishing') {
            $mastery = (int) $mastery;
            $out[] = [
                ...$base,
                'kind' => 'consider_completion',
                'priority' => 'info',
                'reason' => "تسلط به {$mastery} رسیده است؛ بررسی کنید که قطعه به مرحلهٔ صیقل‌دهی یا اتمام رسیده باشد.",
                'suggestedContentIds' => [],
            ];
        }

        // Independent of trend: a stale assignment needs an entry before any
        // analysis can be trusted.
        $stale = $evidence['daysSinceLastEvent'] ?? null;
        if (is_numeric($stale) && (int) $stale >= self::STALE_EVENT_DAYS && $insight['status'] !== 'insufficient_data') {
            $stale = (int) $stale;
            $out[] = [
                ...$base,
                'kind' => 'record_progress',
                'priority' => 'suggested',
                'reason' => "{$stale} روز از آخرین ثبت پیشرفت گذشته است؛ تحلیل‌ها ممکن است قدیمی باشند.",
                'suggestedContentIds' => [],
            ];
        }

        return $out;
    }

    /**
     * Highest urgency first; stable within a priority.
     *
     * @param  array<int, array<string, mixed>>  $recommendations
     * @return array<int, array<string, mixed>>
     */
    public function sort(array $recommendations): array
    {
        $ranked = $recommendations;
        // usort is not stable in PHP 8 before 8.0; from 8.0 sorts are stable.
        usort($ranked, fn (array $a, array $b): int => self::PRIORITY_RANK[$a['priority']] <=> self::PRIORITY_RANK[$b['priority']]);

        return array_values($ranked);
    }

    /**
     * Picks eligible content plausibly related to a piece — `relatedContent()`.
     *
     * DEFERRED INPUT: learning has no server-side representation (PB-3 stays
     * Option A for learning), so callers pass an empty eligible list today and
     * this returns `[]` — exactly what the contract returns for zero eligible
     * items. That is the safe direction: a recommendation must never surface
     * material the student is not permitted to open (§21).
     *
     * @param  array<int, array{id: string, title: string, description: string, levelOrder: int}>  $eligible
     * @return array<int, string>
     */
    private function relatedContent(?Piece $piece, array $eligible, int $limit = 3): array
    {
        if ($eligible === []) {
            return [];
        }

        $attached = array_flip($piece->contentIds ?? []);
        $preferred = array_values(array_map(
            fn (array $e): string => $e['id'],
            array_filter($eligible, fn (array $e): bool => isset($attached[$e['id']])),
        ));

        if (count($preferred) >= $limit) {
            return array_slice($preferred, 0, $limit);
        }

        $needles = array_values(array_filter(
            [$piece?->title, $piece?->composer],
            fn ($value): bool => is_string($value) && mb_strlen($value) > 2,
        ));
        $needles = array_map(fn (string $v): string => mb_strtolower($v), $needles);

        $scored = [];
        foreach ($eligible as $e) {
            if (isset($attached[$e['id']])) {
                continue;
            }
            $haystack = mb_strtolower($e['title'].' '.$e['description']);
            $score = 0;
            foreach ($needles as $needle) {
                if (str_contains($haystack, $needle)) {
                    $score++;
                }
            }
            $scored[] = ['id' => $e['id'], 'score' => $score, 'order' => $e['levelOrder']];
        }

        // Highest textual overlap first, then the most advanced level the
        // student has unlocked — closest to where they are actually working.
        usort($scored, fn (array $a, array $b): int => ($b['score'] <=> $a['score']) ?: ($b['order'] <=> $a['order']));

        return array_slice(array_merge($preferred, array_column($scored, 'id')), 0, $limit);
    }
}
