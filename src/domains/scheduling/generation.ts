/**
 * Bounded, idempotent session generation from a class's recurrence.
 *
 * PURE: no storage, no repository, no React, no network, no ambient clock.
 * "Today" is passed in, so a frozen demo clock and a real production clock
 * both work and tests are deterministic.
 *
 * THE INVARIANT THIS FILE EXISTS TO PROTECT
 *
 *   Changing a class's recurrence must NEVER silently rewrite a session that
 *   is in the past, has attendance recorded, was cancelled, or was edited by
 *   hand.
 *
 * Everything below follows from that. Planning is separated from applying:
 * `planGeneration` computes what WOULD happen and writes nothing, so the UI can
 * show "۱۲ ایجاد · ۳ بدون تغییر · ۲ محافظت‌شده" before anyone commits.
 *
 * IDEMPOTENCY IS STRUCTURAL, NOT A DUPLICATE SCAN
 *
 * A generated slot's id is derived from its content — class, date and start
 * time. Re-running generation over the same window computes the same ids, so
 * an existing session is recognised by identity rather than by fuzzy matching
 * on times. Running twice therefore produces zero writes by construction.
 */
import { addMinutes, datesInRange, daysBetween, isIsoDate, isHhMm, weekdayIndex } from "./dateBridge";
import { buildDateIndex, detectConflicts, mergeReports, type ConflictContext } from "./conflicts";
import {
  MAX_GENERATION_DAYS,
  MAX_GENERATION_SESSIONS,
  type ConflictReport,
  type GenerateInput,
  type GenerationPlan,
  type OrphanedSession,
  type PlannedSession,
  type PlannedUpdate,
  type Session,
  type SkippedSlot,
} from "./types";

/** The class fields generation reads. Never written by this domain. */
export interface RecurrenceSource {
  id: string;
  status?: "active" | "archived";
  /** Weekday indices, Saturday-first, matching `WEEKDAYS`. */
  days: readonly number[];
  /** `HH:mm` start time. */
  time: string;
  /** Minutes. */
  duration: number;
  teacherId: string;
  roomId: string;
}

export interface PlanContext {
  /** Every existing session for this class, any status. */
  existing: readonly Session[];
  /** Session ids that already have attendance recorded. */
  sessionIdsWithAttendance: ReadonlySet<string>;
  /** Today, ISO `YYYY-MM-DD`. Injected so this stays pure. */
  today: string;
  /** Optional extras for conflict evaluation across the whole academy. */
  conflict?: Omit<ConflictContext, "index" | "classInfo" | "weekday"> & {
    /** Sessions from OTHER classes, for cross-class conflict checks. */
    otherSessions?: readonly Session[];
  };
}

/**
 * Content-derived id for a generated slot: `ses_<classId>_<YYYYMMDD>_<HHmm>`.
 *
 * Manual sessions never use this shape (`ses_m_…`), so a human-created session
 * can never collide with a generated slot and be silently overwritten.
 */
export function deterministicSessionId(classId: string, date: string, startTime: string): string {
  return `ses_${classId}_${date.replace(/-/g, "")}_${startTime.replace(":", "")}`;
}

/** True when an id has the generated shape for this class. */
export function isGeneratedIdFor(classId: string, id: string): boolean {
  return id.startsWith(`ses_${classId}_`);
}

export interface WindowValidation {
  ok: boolean;
  code?: "SESSION_GENERATION_WINDOW_INVALID";
  message?: string;
}

/**
 * Validates the requested window.
 *
 * Caps are refused outright rather than silently truncated: quietly generating
 * 180 of the 400 days someone asked for looks like success and leaves a gap
 * nobody notices.
 */
export function validateWindow(from: string, to: string): WindowValidation {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return { ok: false, code: "SESSION_GENERATION_WINDOW_INVALID", message: "بازهٔ تاریخ معتبر نیست." };
  }
  const span = daysBetween(from, to);
  if (span === null || span < 0) {
    return {
      ok: false,
      code: "SESSION_GENERATION_WINDOW_INVALID",
      message: "تاریخ پایان باید پس از تاریخ شروع باشد.",
    };
  }
  if (span + 1 > MAX_GENERATION_DAYS) {
    return {
      ok: false,
      code: "SESSION_GENERATION_WINDOW_INVALID",
      message: `بازهٔ تولید نمی‌تواند بیش از ${MAX_GENERATION_DAYS} روز باشد.`,
    };
  }
  return { ok: true };
}

