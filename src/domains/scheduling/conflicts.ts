/**
 * Deterministic conflict detection for scheduled sessions.
 *
 * PURE: no storage, no repository, no React, no network, no clock. Everything
 * the rules need is passed in, so the same function can serve the demo
 * repository today and a future API repository without change, and so the
 * rules can be unit tested without any environment at all.
 *
 * WHY CONFLICTS ARE DERIVED, NOT STORED
 *
 * The legacy fixture carried a `conflictWith` field written by hand. A stored
 * conflict is wrong the moment anything moves: cancel one of the two sessions
 * and the flag remains, reschedule the other and the flag points at the wrong
 * slot. Conflicts are a function of the current schedule, so they are computed.
 *
 * COMPLEXITY
 *
 * Checking a candidate against every session in the academy is O(n) per check
 * and O(n²) when validating a whole generated batch. Instead, sessions are
 * bucketed by calendar date once (`buildDateIndex`, O(n)), after which each
 * check only inspects the handful of sessions sharing that date. Two sessions
 * on different days can never overlap, so no correctness is lost.
 *
 * OVERLAP SEMANTICS
 *
 * Intervals are half-open: `[start, end)`. A session ending at 18:00 and one
 * starting at 18:00 do NOT overlap — back-to-back lessons in the same room are
 * normal and must not be reported as a clash.
 */
import { durationMinutes, toMinutes } from "./dateBridge";
import type {
  ConflictItem,
  ConflictReport,
  Session,
  SessionCandidate,
} from "./types";

/**
 * Plausible session length. 15 minutes is shorter than any real lesson; 480
 * (8h) is longer than any single class and catches an end-time typo such as
 * 17:00–23:00.
 */
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 480;

/** Sessions grouped by ISO date. Built once, queried many times. */
export type DateIndex = ReadonlyMap<string, readonly Session[]>;

/**
 * Buckets sessions by date.
 *
 * Cancelled sessions are dropped here rather than filtered at each rule: a
 * cancelled slot frees its room and teacher, so it must be invisible to every
 * active conflict check.
 */
export function buildDateIndex(sessions: readonly Session[]): DateIndex {
  const index = new Map<string, Session[]>();
  for (const session of sessions) {
    if (session.status === "cancelled") continue;
    const bucket = index.get(session.date);
    if (bucket) bucket.push(session);
    else index.set(session.date, [session]);
  }
  return index;
}

/** Half-open overlap: `[aStart, aEnd)` intersects `[bStart, bEnd)`. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Context the rules need beyond the candidate itself.
 *
 * Every field is optional so a caller can run the cheap structural rules
 * without loading the whole academy. Rules whose inputs are absent are simply
 * not evaluated — they never guess.
 */
export interface ConflictContext {
  /** Sessions to check against, pre-bucketed by date. */
  index: DateIndex;
  /** The candidate's class, for archived/recurrence checks. */
  classInfo?: { id: string; status?: "active" | "archived"; days?: readonly number[] };
  /** True when the room exists and is active; undefined = not checked. */
  roomActive?: boolean;
  /** True when the teacher exists and is active; undefined = not checked. */
  teacherActive?: boolean;
  /**
   * Student ids per class, so overlap can be reported for students enrolled in
   * two classes meeting at once. Absent = the rule is skipped.
   */
  studentsByClassId?: ReadonlyMap<string, readonly string[]>;
  /** Weekday index of the candidate's date, for the off-schedule warning. */
  weekday?: number;
}

/**
 * Evaluates every rule against a candidate.
 *
 * `report.ok` reflects HARD conflicts only. Warnings never block; they require
 * explicit acknowledgement at the repository boundary, which is a decision the
 * caller records rather than one this function makes.
 */
