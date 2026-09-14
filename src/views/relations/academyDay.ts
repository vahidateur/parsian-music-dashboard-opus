/**
 * The academy's calendar day, read from the one clock.
 *
 * WHY THIS MODULE EXISTS
 *
 * The M7 relation surfaces (Students, Teachers, Classes) must stop deriving their
 * relations from `@/data/records`. Two of those relations need the academy's own
 * day, and nothing shared produced it:
 *
 *   - a session read is only honest with a bounded window, and the window's ends
 *     are calendar dates (`from` / `to` on `SessionListParams`);
 *   - a weekday column or a "today" marker needs the Saturday-first index the rest
 *     of the product already uses (`class.days`, the seeded recurrence, `WEEKDAYS`).
 *
 * `academyNow()` in `domains/shared/clock` is the single source of "now": frozen
 * at 10:47 in demo mode, the real wall clock in production. Everything here only
 * REFORMATS that value. There is no `new Date()`, no `Date.now()`, no fixture
 * date and no date library in this file — and no second clock.
 *
 * THE WEEKDAY CONVENTION IS THE DOMAIN'S, NOT OURS
 *
 * Saturday-first, `0 = شنبه … 6 = جمعه`, is the scheduling domain's own
 * convention: `weekdayIndex` in `domains/scheduling/dateBridge` documents it and
 * `class.days` is written in it. `academyWeekdayIndex` implements the same
 * mapping from a `Date` rather than from an ISO string, and
 * `views/__tests__/relationsPlumbing.test.ts` cross-checks the two over a full
 * week and across month/year boundaries, so they cannot drift apart in silence.
 *
 * ONE CONVERSION, NOT THREE
 *
 * `views/Scheduling.tsx` and `views/Attendance.tsx` each carry a private
 * `isoFromAcademyDate`. They are not M7 surfaces and this checkpoint leaves them
 * alone; `academyIsoDate` exists so the M7 surfaces do not add a third copy of
 * the same four lines.
 *
 * A CALLER READS THIS ONCE PER RENDER, like the M4/M5 views do: a screen that
 * stays open across midnight keeps the day it rendered with. A day-rollover tick
 * is a clock feature nobody has asked for, and inventing one here would be a
 * second source of time.
 */
import { academyNow } from "@/domains/shared/clock";

/**
 * The academy clock's own calendar date as `YYYY-MM-DD`.
 *
 * Local getters, not UTC: the academy's day is the day on its own wall clock, and
 * that is also what a session's `from` / `to` window is compared against.
 * `date` defaults to `academyNow()` so a caller cannot reach for the wall clock
 * to fill it in by accident.
 */
export function academyIsoDate(date: Date = academyNow()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The academy day's weekday index in the product's Saturday-first convention:
 * `0 = شنبه … 6 = جمعه`.
 *
 * `Date.getDay()` is Sunday-first (`0 = Sunday`), so the shift is `+ 1 mod 7` —
 * the same arithmetic `weekdayIndex` performs on an ISO date, cross-checked by
 * test rather than by comment.
 */
export function academyWeekdayIndex(date: Date = academyNow()): number {
  return (date.getDay() + 1) % 7;
}
