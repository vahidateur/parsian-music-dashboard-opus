/**
 * Deterministic progress analytics.
 *
 * Pure functions over an already-loaded event list: no storage, no repository,
 * no React, no clock lookups except the `now` passed in. Everything here is
 * arithmetic a machine can do reliably, which is precisely the work that must
 * NOT be delegated to a language model. AI can later narrate these numbers; it
 * must never be the thing that computes them.
 *
 * EVERY DEFINITION IS STATED EXPLICITLY. An undocumented metric is worse than
 * no metric, because people act on it.
 *
 * All functions assume events for ONE (student, piece) pair unless stated, and
 * tolerate unsorted input by sorting defensively.
 */
import type { ProgressEvent } from "./types";

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/**
 * Thresholds for trend and plateau classification.
 *
 * Exposed as a parameter rather than hardcoded so an academy can tune
 * sensitivity, and so tests can pin exact boundaries.
 */
export interface AnalyticsThresholds {
  /** Events with the same range needed before a plateau is *considered*. */
  plateauMinEvents: number;
  /** Days that must have elapsed across those events. */
  plateauMinDays: number;
  /** Mastery change (points) at or below which progress counts as flat. */
  plateauMasteryDelta: number;
  /** Tempo change (BPM) at or below which tempo counts as flat. */
  plateauTempoDelta: number;
  /** Mastery gain (points) over the window to count as "improving". */
  improvingMasteryDelta: number;
  /** Mastery loss (points) over the window to count as "regressing". */
  regressionMasteryDelta: number;
  /** Minimum events before any trend other than `insufficient_data`. */
  minEventsForTrend: number;
  /** Window (days) used for "recent" trend calculations. */
  recentWindowDays: number;
}