/**
 * Computes the full plan. **Performs no writes and mutates nothing.**
 *
 * Returns a plan whose `conflicts.hard` is non-empty when the window itself is
 * invalid, so a caller that ignores the distinction still cannot proceed.
 */
export function planGeneration(
  input: GenerateInput,
  klass: RecurrenceSource,
  ctx: PlanContext,
): GenerationPlan {
  const empty: GenerationPlan = {
    classId: input.classId,
    from: input.from,
    to: input.to,
    creates: [],
    updates: [],
    skips: [],
    orphans: [],
    conflicts: { hard: [], warnings: [], ok: true },
  };

  const window = validateWindow(input.from, input.to);
  if (!window.ok) {
    return {
      ...empty,
      conflicts: {
        hard: [
          {
            kind: "SESSION_INVALID_TIME_RANGE",
            severity: "hard",
            message: window.message ?? "بازهٔ تاریخ معتبر نیست.",
          },
        ],
        warnings: [],
        ok: false,
      },
    };
  }

  if (klass.status === "archived") {
    return {
      ...empty,
      conflicts: {
        hard: [
          {
            kind: "SESSION_CLASS_ARCHIVED",
            severity: "hard",
            message: "برای کلاس بایگانی‌شده نمی‌توان جلسه تولید کرد.",
          },
        ],
        warnings: [],
        ok: false,
      },
    };
  }

  if (!isHhMm(klass.time) || !Number.isFinite(klass.duration) || klass.duration <= 0) {
    return {
      ...empty,
      conflicts: {
        hard: [
          {
            kind: "SESSION_INVALID_TIME_RANGE",
            severity: "hard",
            message: "زمان یا مدت کلاس معتبر نیست.",
          },
        ],
        warnings: [],
        ok: false,
      },
    };
  }

  const endTime = addMinutes(klass.time, klass.duration);
  if (endTime === null) {
    return {
      ...empty,
      conflicts: {
        hard: [
          {
            kind: "SESSION_INVALID_TIME_RANGE",
            severity: "hard",
            message: "مدت کلاس از پایان شبانه‌روز عبور می‌کند.",
          },
        ],
        warnings: [],
        ok: false,
      },
    };
  }

  const byId = new Map(ctx.existing.map((s) => [s.id, s]));
  const creates: PlannedSession[] = [];
  const updates: PlannedUpdate[] = [];
  const skips: SkippedSlot[] = [];
  /** Slot ids the current recurrence produces — used to find orphans. */
  const plannedIds = new Set<string>();

  for (const date of datesInRange(input.from, input.to)) {
    const weekday = weekdayIndex(date);
    if (weekday === null || !klass.days.includes(weekday)) continue;

    const id = deterministicSessionId(klass.id, date, klass.time);
    plannedIds.add(id);

    const existing = byId.get(id);

    if (!existing) {
      creates.push({
        id,
        classId: klass.id,
        date,
        startTime: klass.time,
        endTime,
        teacherId: klass.teacherId,
        roomId: klass.roomId,
      });
      continue;
    }

    // Order matters: the strongest protection wins. A cancelled session that
    // also has attendance must report as cancelled-and-protected, and the most
    // important fact for the operator is that it will not be touched.
    if (existing.status === "cancelled") {
      skips.push({ id, date, reason: "SKIP_CANCELLED" });
      continue;
    }
    if (ctx.sessionIdsWithAttendance.has(existing.id)) {
      skips.push({ id, date, reason: "SKIP_PROTECTED" });
      continue;
    }
    if (date < ctx.today) {
      skips.push({ id, date, reason: "SKIP_PAST" });
      continue;
    }
    if (existing.origin === "manual") {
      skips.push({ id, date, reason: "SKIP_MANUAL" });
      continue;
    }

    const differs =
      existing.startTime !== klass.time ||
      existing.endTime !== endTime ||
      existing.teacherId !== klass.teacherId ||
      existing.roomId !== klass.roomId;

    if (!differs) {
      skips.push({ id, date, reason: "SKIP_UNCHANGED" });
      continue;
    }

    updates.push({
      sessionId: existing.id,
      current: {
        date: existing.date,
        startTime: existing.startTime,
        endTime: existing.endTime,
        teacherId: existing.teacherId,
        roomId: existing.roomId,
      },
      next: {
        date,
        startTime: klass.time,
        endTime,
        teacherId: klass.teacherId,
        roomId: klass.roomId,
      },
    });
  }

  /*
   * Orphans: future, generated, unprotected sessions inside the window that the
   * current recurrence no longer produces — typically because the class time
   * or day moved. Surfaced for an explicit decision and NEVER auto-deleted;
   * silently removing scheduled work is invisible data loss.
   */
  const orphans: OrphanedSession[] = [];
  for (const existing of ctx.existing) {
    if (existing.date < input.from || existing.date > input.to) continue;
    if (plannedIds.has(existing.id)) continue;
    if (existing.status === "cancelled") continue;
    if (existing.origin === "manual") continue;
    if (ctx.sessionIdsWithAttendance.has(existing.id)) continue;
    if (existing.date < ctx.today) continue;
    if (!isGeneratedIdFor(klass.id, existing.id)) continue;

    orphans.push({
      sessionId: existing.id,
      date: existing.date,
      startTime: existing.startTime,
      reason: "ORPHANED_RECURRENCE_CHANGED",
    });
  }

  return {
    classId: input.classId,
    from: input.from,
    to: input.to,
    creates,
    updates,
    skips,
    orphans,
    conflicts: evaluatePlanConflicts(creates, updates, klass, ctx),
  };
}