export function detectConflicts(candidate: SessionCandidate, ctx: ConflictContext): ConflictReport {
  const hard: ConflictItem[] = [];
  const warnings: ConflictItem[] = [];

  /* ---- structural rules (no other sessions needed) ---- */

  const start = toMinutes(candidate.startTime);
  const end = toMinutes(candidate.endTime);
  const duration = durationMinutes(candidate.startTime, candidate.endTime);

  if (start === null || end === null || duration === null || duration <= 0) {
    hard.push({
      kind: "SESSION_INVALID_TIME_RANGE",
      severity: "hard",
      message: "زمان پایان باید پس از زمان شروع باشد.",
    });
    // Without a usable interval no overlap rule can run; return what we know
    // rather than comparing against NaN.
    return { hard, warnings, ok: false };
  }

  if (duration < MIN_SESSION_MINUTES || duration > MAX_SESSION_MINUTES) {
    hard.push({
      kind: "SESSION_INVALID_DURATION",
      severity: "hard",
      message: `مدت جلسه باید بین ${MIN_SESSION_MINUTES} تا ${MAX_SESSION_MINUTES} دقیقه باشد.`,
    });
  }

  if (ctx.classInfo?.status === "archived") {
    hard.push({
      kind: "SESSION_CLASS_ARCHIVED",
      severity: "hard",
      message: "برای کلاس بایگانی‌شده نمی‌توان جلسه ثبت کرد.",
    });
  }

  /* ---- overlap rules (one date bucket only) ---- */

  const sameDay = ctx.index.get(candidate.date) ?? [];

  for (const other of sameDay) {
    // A session never conflicts with itself when being edited in place.
    if (candidate.id !== undefined && other.id === candidate.id) continue;

    const otherStart = toMinutes(other.startTime);
    const otherEnd = toMinutes(other.endTime);
    // Defensive: a malformed stored row must not crash the check for others.
    if (otherStart === null || otherEnd === null) continue;
    if (!overlaps(start, end, otherStart, otherEnd)) continue;

    if (other.roomId === candidate.roomId) {
      hard.push({
        kind: "SESSION_ROOM_CONFLICT",
        severity: "hard",
        message: `این اتاق در بازهٔ ${other.startTime}–${other.endTime} اشغال است.`,
        conflictingSessionId: other.id,
      });
    }

    if (other.teacherId === candidate.teacherId) {
      hard.push({
        kind: "SESSION_TEACHER_CONFLICT",
        severity: "hard",
        message: `این مدرس در بازهٔ ${other.startTime}–${other.endTime} جلسهٔ دیگری دارد.`,
        conflictingSessionId: other.id,
      });
    }

    // Student overlap is a WARNING: a student may legitimately be enrolled in
    // two overlapping group classes and alternate between them. It must be
    // surfaced for a decision, never silently ignored and never blocking.
    if (ctx.studentsByClassId && other.classId !== candidate.classId) {
      const mine = ctx.studentsByClassId.get(candidate.classId) ?? [];
      const theirs = new Set(ctx.studentsByClassId.get(other.classId) ?? []);
      const shared = mine.filter((studentId) => theirs.has(studentId));

      if (shared.length > 0) {
        warnings.push({
          kind: "SESSION_STUDENT_OVERLAP",
          severity: "warning",
          message: `${shared.length} هنرجو در این بازه کلاس دیگری دارند.`,
          conflictingSessionId: other.id,
          studentIds: shared,
        });
      }
    }
  }

  /* ---- advisory rules ---- */

  // Existing sessions must survive a room or teacher being deactivated, so
  // this warns rather than blocks.
  if (ctx.roomActive === false || ctx.teacherActive === false) {
    const which =
      ctx.roomActive === false && ctx.teacherActive === false
        ? "اتاق و مدرس"
        : ctx.roomActive === false
          ? "اتاق"
          : "مدرس";
    warnings.push({
      kind: "SESSION_RESOURCE_INACTIVE",
      severity: "warning",
      message: `${which} انتخاب‌شده غیرفعال است.`,
    });
  }

  // A make-up or catch-up session outside the class's usual days is normal.
  if (
    ctx.weekday !== undefined &&
    ctx.classInfo?.days !== undefined &&
    ctx.classInfo.days.length > 0 &&
    !ctx.classInfo.days.includes(ctx.weekday)
  ) {
    warnings.push({
      kind: "SESSION_OFF_SCHEDULE",
      severity: "warning",
      message: "این تاریخ جزو روزهای معمول کلاس نیست.",
    });
  }

  return { hard, warnings, ok: hard.length === 0 };
}

/** Convenience: an empty, passing report. */
export function emptyReport(): ConflictReport {
  return { hard: [], warnings: [], ok: true };
}

/** Merges reports from a batch, de-duplicating identical items. */
export function mergeReports(reports: readonly ConflictReport[]): ConflictReport {
  const hard: ConflictItem[] = [];
  const warnings: ConflictItem[] = [];
  const seen = new Set<string>();

  for (const report of reports) {
    for (const item of [...report.hard, ...report.warnings]) {
      const key = `${item.kind}|${item.conflictingSessionId ?? ""}|${item.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (item.severity === "hard") hard.push(item);
      else warnings.push(item);
    }
  }

  return { hard, warnings, ok: hard.length === 0 };
}
