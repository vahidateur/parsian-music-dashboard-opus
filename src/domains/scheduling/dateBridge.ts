/**
 * Calendar-date and clock-time helpers for scheduling.
 *
 * PURE: no storage, no React, no repository, no network, and no ambient clock.
 * Every function that needs "today" takes it as an argument, so tests are
 * deterministic and the demo's frozen clock cannot leak in.
 *
 * WHY DATES ARE STRINGS, NOT `Date`
 *
 * A session happens on a calendar date in the academy's local time. A JS
 * `Date` is an instant in UTC, so `new Date("2026-09-15")` is midnight UTC and
 * shifts to the previous day for anyone west of Greenwich. Every arithmetic
 * helper below works on `YYYY-MM-DD` strings via UTC-noon anchors, which makes
 * the result timezone-independent and DST-proof.
 *
 * WEEKDAY INDEXING
 *
 * The product's `WEEKDAYS` array starts at Saturday (`شنبه`), matching the
 * Iranian week, while JavaScript's `getDay()` starts at Sunday. `weekdayIndex`
 * converts, so `class.days` values line up with the existing UI without either
 * side being rewritten.
 *
 * THE JALALI BRIDGE
 *
 * `Enrollment.startDate` is a Jalali DISPLAY string with Persian digits
 * (`"۱۴۰۴/۰۷/۰۱"`). Enrollment is a protected domain and is deliberately NOT
 * migrated in this phase, so `jalaliToIso` reads it where a comparison against
 * a session date is unavoidable. It is a read-only bridge, never a writer.
 */

/** `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:mm`, 24-hour. */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** True for a syntactically valid AND real calendar date (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trip through UTC: an overflowing day rolls into the next month.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isHhMm(value: string): boolean {
  return HHMM.test(value);
}

/* ------------------------------------------------------------------ */
/* Date arithmetic                                                     */
/* ------------------------------------------------------------------ */

/**
 * UTC-noon anchor for a calendar date.
 *
 * Noon rather than midnight so that any accidental ±hours shift elsewhere can
 * never tip the value into an adjacent day.
 */
function anchor(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0, 0);
}

