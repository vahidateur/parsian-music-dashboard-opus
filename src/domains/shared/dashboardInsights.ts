/**
 * Dashboard insights — every figure the insight panels show, derived from stored
 * records.
 *
 * WHY THIS MODULE EXISTS (M9 · H4 · DECISIONS §14/§15)
 *
 * `Signals`, `Intelligence`, `AttentionAndFlow` and `BusinessIntelligence` used
 * to render constants from `src/data/academy.ts` and `src/data/records.ts`: a
 * 1,248-student roster, a 92٪ attendance rate, a retention increase, a Tuesday
 * piano-occupancy figure, a 125.4-million revenue month. None of it came from a
 * record — an EMPTY academy printed the same numbers as the demo, which is what
 * OPEN_ITEMS **H4** calls "presenting fabricated text as measurement".
 *
 * Every function here is pure and takes the rows it needs, so each figure can be
 * traced back to the records that produced it and each rule can be argued with.
 * The panels receive the results as props; the reads happen once, in
 * `useDashboardInsights` (one read set ⇒ one consistent snapshot per render).
 *
 * THE RULES THIS MODULE OBEYS
 *
 *  - A ratio with no denominator is `null`, never `0` (`lib/stats.ts`), and the
 *    formatter renders it as `NO_DATA` («—»). No `|| 0`, no `|| []`, no
 *    fabricated fallback.
 *  - A KPI whose records carry no history gets `series: null`: the panel draws
 *    **no trend** rather than a flat line it cannot support. That is also what
 *    makes I9's empty-series guard reachable in the live UI, not only in EMPTY.
 *  - Sentences are computed, not written: every count, ratio and name inside a
 *    rendered sentence comes from the same rows as the figure beside it.
 *  - A figure is only taken from a field the product already renders as that
 *    measure: `student.balance > 0` is money the academy is owed (`Students.tsx`
 *    prints it as «مانده»), `student.since` is a join month, `student.attendance`
 *    is per-student and only meaningful with `sessionsTotal > 0` (again
 *    `Students.tsx`). Nothing else is reinterpreted.
 *  - Where the authoritative source does not exist in this phase — collected
 *    revenue needs the Finance/Reports domains, which `docs/domains/finance/README.md` and `docs/domains/reports/README.md`
 *    record as *planned, not implemented* (DECISIONS D6) — **no figure is shown
 *    at all**. The revenue chart is gone; the money chart shows receivables,
 *    which the student records really carry.
 *
 * WHAT THE NUMBERS ARE, EXACTLY
 *
 *   roster curve      cumulative count of students, bucketed by the Jalali month
 *                     recorded in `student.since`
 *   weekly series     rolling 7-day windows ending on the academy day
 *   occupancy         seats taken / seats offered across stored classes, per room
 *                     and per weekday, from `class.days`
 *   instrument mix    count of students per stored `student.instrument`
 *   receivables       sum of `student.balance` where it is positive
 *
 * FORMULA NOTE. The weekly series is built from one bounded session read (see
 * `useDashboardInsights`), so every count describes the rows that were read —
 * the same disclosure `useAcademyMetrics` makes for its 500-record attendance
 * sample.
 */
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/domains/scheduling/weekdays";
import { studentStatusLabel } from "@/domains/students/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Student } from "@/domains/students/types";
import type { AttentionItem, Signal, Target } from "@/lib/viewContracts";
import type { ClassSession, ClassSessionStatus } from "@/domains/scheduling/types";
import { faNum, faPercent, faToman, NO_DATA } from "@/lib/format";
import { meanOf, ratioPct, topBy } from "@/lib/stats";
import { instrumentName } from "@/domains/instruments/catalog";
import type { Room } from "@/domains/rooms/types";
import type { Session } from "@/domains/scheduling/types";
import type { AcademyMetrics } from "./useAcademyMetrics";

/* ------------------------------------------------------------------ */
/* Shapes the panels render                                            */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface FlowRow {
  /** The row `TimelineEvent` renders — built from stored records, not a fixture. */
  session: ClassSession;
  status: ClassSessionStatus;
}

export interface FlowSummary {
  /** Sessions stored on the academy day. */
  total: number;
  /** Those still to start, cancelled ones excluded. */
  remaining: number;
  cancelled: number;
  /** Rows the panel shows; the rest are accounted for in the footer. */
  shown: number;
}

