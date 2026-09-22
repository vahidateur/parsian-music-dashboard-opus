/**
 * Derived answers about the academy's rules.
 *
 * PURE — no React, no storage, no repository. A rule that several domains read
 * has to have exactly one interpretation: "inside the bookable window" must mean
 * the same thing to the conflict engine, the timeline and the make-up dialog, and
 * the way to guarantee that is one function they all call.
 *
 * Every helper answers `null` (or `false`) when a value cannot be read, rather
 * than substituting a default of its own. A rule that is not configured is not
 * evaluated; it is never guessed.
 */
import { timeToMinutes, type OrganizationSettings, type WeekdayIndex } from "./types";

/** The bookable window in minutes since midnight; `null` when it cannot be read. */
export function workingWindow(settings: OrganizationSettings): { start: number; end: number } | null {
  const start = timeToMinutes(settings.workingDayStart);
  const end = timeToMinutes(settings.workingDayEnd);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

/** Whether a weekday is one the academy does not open. */
export function isClosedWeekday(settings: OrganizationSettings, weekday: number): boolean {
  return settings.closedWeekdays.includes(weekday as WeekdayIndex);
}

/**
 * Whether a session sits inside the bookable window.
 *
 * `null` means the question cannot be answered — an unparsable time, or a window
 * that was never configured — which callers must treat as "no opinion", not as
 * "allowed" or "forbidden".
 */
export function isInsideWorkingHours(
  settings: OrganizationSettings,
  startTime: string,
  endTime: string,
): boolean | null {
  const window = workingWindow(settings);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!window || start === null || end === null) return null;
  return start >= window.start && end <= window.end;
}

/** The rules the scheduling engine consumes, lifted out of the record. */
export function schedulingRules(settings: OrganizationSettings): {
  closedWeekdays: readonly number[];
  gapMinutes: number;
  workingHours: { start: number; end: number } | null;
} {
  return {
    closedWeekdays: settings.closedWeekdays,
    gapMinutes: settings.sessionGapMinutes,
    workingHours: workingWindow(settings),
  };
}

/* ------------------------------------------------------------------ */
/* The free-cancellation window                                          */
/* ------------------------------------------------------------------ */

export interface CancellationWindow {
  /** The academy's window, in minutes. `0` means no window is defined. */
  graceMinutes: number;
  /** Minutes from `now` until the session starts; negative once it has begun. */
  minutesUntilStart: number;
  /** Whether cancelling now is still inside the window. */
  inside: boolean;
  /** The deadline, in the academy's own local calendar terms. */
  deadlineDate: string;
  deadlineTime: string;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * Answers "is it still free to cancel this session?".
 *
 * PURE apart from the `Date` it is handed: the caller supplies the academy's one
 * clock, so this can be unit-tested at any instant and can never read a wall
 * clock of its own. `null` means the question cannot be answered — an unreadable
 * date or time — which callers must show as "unknown", not as "allowed".
 *
 * The deadline is returned as local calendar parts rather than an ISO instant
 * because the session's own date and time ARE local wall-clock values: converting
 * them through UTC would move the deadline by the operator's offset and tell a
 * family the wrong hour.
 */
export function cancellationWindow(
  settings: OrganizationSettings,
  sessionDate: string,
  startTime: string,
  now: Date,
): CancellationWindow | null {
  const start = Date.parse(`${sessionDate}T${startTime}:00`);
  if (Number.isNaN(start)) return null;

  const graceMinutes = Math.max(0, settings.cancellationGraceHours) * 60;
  const deadline = new Date(start - graceMinutes * 60_000);
  const untilStart = Math.round((start - now.getTime()) / 60_000);

  return {
    graceMinutes,
    minutesUntilStart: untilStart,
    inside: graceMinutes > 0 && now.getTime() <= start - graceMinutes * 60_000,
    deadlineDate: `${deadline.getFullYear()}-${twoDigits(deadline.getMonth() + 1)}-${twoDigits(deadline.getDate())}`,
    deadlineTime: `${twoDigits(deadline.getHours())}:${twoDigits(deadline.getMinutes())}`,
  };
}
