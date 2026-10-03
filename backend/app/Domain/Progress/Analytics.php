<?php

namespace App\Domain\Progress;

use App\Models\PieceAssignment;
use App\Models\ProgressEvent;
use Illuminate\Support\Collection;

/**
 * Trend and plateau classification — a port of
 * `src/domains/progress/analytics.ts`.
 *
 * NOTHING HERE IS INVENTED. Every threshold is `DEFAULT_THRESHOLDS` and every
 * branch is `classifyProgress()` / `analyzePiece()` from the client contract,
 * transcribed. The contract also states the server owns this: "analytics,
 * plateau detection and recommendations are recomputed on the server over the
 * FULL history; the client must never be the authority."
 *
 * The ORDER OF CHECKS is significant and is preserved: regression is reported
 * ahead of a plateau because losing ground is the more urgent fact, and a
 * plateau is reported ahead of "stable" because it carries an action.
 */
final class Analytics
{
    /** `DEFAULT_THRESHOLDS`, verbatim from the contract. */
    public const array THRESHOLDS = [
        'plateauMinEvents' => 3,
        'plateauMinDays' => 10,
        'plateauMasteryDelta' => 2,
        'plateauTempoDelta' => 2,
        'improvingMasteryDelta' => 5,
        'regressionMasteryDelta' => 3,
        'minEventsForTrend' => 2,
        'recentWindowDays' => 30,
    ];

    /** Labels from `PROGRESS_STATUS_LABEL`. */
    public const array STATUS_LABEL = [
        'improving' => 'در حال پیشرفت',
        'stable' => 'پایدار',
        'slowing' => 'کند شده',
        'possible_plateau' => 'احتمال توقف پیشرفت',
        'regression' => 'پسرفت',
        'insufficient_data' => 'دادهٔ کافی نیست',
    ];

    /**
     * Classify one (student, piece) pair.
     *
     * @param  Collection<int, ProgressEvent>  $events  must already be in `sortByTime()` order
     * @return array{status: string, pieceId: string, assignmentId: string, evidence: array<string, mixed>}
     */
    public function classify(PieceAssignment $assignment, Collection $events): array
    {
        $sorted = $this->sortByTime($events);

        $newest = $sorted->last();
        $repeats = $this->trailingSameRangeCount($sorted);
        $stats = $this->analyzePiece($sorted);

        $evidence = [
            'events' => $sorted->count(),
            'windowDays' => $stats['spanDays'],
            'masteryChange' => $stats['masteryChange'],
            'tempoChange' => $stats['tempoChange'],
            'rangeRepeats' => $repeats,
            'rangeLabel' => $newest !== null ? $this->describeRange($newest) : null,
            'daysSinceLastEvent' => $stats['daysSinceLastEvent'],
        ];

        $wrap = fn (string $status): array => [
            'status' => $status,
            'pieceId' => $assignment->piece_id,
            'assignmentId' => $assignment->id,
            'evidence' => $evidence,
        ];

        if ($sorted->count() < self::THRESHOLDS['minEventsForTrend']) {
            return $wrap('insufficient_data');
        }

        $masteryChange = $stats['masteryChange'] ?? 0;

        // Losing ground outranks everything else.
        if ($masteryChange <= -self::THRESHOLDS['regressionMasteryDelta']) {
            return $wrap('regression');
        }

        // Plateau: same passage, repeatedly, over real elapsed time, with
        // neither mastery nor tempo moving. All four must hold.
        $spanOfRepeats = $repeats >= 2 && $newest !== null
            ? $this->daysBetween($sorted->values()[$sorted->count() - $repeats]->recorded_at, $newest->recorded_at)
            : 0;

        $tempoFlat = $stats['tempoChange'] === null
            || abs($stats['tempoChange']) <= self::THRESHOLDS['plateauTempoDelta'];
        $masteryFlat = abs($masteryChange) <= self::THRESHOLDS['plateauMasteryDelta'];

        if (
            $repeats >= self::THRESHOLDS['plateauMinEvents']
            && $spanOfRepeats >= self::THRESHOLDS['plateauMinDays']
            && $masteryFlat
            && $tempoFlat
        ) {
            return $wrap('possible_plateau');
        }

        if ($masteryChange >= self::THRESHOLDS['improvingMasteryDelta']) {
            return $wrap('improving');
        }

        // Moving forward, but under the "improving" bar over a long window.
        if ($masteryChange > self::THRESHOLDS['plateauMasteryDelta'] && $stats['spanDays'] > self::THRESHOLDS['recentWindowDays']) {
            return $wrap('slowing');
        }

        return $wrap('stable');
    }