/**
 * Conflict report across everything the plan would write.
 *
 * Each candidate is checked against the rest of the academy AND against the
 * other slots in this same batch — two new sessions can collide with each
 * other, which a check against stored data alone would miss.
 */
function evaluatePlanConflicts(
  creates: readonly PlannedSession[],
  updates: readonly PlannedUpdate[],
  klass: RecurrenceSource,
  ctx: PlanContext,
): ConflictReport {
  const others = ctx.conflict?.otherSessions ?? [];
  const now = Date.now();

  // Batch slots modelled as sessions so they participate in the same index.
  const batch: Session[] = [
    ...creates.map((slot) => toProvisionalSession(slot, now)),
    ...updates.map((update) =>
      toProvisionalSession(
        {
          id: update.sessionId,
          classId: klass.id,
          date: update.next.date,
          startTime: update.next.startTime,
          endTime: update.next.endTime,
          teacherId: update.next.teacherId,
          roomId: update.next.roomId,
        },
        now,
      ),
    ),
  ];

  const index = buildDateIndex([...others, ...batch]);

  const reports = batch.map((candidate) =>
    detectConflicts(
      {
        id: candidate.id,
        classId: candidate.classId,
        date: candidate.date,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        teacherId: candidate.teacherId,
        roomId: candidate.roomId,
      },
      {
        index,
        classInfo: { id: klass.id, status: klass.status, days: klass.days },
        roomActive: ctx.conflict?.roomActive,
        teacherActive: ctx.conflict?.teacherActive,
        studentsByClassId: ctx.conflict?.studentsByClassId,
        weekday: weekdayIndex(candidate.date) ?? undefined,
      },
    ),
  );

  return mergeReports(reports);
}

function toProvisionalSession(slot: PlannedSession, now: number): Session {
  const stamp = new Date(now).toISOString();
  return {
    ...slot,
    status: "scheduled",
    origin: "generated",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** True when applying this plan would write nothing. */
export function isNoopPlan(plan: GenerationPlan, confirmUpdates = false): boolean {
  return plan.creates.length === 0 && (!confirmUpdates || plan.updates.length === 0);
}

/** Counts per skip reason, for the preview summary. */
export function summarizePlan(plan: GenerationPlan): {
  creates: number;
  updates: number;
  orphans: number;
  skipped: Record<string, number>;
} {
  const skipped: Record<string, number> = {};
  for (const skip of plan.skips) {
    skipped[skip.reason] = (skipped[skip.reason] ?? 0) + 1;
  }
  return {
    creates: plan.creates.length,
    updates: plan.updates.length,
    orphans: plan.orphans.length,
    skipped,
  };
}

/**
 * Guard for the total materialized count.
 *
 * Checked against the plan rather than the window, because a class meeting
 * twice a week produces far fewer sessions than one meeting daily.
 */
export function exceedsSessionCap(plan: GenerationPlan): boolean {
  return plan.creates.length + plan.updates.length > MAX_GENERATION_SESSIONS;
}