export const DEFAULT_THRESHOLDS: AnalyticsThresholds = {
  plateauMinEvents: 3,
  plateauMinDays: 10,
  plateauMasteryDelta: 2,
  plateauTempoDelta: 2,
  improvingMasteryDelta: 5,
  regressionMasteryDelta: 3,
  minEventsForTrend: 2,
  recentWindowDays: 30,
};

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Chronological order, oldest first. Stable for equal timestamps. */
export function sortByTime(events: readonly ProgressEvent[]): ProgressEvent[] {
  return [...events].sort((a, b) => {
    const delta = Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

/** Whole days between two ISO timestamps; 0 when either is unparseable. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.floor((to - from) / MS_PER_DAY));
}

/** Two events cover the same range when both bounds and any label match. */
function sameRange(a: ProgressEvent, b: ProgressEvent): boolean {
  return a.rangeStart === b.rangeStart && a.rangeEnd === b.rangeEnd && a.rangeLabel === b.rangeLabel;
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

/**
 * Summary statistics for one (student, piece).
 *
 * `null` is used — never 0 — where a value is genuinely unknown, so that
 * "no tempo recorded" and "tempo did not change" stay distinguishable.
 */
export interface PieceAnalytics {
  events: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  /** Days from first to last event. */
  spanDays: number;
  masteryFirst: number | null;
  masteryLatest: number | null;
  /** Latest − first, in mastery points. */
  masteryChange: number | null;
  /**
   * LEARNING VELOCITY — mastery points gained per week.
   *
   *   (latest mastery − first mastery) / (span in days) × 7
   *
   * `null` when fewer than two events or when they share a day, because a
   * rate over zero elapsed time is not a number anyone should act on.
   */
  masteryPerWeek: number | null;
  tempoFirst: number | null;
  tempoLatest: number | null;
  /** Latest − first, in BPM. Null unless at least two events carry a tempo. */
  tempoChange: number | null;
  /** Latest target tempo, when recorded. */
  targetTempo: number | null;
  /** Latest tempo as a share of target, 0–100. Null when either is absent. */
  tempoTargetPercent: number | null;
  totalPracticeMinutes: number;
  /** Mean minutes per event that reported practice time. */
  averagePracticeMinutes: number | null;
  /**
   * PRACTICE CONSISTENCY — distinct days with an event, divided by weeks
   * elapsed. A value of 2 means the student practised on two distinct days a
   * week on average. Null when the span is under a day.
   */
  sessionsPerWeek: number | null;
  /** Distinct calendar days carrying at least one event. */
  distinctPracticeDays: number;
  /** Days since the most recent event, relative to `now`. */
  daysSinceLastEvent: number | null;
}

export function analyzePiece(
  events: readonly ProgressEvent[],
  now: Date = new Date(),
): PieceAnalytics {
  const sorted = sortByTime(events);
  const nowIso = now.toISOString();

  if (sorted.length === 0) {
    return {
      events: 0,
      firstRecordedAt: null,
      lastRecordedAt: null,
      spanDays: 0,
      masteryFirst: null,
      masteryLatest: null,
      masteryChange: null,
      masteryPerWeek: null,
      tempoFirst: null,
      tempoLatest: null,
      tempoChange: null,
      targetTempo: null,
      tempoTargetPercent: null,
      totalPracticeMinutes: 0,
      averagePracticeMinutes: null,
      sessionsPerWeek: null,
      distinctPracticeDays: 0,
      daysSinceLastEvent: null,
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanDays = daysBetween(first.recordedAt, last.recordedAt);

  const withTempo = sorted.filter((e) => typeof e.tempoBpm === "number");
  const tempoFirst = withTempo.length > 0 ? (withTempo[0].tempoBpm as number) : null;
  const tempoLatest = withTempo.length > 0 ? (withTempo[withTempo.length - 1].tempoBpm as number) : null;
  const tempoChange = withTempo.length >= 2 && tempoFirst !== null && tempoLatest !== null ? tempoLatest - tempoFirst : null;

  const targetTempo =
    [...sorted].reverse().find((e) => typeof e.targetTempoBpm === "number")?.targetTempoBpm ?? null;

  const practiceEvents = sorted.filter((e) => typeof e.practiceMinutes === "number");
  const totalPracticeMinutes = practiceEvents.reduce((sum, e) => sum + (e.practiceMinutes ?? 0), 0);

  const dayKeys = new Set(sorted.map((e) => e.recordedAt.slice(0, 10)));
  const weeks = spanDays / 7;

  const masteryChange = last.mastery - first.mastery;

  return {
    events: sorted.length,
    firstRecordedAt: first.recordedAt,
    lastRecordedAt: last.recordedAt,
    spanDays,
    masteryFirst: first.mastery,
    masteryLatest: last.mastery,
    masteryChange,
    // Guard the zero-span case rather than dividing by it.
    masteryPerWeek: sorted.length >= 2 && spanDays > 0 ? round1((masteryChange / spanDays) * 7) : null,
    tempoFirst,
    tempoLatest,
    tempoChange,
    targetTempo,
    tempoTargetPercent:
      tempoLatest !== null && targetTempo !== null && targetTempo > 0
        ? Math.min(100, Math.round((tempoLatest / targetTempo) * 100))
        : null,
    totalPracticeMinutes,
    averagePracticeMinutes:
      practiceEvents.length > 0 ? Math.round(totalPracticeMinutes / practiceEvents.length) : null,
    sessionsPerWeek: weeks >= 1 ? round1(dayKeys.size / weeks) : null,
    distinctPracticeDays: dayKeys.size,
    daysSinceLastEvent: daysBetween(last.recordedAt, nowIso),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Trend + plateau                                                     */
/* ------------------------------------------------------------------ */

/**
 * Classification of recent progress.
 *
 * `possible_plateau` is deliberately hedged. The data can show that nothing
 * measurable changed; it cannot show *why*, and a student may be consolidating
 * rather than stuck. Overstating that would be a false claim (§37).
 */
export type ProgressStatus =
  | "improving"
  | "stable"
  | "slowing"
  | "possible_plateau"
  | "regression"
  | "insufficient_data";

export const PROGRESS_STATUS_LABEL: Record<ProgressStatus, string> = {
  improving: "در حال پیشرفت",
  stable: "پایدار",
  slowing: "کند شده",
  possible_plateau: "احتمال توقف پیشرفت",
  regression: "پسرفت",
  insufficient_data: "دادهٔ کافی نیست",
};

/** A classification plus the numbers that produced it. */
export interface ProgressInsight {
  status: ProgressStatus;
  pieceId: string;
  assignmentId: string;
  /** Machine-readable evidence; the UI renders it, AI may narrate it. */
  evidence: {
    events: number;
    windowDays: number;
    masteryChange: number | null;
    tempoChange: number | null;
    rangeRepeats: number;
    rangeLabel: string | null;
    daysSinceLastEvent: number | null;
  };
}

/**
 * Counts how many trailing events share the newest event's range.
 *
 * Repeating the same passage is the strongest single signal of a plateau,
 * because it means the student has not moved on.
 */
export function trailingSameRangeCount(events: readonly ProgressEvent[]): number {
  const sorted = sortByTime(events);
  if (sorted.length === 0) return 0;
  const newest = sorted[sorted.length - 1];
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (!sameRange(sorted[i], newest)) break;
    count += 1;
  }
  return count;
}

/**
 * Classifies progress for one (student, piece).
 *
 * Order of checks is significant — regression is reported ahead of a plateau
 * because losing ground is the more urgent fact, and a plateau is reported
 * ahead of "stable" because it carries an action.
 */
export function classifyProgress(
  assignmentId: string,
  pieceId: string,
  events: readonly ProgressEvent[],
  thresholds: AnalyticsThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): ProgressInsight {
  const sorted = sortByTime(events);
  const stats = analyzePiece(sorted, now);
  const repeats = trailingSameRangeCount(sorted);
  const newest = sorted[sorted.length - 1];

  const evidence: ProgressInsight["evidence"] = {
    events: sorted.length,
    windowDays: stats.spanDays,
    masteryChange: stats.masteryChange,
    tempoChange: stats.tempoChange,
    rangeRepeats: repeats,
    rangeLabel: newest ? describeRange(newest) : null,
    daysSinceLastEvent: stats.daysSinceLastEvent,
  };

  if (sorted.length < thresholds.minEventsForTrend) {
    return { status: "insufficient_data", pieceId, assignmentId, evidence };
  }

  const masteryChange = stats.masteryChange ?? 0;

  // Losing ground outranks everything else.
  if (masteryChange <= -thresholds.regressionMasteryDelta) {
    return { status: "regression", pieceId, assignmentId, evidence };
  }

  // Plateau: same passage, repeatedly, over real elapsed time, with neither
  // mastery nor tempo moving. All four must hold.
  const spanOfRepeats = repeats >= 2 ? daysBetween(sorted[sorted.length - repeats].recordedAt, newest.recordedAt) : 0;
  const tempoFlat = stats.tempoChange === null || Math.abs(stats.tempoChange) <= thresholds.plateauTempoDelta;
  const masteryFlat = Math.abs(masteryChange) <= thresholds.plateauMasteryDelta;

  if (
    repeats >= thresholds.plateauMinEvents &&
    spanOfRepeats >= thresholds.plateauMinDays &&
    masteryFlat &&
    tempoFlat
  ) {
    return { status: "possible_plateau", pieceId, assignmentId, evidence };
  }

  if (masteryChange >= thresholds.improvingMasteryDelta) {
    return { status: "improving", pieceId, assignmentId, evidence };
  }

  // Moving forward, but under the "improving" bar over a long window.
  if (masteryChange > thresholds.plateauMasteryDelta && stats.spanDays > thresholds.recentWindowDays) {
    return { status: "slowing", pieceId, assignmentId, evidence };
  }

  return { status: "stable", pieceId, assignmentId, evidence };
}

/** Human-readable range, e.g. "۳۷–۴۲" or a free-form label. */
export function describeRange(event: ProgressEvent): string | null {
  if (event.rangeLabel) return event.rangeLabel;
  if (typeof event.rangeStart === "number" && typeof event.rangeEnd === "number") {
    return `${event.rangeStart}–${event.rangeEnd}`;
  }
  if (typeof event.rangeStart === "number") return String(event.rangeStart);
  return null;
}

/* ------------------------------------------------------------------ */
/* Placement analytics                                                 */
/* ------------------------------------------------------------------ */

/** Level-progression pace, derived from placement history. */
export interface PlacementAnalytics {
  /** Days the student has held the current level. */
  daysAtCurrentLevel: number;
  /** Number of recorded level changes. */
  levelChanges: number;
  /** Mean days between consecutive level changes; null with fewer than two. */
  averageDaysPerLevel: number | null;
}

export function analyzePlacementHistory(
  changes: readonly { levelId: string; changedAt: string }[],
  currentSince: string,
  now: Date = new Date(),
): PlacementAnalytics {
  const nowIso = now.toISOString();
  const ordered = [...changes].sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt));

  let averageDaysPerLevel: number | null = null;
  if (ordered.length >= 2) {
    let total = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      total += daysBetween(ordered[i - 1].changedAt, ordered[i].changedAt);
    }
    averageDaysPerLevel = Math.round(total / (ordered.length - 1));
  }

  return {
    daysAtCurrentLevel: daysBetween(currentSince, nowIso),
    levelChanges: ordered.length,
    averageDaysPerLevel,
  };
}