    /**
     * Summary statistics for one (student, piece) — `analyzePiece()`.
     *
     * `null` is used — never 0 — where a value is genuinely unknown, so that
     * "no tempo recorded" and "tempo did not change" stay distinguishable.
     *
     * @param  Collection<int, ProgressEvent>  $events
     * @return array<string, mixed>
     */
    public function analyzePiece(Collection $events): array
    {
        $sorted = $this->sortByTime($events);

        if ($sorted->count() === 0) {
            return [
                'events' => 0,
                'spanDays' => 0,
                'masteryFirst' => null,
                'masteryLatest' => null,
                'masteryChange' => null,
                'masteryPerWeek' => null,
                'tempoFirst' => null,
                'tempoLatest' => null,
                'tempoChange' => null,
                'targetTempo' => null,
                'tempoTargetPercent' => null,
                'totalPracticeMinutes' => 0,
                'averagePracticeMinutes' => null,
                'sessionsPerWeek' => null,
                'distinctPracticeDays' => 0,
                'daysSinceLastEvent' => null,
            ];
        }

        $first = $sorted->first();
        $last = $sorted->last();
        $spanDays = $this->daysBetween($first->recorded_at, $last->recorded_at);

        $withTempo = $sorted->filter(fn (ProgressEvent $e): bool => $e->tempo_bpm !== null)->values();
        $tempoFirst = $withTempo->isNotEmpty() ? $withTempo->first()->tempo_bpm : null;
        $tempoLatest = $withTempo->isNotEmpty() ? $withTempo->last()->tempo_bpm : null;
        $tempoChange = $withTempo->count() >= 2 && $tempoFirst !== null && $tempoLatest !== null
            ? $tempoLatest - $tempoFirst
            : null;

        // Newest event that carries a target tempo.
        $targetTempo = $sorted->reverse()->first(fn (ProgressEvent $e): bool => $e->target_tempo_bpm !== null)?->target_tempo_bpm ?? null;

        $practiceEvents = $sorted->filter(fn (ProgressEvent $e): bool => $e->practice_minutes !== null)->values();
        $totalPracticeMinutes = (int) $practiceEvents->sum('practice_minutes');

        $distinctDays = $sorted->map(fn (ProgressEvent $e): string => $e->recorded_at->format('Y-m-d'))->unique()->count();
        $weeks = $spanDays / 7;

        $masteryChange = $last->mastery - $first->mastery;

        return [
            'events' => $sorted->count(),
            'spanDays' => $spanDays,
            'masteryFirst' => $first->mastery,
            'masteryLatest' => $last->mastery,
            'masteryChange' => $masteryChange,
            // Guard the zero-span case rather than dividing by it.
            'masteryPerWeek' => $sorted->count() >= 2 && $spanDays > 0
                ? $this->round1(($masteryChange / $spanDays) * 7)
                : null,
            'tempoFirst' => $tempoFirst,
            'tempoLatest' => $tempoLatest,
            'tempoChange' => $tempoChange,
            'targetTempo' => $targetTempo,
            'tempoTargetPercent' => $tempoLatest !== null && $targetTempo !== null && $targetTempo > 0
                ? min(100, (int) round(($tempoLatest / $targetTempo) * 100))
                : null,
            'totalPracticeMinutes' => $totalPracticeMinutes,
            'averagePracticeMinutes' => $practiceEvents->isNotEmpty()
                ? (int) round($totalPracticeMinutes / $practiceEvents->count())
                : null,
            'sessionsPerWeek' => $weeks >= 1 ? $this->round1($distinctDays / $weeks) : null,
            'distinctPracticeDays' => $distinctDays,
            'daysSinceLastEvent' => $this->daysBetween($last->recorded_at, now()),
        ];
    }

    /**
     * How many trailing events share the newest event's range. Repeating the
     * same passage is the strongest single signal of a plateau, because it
     * means the student has not moved on.
     *
     * @param  Collection<int, ProgressEvent>  $events
     */
    public function trailingSameRangeCount(Collection $events): int
    {
        $sorted = $this->sortByTime($events);
        if ($sorted->count() === 0) {
            return 0;
        }

        $values = $sorted->values();
        $newest = $values->last();
        $count = 0;

        for ($i = $values->count() - 1; $i >= 0; $i--) {
            if (! $this->sameRange($values[$i], $newest)) {
                break;
            }
            $count++;
        }

        return $count;
    }

    /** The contract's `describeRange()`: a label, else "start–end", else null. */
    public function describeRange(ProgressEvent $event): ?string
    {
        if (filled($event->range_label)) {
            return $event->range_label;
        }
        if ($event->range_start !== null && $event->range_end !== null) {
            return $event->range_start.'–'.$event->range_end;
        }
        if ($event->range_start !== null) {
            return (string) $event->range_start;
        }

        return null;
    }

    /**
     * Chronological order, oldest first. Stable for equal timestamps — this is
     * the contract's `sortByTime()`, with `id` as the tie-break, so the
     * snapshot and the chart can never disagree about which event is newest.
     *
     * @param  Collection<int, ProgressEvent>  $events
     * @return Collection<int, ProgressEvent>
     */
    public function sortByTime(Collection $events): Collection
    {
        return $events
            ->sortBy(fn (ProgressEvent $e): string => $e->recorded_at->getTimestamp().'|'.$e->id)
            ->values();
    }

    /** Two events cover the same range when both bounds and any label match. */
    private function sameRange(ProgressEvent $a, ProgressEvent $b): bool
    {
        return $a->range_start === $b->range_start
            && $a->range_end === $b->range_end
            && $a->range_label === $b->range_label;
    }

    /** Whole days between two instants; never negative — `daysBetween()`. */
    private function daysBetween(\DateTimeInterface|string $from, \DateTimeInterface|string $to): int
    {
        $fromTs = $from instanceof \DateTimeInterface ? $from->getTimestamp() : strtotime((string) $from);
        $toTs = $to instanceof \DateTimeInterface ? $to->getTimestamp() : strtotime((string) $to);

        if ($fromTs === false || $toTs === false) {
            return 0;
        }

        return max(0, (int) floor(($toTs - $fromTs) / 86_400));
    }

    private function round1(float $value): float
    {
        return round($value * 10) / 10;
    }
}