function fromAnchor(ms: number): string {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds (or subtracts) whole days. Returns null for an invalid input date. */
export function addDays(iso: string, days: number): string | null {
  if (!isIsoDate(iso) || !Number.isInteger(days)) return null;
  return fromAnchor(anchor(iso) + days * MS_PER_DAY);
}

/** Whole days from `a` to `b`; negative when `b` precedes `a`. */
export function daysBetween(a: string, b: string): number | null {
  if (!isIsoDate(a) || !isIsoDate(b)) return null;
  return Math.round((anchor(b) - anchor(a)) / MS_PER_DAY);
}

/**
 * Weekday index in the product's Saturday-first convention:
 * 0 شنبه · 1 یکشنبه · 2 دوشنبه · 3 سه‌شنبه · 4 چهارشنبه · 5 پنجشنبه · 6 جمعه
 *
 * Matches `WEEKDAYS` in `@/data/records` and therefore `class.days`.
 */
export function weekdayIndex(iso: string): number | null {
  if (!isIsoDate(iso)) return null;
  // getUTCDay(): 0 = Sunday. Saturday-first shifts by one.
  return (new Date(anchor(iso)).getUTCDay() + 1) % 7;
}

/**
 * Every date in `[from, to]`, inclusive.
 *
 * Returns an empty array when the range is inverted, rather than throwing or
 * looping forever — callers validate the window separately and report a
 * proper error.
 */
export function datesInRange(from: string, to: string): string[] {
  if (!isIsoDate(from) || !isIsoDate(to)) return [];
  const span = daysBetween(from, to);
  if (span === null || span < 0) return [];

  const out: string[] = [];
  for (let i = 0; i <= span; i += 1) {
    const next = addDays(from, i);
    if (next) out.push(next);
  }
  return out;
}

/** Chronological comparator for ISO dates, usable directly in `.sort()`. */
export function compareIsoDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Clock times                                                         */
/* ------------------------------------------------------------------ */

/** Minutes since midnight, or null when malformed. */
export function toMinutes(hhmm: string): number | null {
  if (!isHhMm(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Formats minutes-since-midnight back to `HH:mm`. Rejects out-of-day values. */
export function fromMinutes(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) return null;
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Adds minutes to a wall-clock time.
 *
 * Returns null when the result would cross midnight. A session that spans two
 * calendar days is not something this model represents, and silently wrapping
 * to `00:30` would produce an end time before the start.
 */
export function addMinutes(hhmm: string, minutes: number): string | null {
  const base = toMinutes(hhmm);
  if (base === null || !Number.isInteger(minutes)) return null;
  return fromMinutes(base + minutes);
}

/** Duration in minutes, or null when either bound is malformed. */
export function durationMinutes(startTime: string, endTime: string): number | null {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return null;
  return end - start;
}

/* ------------------------------------------------------------------ */
/* Jalali bridge (read-only)                                           */
/* ------------------------------------------------------------------ */

/** Persian and Arabic-Indic digits → ASCII. Leaves other characters intact. */
export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660; // Persian : Arabic-Indic
    return String(code - base);
  });
}

/** Reads the Persian (Jalali) components of an instant, via the platform. */
const JALALI_PARTS = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function jalaliPartsOf(ms: number): { jy: number; jm: number; jd: number } {
  const parts = JALALI_PARTS.formatToParts(new Date(ms));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { jy: pick("year"), jm: pick("month"), jd: pick("day") };
}

/** Day-of-year offset for the first day of a Jalali month (months 1–6 have 31 days). */
function jalaliMonthOffset(jm: number): number {
  return jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;
}

/**
 * Converts a Jalali (Solar Hijri) date to ISO Gregorian.
 *
 * Accepts `۱۴۰۴/۰۷/۰۱`, `1404/07/01` and `1404-7-1`. Returns null for anything
 * unparseable OR for a date that does not exist, so callers fail closed — a
 * roster must never silently include a student because a date could not be
 * read.
 *
 * IMPLEMENTATION NOTE. This inverts the platform's own Persian calendar rather
 * than using the textbook 33-year-cycle arithmetic. That arithmetic was tried
 * first and disagreed with `Intl` by one day in roughly half of the years
 * sampled (1400–1410), because Iran's civil calendar is determined by the
 * astronomical vernal equinox rather than a fixed leap cycle. Since every
 * Jalali date the user ever SEES is rendered by `Intl`, the two must agree, so
 * `Intl` is the source of truth.
 *
 * The search is a bounded linear scan around a close estimate. An earlier
 * "jump by the estimated delta" version oscillated between two adjacent days
 * forever, because `Math.round(-0.4)` is `-0` and a naive `!== 0` guard then
 * forced a step in the wrong direction. A scan cannot oscillate.
 */
export function jalaliToIso(value: string): string | null {
  if (typeof value !== "string") return null;
  const parts = normalizeDigits(value.trim()).split(/[/\-.]/);
  if (parts.length !== 3) return null;

  const jy = Number(parts[0]);
  const jm = Number(parts[1]);
  const jd = Number(parts[2]);
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return null;
  if (jy < 1 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  // Months 7–12 never have 31 days.
  if (jm > 6 && jd > 30) return null;

  // Estimate: Jalali epoch is 622-03-22 Gregorian; the tropical year is
  // ~365.2422 days. Good to within a day or two, which the loop then corrects.
  const targetDayOfYear = jalaliMonthOffset(jm) + (jd - 1);
  const estimate = Date.UTC(622, 2, 22, 12) + Math.round(((jy - 1) * 365.2422 + targetDayOfYear) * MS_PER_DAY);

  // The estimate is accurate to within a couple of days; ±5 is generous.
  // Scanning outward keeps the nearest match, and terminates unconditionally.
  for (let offset = -5; offset <= 5; offset += 1) {
    const candidate = estimate + offset * MS_PER_DAY;
    const actual = jalaliPartsOf(candidate);
    if (actual.jy === jy && actual.jm === jm && actual.jd === jd) {
      return fromAnchor(candidate);
    }
  }

  // No match in range — the date does not exist (e.g. 30 Esfand in a common
  // year). Fail closed.
  return null;
}

/**
 * Formats an ISO date for display in Persian (Jalali).
 *
 * Uses the platform's own calendar support rather than inverting the
 * conversion above, so display always matches the rest of the product.
 */
export function isoToJalaliDisplay(
  iso: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  if (!isIsoDate(iso)) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { ...options, timeZone: "UTC" }).format(
    new Date(anchor(iso)),
  );
}