export interface OccupancyRow {
  label: string;
  /** `null` when the group offers no seats to fill. */
  pct: number | null;
}

export interface WeekdayOccupancyRow extends OccupancyRow {
  full: string;
  /** Weekday index in the product's Saturday-first convention. */
  index: number;
}

export interface OccupancyModel {
  overallPct: number | null;
  takenSeats: number;
  totalSeats: number;
  /** Classes with at least one seat still free. */
  seatsFree: number;
  classes: number;
  rooms: OccupancyRow[];
  week: WeekdayOccupancyRow[];
  peakDay: WeekdayOccupancyRow | null;
  quietestDay: WeekdayOccupancyRow | null;
}

export interface InstrumentRow {
  id: string;
  label: string;
  count: number;
  sharePct: number | null;
}

export interface ReceivableRow {
  id: string;
  label: string;
  amount: number;
}

export interface ReceivablesModel {
  /** Students whose stored balance is above zero. */
  owing: number;
  students: number;
  total: number;
  rows: ReceivableRow[];
  top: ReceivableRow | null;
}

export interface RosterModel {
  points: SeriesPoint[];
  /** Students placed on the month axis. */
  placed: number;
}

export interface DashboardCounts {
  students: number;
  classes: number;
  rooms: number;
  teachers: number;
  sessions: number;
  /** Total stored rows the panels read. Zero ⇒ this academy has no records yet. */
  records: number;
}

export interface InsightInput {
  metrics: AcademyMetrics;
  students: readonly Student[];
  classes: readonly AcademyClass[];
  rooms: readonly Room[];
  teachers: readonly { id: string; name: string }[];
  sessions: readonly Session[];
  /** The academy day, `YYYY-MM-DD`. */
  todayIso: string;
  /** Minutes since midnight, from the academy clock. */
  nowMinutes: number;
}

/* ------------------------------------------------------------------ */
/* Month axis over `Student.since`                                     */
/* ------------------------------------------------------------------ */

const FA_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Short labels for the month axis, so the chart reads like a calendar. */
const FA_MONTHS_SHORT = ["فرو", "ارد", "خرد", "تیر", "مرد", "شهر", "مهر", "آبا", "آذر", "دی", "بهم", "اسف"] as const;

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const LATIN_DIGITS = "0123456789";

/** Persian digits → Latin, so a Jalali year can be read as a number. */
function latinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (digit) => LATIN_DIGITS[FA_DIGITS.indexOf(digit)]);
}

/**
 * Where a `student.since` value sits on the month axis.
 *
 *   «مهر ۱۴۰۳»    → that month, as `year * 12 + monthIndex`, which orders Jalali
 *                   months the way the calendar does.
 *   anything else → the CURRENT bucket, labelled «اکنون».
 *
 * The second rule is deliberate and is the only defensible one for a running
 * total: the product stores relative values too («این هفته»), and a value this
 * module cannot order is certainly not *earlier* than the newest recorded month,
 * because `since` is a join date. Dropping such rows instead would make the curve
 * disagree with the roster it is meant to show; counting them in the current
 * month keeps the curve's last point equal to the number of students.
 */
export function sinceBucket(since: string): { key: number; label: string } {
  const text = since.trim();
  const monthIndex = FA_MONTHS.findIndex((month) => text.includes(month));
  const yearMatch = latinDigits(text).match(/\d{4}/);
  if (monthIndex >= 0 && yearMatch) {
    return { key: Number(yearMatch[0]) * 12 + monthIndex, label: FA_MONTHS_SHORT[monthIndex] };
  }
  return { key: Number.MAX_SAFE_INTEGER, label: "اکنون" };
}

/**
 * Running total of `students` (optionally filtered) at each of the newest
 * `window` months present in the records.
 *
 * Cumulative, not per-month: the question the chart answers is "how many
 * students does the academy hold", and only a running total can answer it. The
 * buckets come from the records themselves — no window is invented for months
 * nothing is stored about.
 */
export function rosterSeries(
  students: readonly Student[],
  window = 12,
  qualify: (student: Student) => boolean = () => true,
): RosterModel {
  const buckets = new Map<number, { label: string; count: number }>();

  for (const student of students) {
    if (!qualify(student)) continue;
    const bucket = sinceBucket(student.since);
    const existing = buckets.get(bucket.key);
    if (existing) existing.count += 1;
    else buckets.set(bucket.key, { label: bucket.label, count: 1 });
  }

  const ordered = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  let running = 0;
  const all: SeriesPoint[] = ordered.map(([, bucket]) => {
    running += bucket.count;
    return { label: bucket.label, value: running };
  });

  const points = all.slice(-window);
  return { points, placed: points.length > 0 ? points[points.length - 1].value : 0 };
}

/* ------------------------------------------------------------------ */
/* Rolling 7-day windows                                               */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → whole days since the epoch, or `null` if unreadable. */
export function isoDayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(stamp) ? Math.round(stamp / DAY_MS) : null;
}

/** Whole days since the epoch → `YYYY-MM-DD`. Inverse of `isoDayNumber`. */
export function isoFromDayNumber(day: number): string {
  const date = new Date(day * DAY_MS);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${date.getUTCDate()}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${dayOfMonth}`;
}

/**
 * Counts per rolling 7-day window, oldest first, the newest window ending on
 * `referenceIso`. Window `k` covers `[reference - 7k - 6, reference - 7k]`, so
 * windows do not overlap and "the last week" is exactly the newest entry.
 *
 * Sessions dated after the reference day land in no window: a schedule holds
 * future occurrences, and counting them as activity would report a lesson that
 * has not happened yet.
 */
export function weeklyCounts<T>(
  rows: readonly T[],
  dateOf: (row: T) => string,
  referenceIso: string,
  weeks = 13,
  count: (row: T) => boolean = () => true,
): number[] {
  const reference = isoDayNumber(referenceIso);
  if (reference === null) return [];
  const out = new Array<number>(weeks).fill(0);
  for (const row of rows) {
    if (!count(row)) continue;
    const day = isoDayNumber(dateOf(row));
    if (day === null) continue;
    const age = reference - day;
    if (age < 0) continue;
    const windowIndex = Math.floor(age / 7);
    if (windowIndex >= weeks) continue;
    out[weeks - 1 - windowIndex] += 1;
  }
  return out;
}

/** Percentage change between the newest value and the one before it, or `null`. */
export function changePct(series: readonly number[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const previous = series[series.length - 2];
  if (!(previous > 0)) return null;
  return Number((((last - previous) / previous) * 100).toFixed(1));
}

/** `series`, or `null` when there is no history to draw. */
function seriesOrNull(series: readonly number[]): number[] | null {
  return series.length > 0 ? [...series] : null;
}

/** Sessions stored inside the newest rolling week, oldest first. */
function newestWeek(sessions: readonly Session[], todayIso: string): Session[] {
  const reference = isoDayNumber(todayIso);
  if (reference === null) return [];
  return sessions.filter((session) => {
    const day = isoDayNumber(session.date);
    return day !== null && day <= reference && reference - day < 7;
  });
}

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

/**
 * The four signal tiles, each from one stored measure.
 *
 * - «هنرجویان نیازمند توجه» — students whose stored status is `at-risk`, with
 *   their own mean attendance as context.
 * - «نرخ حضور ثبت‌شده» — mean of `student.attendance` over rows that carry a
 *   session total, which is the guard `Students.tsx` already applies per row.
 *   Deliberately NOT `metrics.attendanceRatePct`: that figure is a capped
 *   500-record sample and P1 forbids presenting it as an academy rate.
 * - «جلسات ۷ روز گذشته» — sessions stored in the newest rolling week, with the
 *   previous twelve weeks behind it.
 * - «لغوهای ۳۰ روز گذشته» — cancelled sessions in the newest four windows,
 *   against the sessions scheduled in the same windows.
 */
export function deriveSignals({ students, sessions, todayIso }: InsightInput): Signal[] {
  const atRisk = students.filter((student) => student.status === "at-risk");
  const atRiskSeries = rosterSeries(students, 12, (student) => student.status === "at-risk").points.map(
    (point) => point.value,
  );
  const atRiskMean = meanOf(
    atRisk.filter((student) => student.sessionsTotal > 0),
    (student) => student.attendance,
  );

  const rated = students.filter((student) => student.sessionsTotal > 0);
  const meanAttendance = meanOf(rated, (student) => student.attendance);

  const weekly = weeklyCounts(sessions, (session) => session.date, todayIso, 13);
  const recentWeek = weekly.length > 0 ? weekly[weekly.length - 1] : null;
  const recentWeekClasses = new Set(
    newestWeek(sessions, todayIso)
      .filter((session) => session.status !== "cancelled")
      .map((session) => session.classId),
  ).size;

  const cancelledWeekly = weeklyCounts(
    sessions,
    (session) => session.date,
    todayIso,
    13,
    (session) => session.status === "cancelled",
  );
  const cancelledFourWeeks = cancelledWeekly.slice(-4).reduce((sum, value) => sum + value, 0);
  const scheduledFourWeeks = weekly.slice(-4).reduce((sum, value) => sum + value, 0);

  return [
    {
      id: "at-risk",
      label: "هنرجویان نیازمند توجه",
      value: faNum(atRisk.length),
      delta: changePct(atRiskSeries),
      deltaLabel: "نسبت به ماه پیش",
      context:
        atRiskMean === null
          ? "نرخ حضوری برای این هنرجویان ثبت نشده"
          : `میانگین نرخ حضور ثبت‌شده: ${faPercent(atRiskMean)}`,
      tone: atRisk.length > 0 ? "warn" : "neutral",
      series: seriesOrNull(atRiskSeries),
      kind: "line",
      target: { view: "students", filter: "at-risk" },
    },
    {
      id: "attendance",
      label: "نرخ حضور ثبت‌شده",
      value: faPercent(meanAttendance),
      delta: null,
      context:
        rated.length > 0
          ? `میانگین ${faNum(rated.length)} رکورد هنرجو با جلسهٔ ثبت‌شده`
          : "هیچ رکورد هنرجویی نرخ حضور ندارد",
      tone: meanAttendance === null ? "neutral" : "ok",
      // Attendance is one stored value per student, not a history: no trend is
      // drawn, and the tile says nothing it cannot show.
      series: null,
      kind: "line",
      target: { view: "attendance" },
    },
    {
      id: "sessions",
      label: "جلسات ۷ روز گذشته",
      value: faNum(recentWeek ?? 0),
      delta: changePct(weekly),
      deltaLabel: "نسبت به هفتهٔ پیش از آن",
      context:
        recentWeek === null || recentWeek === 0
          ? "در این بازه جلسه‌ای در تقویم ثبت نشده"
          : `از ${faNum(recentWeekClasses)} کلاس متفاوت در همین بازه`,
      tone: recentWeek ? "ok" : "neutral",
      series: seriesOrNull(weekly),
      kind: "bars",
      target: { view: "schedule" },
    },
    {
      id: "cancellations",
      label: "لغوهای ۳۰ روز گذشته",
      value: faNum(cancelledFourWeeks),
      delta: changePct(cancelledWeekly),
      deltaLabel: "نسبت به ماه پیش",
      context:
        scheduledFourWeeks > 0
          ? `${faNum(cancelledFourWeeks)} لغو از ${faNum(scheduledFourWeeks)} جلسهٔ همین بازه (${faPercent(
              ratioPct(cancelledFourWeeks, scheduledFourWeeks),
            )})`
          : "در این بازه جلسه‌ای زمان‌بندی نشده",
      tone: cancelledFourWeeks > 0 ? "warn" : "neutral",
      series: seriesOrNull(cancelledWeekly),
      kind: "line",
      target: { view: "schedule", filter: "cancelled" },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Needs attention                                                     */
/* ------------------------------------------------------------------ */

/**
 * Alerts, each one a rule over stored rows. A rule that finds nothing stays
 * silent — the panel's empty state then says so in its own words, instead of
 * inventing an item to fill the space.
 */
export function deriveAttentionItems({
  metrics,
  students,
  classes,
  sessions,
  todayIso,
}: InsightInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  const overdue = students.filter((student) => student.payment === "overdue");
  if (overdue.length > 0) {
    const owing = overdue.reduce((sum, student) => sum + Math.max(student.balance, 0), 0);
    items.push({
      id: "overdue-payments",
      severity: "critical",
      title: `${faNum(overdue.length)} هنرجو با پرداخت سررسیدگذشته`,
      context:
        owing > 0
          ? `${faToman(owing, true)} ماندهٔ ثبت‌شده روی همین رکوردها`
          : `${faPercent(ratioPct(overdue.length, students.length))} از هنرجویان ثبت‌شده`,
      action: "پیگیری پرداخت",
      target: { view: "students" },
    });
  }

  const waitlisted = classes.filter((klass) => klass.waitlist > 0);
  if (waitlisted.length > 0) {
    const seats = waitlisted.reduce((sum, klass) => sum + klass.waitlist, 0);
    const biggest = topBy(waitlisted, (klass) => klass.waitlist)!;
    items.push({
      id: "class-waitlists",
      severity: "warning",
      title: `${faNum(waitlisted.length)} کلاس با لیست انتظار`,
      context: `مجموع ${faNum(seats)} نفر در انتظار · بیشترین: ${biggest.title}`,
      action: "بررسی ظرفیت",
      target: { view: "classes" },
    });
  }

  const atRisk = students.filter((student) => student.status === "at-risk");
  if (atRisk.length > 0) {
    const mean = meanOf(
      atRisk.filter((student) => student.sessionsTotal > 0),
      (student) => student.attendance,
    );
    items.push({
      id: "at-risk-students",
      severity: "warning",
      title: `${faNum(atRisk.length)} هنرجو در وضعیت «${studentStatusLabel["at-risk"]}»`,
      context:
        mean === null
          ? `${faPercent(ratioPct(atRisk.length, students.length))} از هنرجویان ثبت‌شده`
          : `میانگین نرخ حضور ثبت‌شده: ${faPercent(mean)}`,
      action: "مرور پرونده‌ها",
      target: { view: "students", filter: "at-risk" },
    });
  }

  const reference = isoDayNumber(todayIso);
  if (reference !== null) {
    const inWindow = sessions.filter((session) => {
      const day = isoDayNumber(session.date);
      return day !== null && day <= reference && reference - day < 7;
    });
    const cancelled = inWindow.filter((session) => session.status === "cancelled");
    if (cancelled.length > 0) {
      items.push({
        id: "cancelled-week",
        severity: "info",
        title: `${faNum(cancelled.length)} جلسهٔ لغوشده در ۷ روز گذشته`,
        context: `از ${faNum(inWindow.length)} جلسهٔ ثبت‌شده در همین بازه · ${faNum(metrics.classes)} کلاس ثبت‌شده`,
        action: "مشاهدهٔ تقویم",
        target: { view: "schedule", filter: "cancelled" },
      });
    }
  }

  const order: Record<AttentionItem["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ------------------------------------------------------------------ */
/* Today's flow                                                        */
/* ------------------------------------------------------------------ */

function minutesOf(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Two stored sessions sharing a room and an interval.
 *
 * Half-open, like the scheduling domain: 17:00–18:00 and 18:00–19:00 do not
 * clash, and a cancelled session clashes with nothing.
 */
function clashes(a: Session, b: Session): boolean {
  if (a.id === b.id || a.status === "cancelled" || b.status === "cancelled") return false;
  if (a.roomId !== b.roomId) return false;
  const aStart = minutesOf(a.startTime);
  const aEnd = minutesOf(a.endTime);
  const bStart = minutesOf(b.startTime);
  const bEnd = minutesOf(b.endTime);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Clashing session PAIRS within the given sessions of a single day — pairs
 * share a room and overlap in time (the `clashes` rule above). Exported so the
 * day pulse (Hero/TopBar) counts conflicts with exactly the rule the flow rows
 * use; a second conflict definition would be a second read path (D14).
 */
export function conflictPairs(sessions: readonly Session[]): { a: Session; b: Session }[] {
  const pairs: { a: Session; b: Session }[] = [];
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      if (clashes(sessions[i], sessions[j])) pairs.push({ a: sessions[i], b: sessions[j] });
    }
  }
  return pairs;
}

/**
 * Rows for `TimelineEvent`, built from the stored session and the class, room and
 * teacher it points at.
 *
 * Status is derived, never read from a fixture flag: `cancelled` → cancelled,
 * `completed` → done, an in-progress interval → live, the first one still to
 * start → next, and a session sharing a room and an interval with another →
 * attention. A label that cannot be resolved renders `NO_DATA` rather than a
 * guess.
 */
export function deriveFlowRows(
  sessions: readonly Session[],
  todayIso: string,
  nowMinutes: number,
  lookup: {
    classes: ReadonlyMap<string, AcademyClass>;
    rooms: ReadonlyMap<string, Room>;
    teachers: ReadonlyMap<string, string>;
  },
  limit = 6,
): { rows: FlowRow[]; summary: FlowSummary } {
  const today = sessions
    .filter((session) => session.date === todayIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const firstUpcoming = today.find(
    (session) => session.status === "scheduled" && (minutesOf(session.startTime) ?? 0) > nowMinutes,
  )?.id;

  const rows: FlowRow[] = today.map((session) => {
    const klass = lookup.classes.get(session.classId);
    const start = minutesOf(session.startTime);
    const end = minutesOf(session.endTime);

    let status: ClassSessionStatus;
    if (session.status === "cancelled") status = "cancelled";
    else if (session.status === "completed") status = "done";
    else if (start !== null && end !== null && start <= nowMinutes && nowMinutes < end) status = "live";
    else if (session.id === firstUpcoming) status = "next";
    else status = "scheduled";
    if (status !== "cancelled" && today.some((other) => clashes(session, other))) status = "attention";

    return {
      status,
      session: {
        id: session.id,
        title: klass?.title ?? NO_DATA,
        instrument: klass?.instrument ?? NO_DATA,
        room: lookup.rooms.get(session.roomId)?.name ?? NO_DATA,
        teacher: lookup.teachers.get(session.teacherId) ?? NO_DATA,
        start: session.startTime,
        end: session.endTime,
        cancelled: session.status === "cancelled",
        conflict: status === "attention",
        students: klass?.enrolled,
        capacity: klass?.capacity,
      },
    };
  });

  return {
    rows: rows.slice(0, limit),
    summary: {
      total: today.length,
      remaining: today.filter(
        (session) => session.status === "scheduled" && (minutesOf(session.startTime) ?? 0) > nowMinutes,
      ).length,
      cancelled: today.filter((session) => session.status === "cancelled").length,
      shown: Math.min(limit, rows.length),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Business intelligence                                               */
/* ------------------------------------------------------------------ */

/** Seats taken / seats offered, treating a zero denominator as "no ratio". */
function seatPct(classes: readonly AcademyClass[]): number | null {
  const taken = classes.reduce((sum, klass) => sum + klass.enrolled, 0);
  const seats = classes.reduce((sum, klass) => sum + klass.capacity, 0);
  return ratioPct(taken, seats);
}

/**
 * Occupancy over the stored classes: overall, per room, and per weekday from
 * `class.days`. Live classes only — an archived class is not on offer, and
 * counting its seats would report capacity nobody can book.
 */
export function deriveOccupancy(classes: readonly AcademyClass[], rooms: readonly Room[]): OccupancyModel {
  const live = classes.filter((klass) => klass.status !== "archived");
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const byRoom = new Map<string, AcademyClass[]>();
  for (const klass of live) {
    const group = byRoom.get(klass.roomId);
    if (group) group.push(klass);
    else byRoom.set(klass.roomId, [klass]);
  }

  // A room whose classes offer no seats keeps its row with `pct: null` (rendered
  // as NO_DATA): dropping it would report the room itself as absent, and the
  // seats-taken count beside it is a real measurement.
  const roomRows: OccupancyRow[] = [...byRoom.entries()]
    .map(([roomId, group]) => ({ label: roomNames.get(roomId) ?? NO_DATA, pct: seatPct(group) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  const week: WeekdayOccupancyRow[] = WEEKDAYS.map((full, index) => ({
    index,
    label: WEEKDAYS_SHORT[index],
    full,
    pct: seatPct(live.filter((klass) => klass.days.includes(index))),
  }));

  const ranked = week.filter((row) => row.pct !== null);

  return {
    overallPct: seatPct(live),
    takenSeats: live.reduce((sum, klass) => sum + klass.enrolled, 0),
    totalSeats: live.reduce((sum, klass) => sum + klass.capacity, 0),
    seatsFree: live.filter((klass) => klass.enrolled < klass.capacity).length,
    classes: live.length,
    rooms: roomRows,
    week,
    peakDay: topBy(ranked, (row) => row.pct!) ?? null,
    quietestDay: topBy(ranked, (row) => -row.pct!) ?? null,
  };
}

/**
 * Students per stored instrument. `sharePct` is `null` when no student is
 * enrolled, and there is no delta column: the records carry no previous period,
 * and a fabricated season-on-season change is exactly what H4 removed.
 */
export function deriveInstrumentMix(students: readonly Student[]): InstrumentRow[] {
  const counts = new Map<string, number>();
  for (const student of students) {
    counts.set(student.instrument, (counts.get(student.instrument) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: instrumentName(id), count, sharePct: ratioPct(count, students.length) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fa"));
}

/** Money the academy is owed, from the stored per-student balance. */
export function deriveReceivables(students: readonly Student[], limit = 6): ReceivablesModel {
  const owing = students
    .filter((student) => student.balance > 0)
    .map((student) => ({ id: student.id, label: student.name, amount: student.balance }))
    .sort((a, b) => b.amount - a.amount);

  return {
    owing: owing.length,
    students: students.length,
    total: owing.reduce((sum, row) => sum + row.amount, 0),
    rows: owing.slice(0, limit),
    top: owing[0] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Academy intelligence                                                */
/* ------------------------------------------------------------------ */

/**
 * Insight cards, one per rule that fired. Confidence is a statement about the
 * evidence, so it is derived from the number of records behind the card instead
 * of being asserted: ten stored rows or more reads «بالا», fewer reads «متوسط» —
 * and the card's `source` names those rows.
 *
 * No card claims a model, a prediction or a retention rate: the records carry no
 * such thing, and §15 keeps "academy intelligence" a UX pattern over display
 * data.
 */

/**
 * A Signal → Evidence → Insight → Action card. The canonical owner is this
 * module (M10): the type belongs to the dashboard-intelligence surface whose
 * producer lives here, and the design gallery samples it from
 * `src/components/ds/samples.ts`. Relocated unchanged from the dissolved
 * fixture module.
 */
export interface IntelligenceCard {
  id: string;
  kind: "trend" | "risk" | "idea";
  signal: string;
  evidence: { label: string; value: string }[];
  insight: string;
  action: { label: string; target: Target };
  confidence: "بالا" | "متوسط";
  source: string;
}

export function deriveIntelligenceCards({
  metrics,
  students,
  classes,
  sessions,
  todayIso,
}: InsightInput): IntelligenceCard[] {
  const cards: IntelligenceCard[] = [];
  const source = `بر پایهٔ ${faNum(students.length)} رکورد هنرجو و ${faNum(classes.length)} رکورد کلاس`;
  const confidenceFor = (sample: number, evidence: number): IntelligenceCard["confidence"] =>
    sample + evidence >= 10 ? "بالا" : "متوسط";

  const atRisk = students.filter((student) => student.status === "at-risk");
  if (atRisk.length > 0) {
    const rated = atRisk.filter((student) => student.sessionsTotal > 0);
    const mean = meanOf(rated, (student) => student.attendance);
    const withBalance = atRisk.filter((student) => student.balance > 0).length;
    const instrument = topBy(
      deriveInstrumentMix(atRisk),
      (row) => row.count,
    );
    cards.push({
      id: "at-risk",
      kind: "risk",
      signal:
        students.length > 0
          ? `${faNum(atRisk.length)} هنرجو — ${faPercent(ratioPct(atRisk.length, students.length))} از ثبت‌شده‌ها — در وضعیت نیازمند توجه‌اند.`
          : `${faNum(atRisk.length)} هنرجو در وضعیت نیازمند توجه ثبت شده‌اند.`,
      evidence: [
        { label: "میانگین حضور", value: faPercent(mean) },
        { label: "با ماندهٔ پرداخت", value: faNum(withBalance) },
        { label: "بیشترین ساز", value: instrument ? instrument.label : NO_DATA },
      ],
      insight:
        mean === null
          ? `${faNum(atRisk.length)} رکورد بدون نرخ حضور ثبت‌شده است و ${faNum(withBalance)} نفر ماندهٔ پرداخت دارند.`
          : `میانگین نرخ حضور ثبت‌شدهٔ این گروه ${faPercent(mean)} است و ${faNum(withBalance)} نفر ماندهٔ پرداخت دارند.`,
      action: { label: "مرور پرونده‌ها", target: { view: "students", filter: "at-risk" } },
      confidence: confidenceFor(atRisk.length, withBalance),
      source,
    });
  }

  const waitlisted = classes.filter((klass) => klass.waitlist > 0);
  if (waitlisted.length > 0) {
    const seats = waitlisted.reduce((sum, klass) => sum + klass.waitlist, 0);
    const biggest = topBy(waitlisted, (klass) => klass.waitlist)!;
    const full = classes.filter((klass) => klass.enrolled >= klass.capacity).length;
    cards.push({
      id: "waitlists",
      kind: "idea",
      signal: `${faNum(waitlisted.length)} کلاس لیست انتظار دارند؛ مجموع ${faNum(seats)} نفر.`,
      evidence: [
        { label: "ظرفیت تکمیل", value: `${faNum(full)} کلاس` },
        { label: "اشغال ظرفیت", value: faPercent(ratioPct(metrics.takenSeats, metrics.totalSeats)) },
        { label: "کلاس‌های ثبت‌شده", value: faNum(metrics.classes) },
      ],
      insight: `بیشترین تقاضا در «${biggest.title}» با ${faNum(biggest.waitlist)} نفر در انتظار است؛ ظرفیت ثبت‌شدهٔ آن ${faNum(biggest.enrolled)} از ${faNum(biggest.capacity)} است.`,
      action: { label: "بررسی ظرفیت کلاس‌ها", target: { view: "classes" } },
      confidence: confidenceFor(waitlisted.length, seats),
      source,
    });
  }

  const reference = isoDayNumber(todayIso);
  if (reference !== null) {
    const inWindow = sessions.filter((session) => {
      const day = isoDayNumber(session.date);
      return day !== null && day <= reference && reference - day < 30;
    });
    const cancelled = inWindow.filter((session) => session.status === "cancelled");
    if (cancelled.length > 0) {
      const reasons = new Map<string, number>();
      for (const session of cancelled) {
        const reason = session.cancelReason?.trim();
        if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
      const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      cards.push({
        id: "cancellations",
        kind: "trend",
        signal: `${faNum(cancelled.length)} جلسه در ۳۰ روز گذشته لغو شده است.`,
        evidence: [
          { label: "از جلسات بازه", value: faNum(inWindow.length) },
          { label: "نسبت لغو", value: faPercent(ratioPct(cancelled.length, inWindow.length)) },
          { label: "بازهٔ بررسی", value: "۳۰ روز" },
        ],
        insight:
          topReason === null
            ? "برای این لغوها دلیلی ثبت نشده است؛ ثبت دلیل، بررسی علت را ممکن می‌کند."
            : `بیشترین دلیل ثبت‌شده «${topReason[0]}» است (${faNum(topReason[1])} جلسه).`,
        action: { label: "مشاهدهٔ تقویم", target: { view: "schedule", filter: "cancelled" } },
        confidence: confidenceFor(cancelled.length, inWindow.length),
        source,
      });
    }
  }

  const overdue = students.filter((student) => student.payment === "overdue");
  if (overdue.length > 0) {
    const owing = overdue.reduce((sum, student) => sum + Math.max(student.balance, 0), 0);
    cards.push({
      id: "receivables",
      kind: "risk",
      signal: `${faNum(overdue.length)} رکورد هنرجو پرداخت سررسیدگذشته دارد.`,
      evidence: [
        { label: "ماندهٔ ثبت‌شده", value: faToman(owing, true) },
        { label: "از هنرجویان", value: faPercent(ratioPct(overdue.length, students.length)) },
        { label: "بدون جلسه", value: faNum(overdue.filter((student) => student.sessionsTotal === 0).length) },
      ],
      insight: `مجموع ماندهٔ ثبت‌شده روی این ${faNum(overdue.length)} رکورد ${faToman(owing, true)} است و ${faNum(Math.max(students.length - overdue.length, 0))} رکورد دیگر سررسید گذشته ندارند.`,
      action: { label: "پیگیری پرداخت‌ها", target: { view: "students" } },
      confidence: confidenceFor(overdue.length, students.length),
      source,
    });
  }

  return cards.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Counters shared by the panels' empty states                         */
/* ------------------------------------------------------------------ */

export function dashboardCounts(input: {
  students: readonly Student[];
  classes: readonly AcademyClass[];
  rooms: readonly Room[];
  teachers: number;
  sessions: readonly Session[];
}): DashboardCounts {
  return {
    students: input.students.length,
    classes: input.classes.length,
    rooms: input.rooms.length,
    teachers: input.teachers,
    sessions: input.sessions.length,
    records:
      input.students.length + input.classes.length + input.rooms.length + input.teachers + input.sessions.length,
  };
}
