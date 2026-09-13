/**
 * Scheduling domain types.
 *
 * THREE DISTINCT CONCEPTS — do not collapse them:
 *
 *   CLASS      the offering (title, teacher, room, capacity, tuition).
 *              Already exists as `AcademyClass`; owned by the classes domain.
 *
 *   RECURRENCE "Sunday and Tuesday at 17:00 for 90 minutes".
 *              Already exists as `class.days` / `class.time` / `class.duration`.
 *              This phase READS those fields and never writes them. No separate
 *              RecurrenceRule entity is introduced.
 *
 *   SESSION    one real, dated occurrence: "Tuesday 15 Sep 2026, 17:00–18:30,
 *              room r1". This is the new entity below.
 *
 * A session is MATERIALIZED, not computed on demand, because it carries
 * per-occurrence state a derived value cannot hold: cancellation with a
 * reason, a substitute teacher, a room change, a reschedule link, and the
 * attendance records that hang off it.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 *   - No `students[]`. The roster is derived from active Enrollment scoped to
 *     the session's date, so a student who joins in week 6 never appears on
 *     week 2 and one who withdraws in week 8 still appears on weeks 1–7. A
 *     stored roster cannot express that.
 *   - No `conflictWith`. Conflicts are derived by `conflicts.ts`. The legacy
 *     fixture stored them by hand, which meant they could not react to a
 *     reschedule.
 *   - No attendance summary. `attendanceAvg` is a derived projection.
 *
 * DATE REPRESENTATION
 *
 * `date` is ISO-8601 `YYYY-MM-DD` (Gregorian) and times are `HH:mm` 24-hour.
 * Sessions must be sorted, bucketed and range-queried; a Persian-digit display
 * string cannot do any of that correctly. Jalali is a presentation concern,
 * formatted at the UI edge. `Enrollment.startDate` remains a Jalali display
 * string and is NOT migrated — `dateBridge.ts` reads it where needed.
 *
 * MULTI-TENANCY (§21): production `sessions` needs `organization_id`.
 */
import type { ListParams } from "@/api/types";

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lifecycle of one occurrence.
 *
 * `completed` is set by an explicit action or when attendance is recorded —
 * never inferred from the clock. The demo clock is frozen and a browser clock
 * is user-controlled, so "it is past 18:00, therefore the class happened"
 * would be a fabricated fact.
 */
export type SessionStatus = "scheduled" | "cancelled" | "completed";

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "برنامه‌ریزی‌شده",
  cancelled: "لغو شده",
  completed: "برگزار شده",
};

/**
 * How the session came into existence.
 *
 * `manual` marks a session a human created or edited directly. Bulk generation
 * never overwrites one, so an intentional override survives every regeneration.
 */
export type SessionOrigin = "generated" | "manual";

export interface Session {
  /** Deterministic for generated slots; see `deterministicSessionId`. */
  id: string;
  classId: string;
  /** ISO-8601 calendar date, `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, 24-hour, local academy time. */
  startTime: string;
  /** `HH:mm`, exclusive end. 17:00–18:00 and 18:00–19:00 do not overlap. */
  endTime: string;
  /**
   * Per-occurrence snapshot, not a lookup. Lets a substitute cover one session
   * without rewriting the class. Defaults to the class's teacher at generation.
   */
  teacherId: string;
  /** Per-occurrence snapshot; allows a one-off room change. */
  roomId: string;
  status: SessionStatus;
  origin: SessionOrigin;
  /** Required when `status` is `cancelled`; enforced by the repository. */
  cancelReason?: string;
  /** Set on the NEW session created by a reschedule. */
  rescheduledFromId?: string;
  /** Set on the ORIGINAL session a reschedule replaced. */
  rescheduledToId?: string;
  notes?: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

export interface SessionListParams extends ListParams {
  classId?: string;
  teacherId?: string;
  roomId?: string;
  status?: SessionStatus;
  /** Inclusive ISO date lower bound. */
  from?: string;
  /** Inclusive ISO date upper bound. */
  to?: string;
  /** Exclude cancelled sessions. */
  activeOnly?: boolean;
}

export type CreateSessionInput = Omit<
  Session,
  "id" | "status" | "origin" | "createdAt" | "updatedAt" | "rescheduledFromId" | "rescheduledToId"
> &
  Partial<Pick<Session, "status" | "notes">> & {
    /**
     * Proceed despite WARNING-level conflicts. Hard conflicts are never
     * bypassable. Defaults to false so a warning is a decision, not a default.
     */
    acknowledgeWarnings?: boolean;
  };

export type UpdateSessionInput = Partial<
  Pick<Session, "date" | "startTime" | "endTime" | "teacherId" | "roomId" | "notes">
> & { acknowledgeWarnings?: boolean };

export interface RescheduleInput {
  date: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  roomId?: string;
  /** Why the session moved. Kept on the cancelled original. */
  reason: string;
  acknowledgeWarnings?: boolean;
}

/* ------------------------------------------------------------------ */
/* Conflicts (derived — never stored)                                  */
/* ------------------------------------------------------------------ */

/**
 * The minimum shape the conflict engine needs. A candidate may be an existing
 * `Session` or a not-yet-created one, so it is not `Session`.
 */
export interface SessionCandidate {
  /** Present when checking an existing session, so it excludes itself. */
  id?: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId: string;
}

/**
 * HARD conflicts make a session impossible or incoherent and are always
 * refused. WARNINGs are legitimate-but-unusual and require explicit
 * confirmation — never silently ignored, never blocking.
 */
export type ConflictSeverity = "hard" | "warning";

export type ConflictKind =
  /* hard */
  | "SESSION_INVALID_TIME_RANGE"
  | "SESSION_INVALID_DURATION"
  | "SESSION_ROOM_CONFLICT"
  | "SESSION_TEACHER_CONFLICT"
  | "SESSION_CLASS_ARCHIVED"
  /* warning */
  | "SESSION_STUDENT_OVERLAP"
  | "SESSION_RESOURCE_INACTIVE"
  | "SESSION_OFF_SCHEDULE";

export interface ConflictItem {
  kind: ConflictKind;
  severity: ConflictSeverity;
  /** Persian sentence naming the actual clash, safe to render. */
  message: string;
  /** The session already occupying the slot, when there is one. */
  conflictingSessionId?: string;
  /** Students involved, for `SESSION_STUDENT_OVERLAP`. */
  studentIds?: string[];
}

export interface ConflictReport {
  hard: ConflictItem[];
  warnings: ConflictItem[];
  /** True when nothing blocks creation (warnings may still need consent). */
  ok: boolean;
}

/* ------------------------------------------------------------------ */
/* Bounded generation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Window caps.
 *
 * Bounded on purpose: an open-ended "generate forever" would materialize an
 * unbounded table and make a mistake unrecoverable by hand. Exceeding a cap is
 * a validation error, never a silent truncation.
 */
export const MAX_GENERATION_DAYS = 180;
export const MAX_GENERATION_SESSIONS = 500;

export interface GenerateInput {
  classId: string;
  /** Inclusive ISO date. */
  from: string;
  /** Inclusive ISO date. */
  to: string;
  /**
   * Apply `UPDATE_CANDIDATE` slots — future, generated, attendance-free
   * sessions whose class recurrence changed. Defaults to false: regeneration
   * must never rewrite an existing session without an explicit decision.
   */
  confirmUpdates?: boolean;
}

/**
 * Why a slot was left alone. Every skip is reported so the preview can explain
 * itself instead of silently doing nothing.
 */
export type SkipReason =
  /** Identical to the existing session — regeneration is a no-op. */
  | "SKIP_UNCHANGED"
  /** Date already past; scheduling history is immutable. */
  | "SKIP_PAST"
  /** Cancelled sessions are never resurrected. */
  | "SKIP_CANCELLED"
  /** Attendance exists; the session is evidence and must not change. */
  | "SKIP_PROTECTED"
  /** A human edited this occurrence; an override outranks generation. */
  | "SKIP_MANUAL";

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  SKIP_UNCHANGED: "بدون تغییر",
  SKIP_PAST: "گذشته — تغییرناپذیر",
  SKIP_CANCELLED: "لغو شده — بازگردانی نمی‌شود",
  SKIP_PROTECTED: "حضور و غیاب ثبت شده — محافظت‌شده",
  SKIP_MANUAL: "ویرایش دستی — محافظت‌شده",
};

/** A slot the plan would create. Not yet a `Session`: it has no timestamps. */
export interface PlannedSession {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId: string;
}

/** An existing future session whose class recurrence has since changed. */
export interface PlannedUpdate {
  sessionId: string;
  current: Pick<Session, "date" | "startTime" | "endTime" | "teacherId" | "roomId">;
  next: Pick<Session, "date" | "startTime" | "endTime" | "teacherId" | "roomId">;
}

export interface SkippedSlot {
  /** Deterministic slot id, whether or not a session exists for it. */
  id: string;
  date: string;
  reason: SkipReason;
}

/**
 * A future generated session that no longer matches any slot the class
 * recurrence produces — typically because the class time moved.
 *
 * Surfaced for an EXPLICIT decision and never auto-deleted: silently removing
 * scheduled work is exactly the kind of invisible data loss this design
 * exists to prevent.
 */
export interface OrphanedSession {
  sessionId: string;
  date: string;
  startTime: string;
  reason: "ORPHANED_RECURRENCE_CHANGED";
}

/**
 * The result of planning. Produced by a pure function and by
 * `previewGeneration`, which performs NO writes.
 */
export interface GenerationPlan {
  classId: string;
  from: string;
  to: string;
  creates: PlannedSession[];
  updates: PlannedUpdate[];
  skips: SkippedSlot[];
  orphans: OrphanedSession[];
  /** Conflicts across everything the plan would write. */
  conflicts: ConflictReport;
}

export interface GenerationResult {
  plan: GenerationPlan;
  created: Session[];
  updated: Session[];
  /** True when nothing was written (a fully idempotent re-run). */
  noop: boolean;
}

/* ------------------------------------------------------------------ */
/* Derived roster                                                      */
/* ------------------------------------------------------------------ */

/**
 * One student on a session's roster, derived from Enrollment at the session's
 * date. Lives here rather than in the attendance domain because scheduling
 * answers "who is expected"; attendance answers "who came".
 */
export interface RosterEntry {
  studentId: string;
  studentName: string;
  photoMediaId?: string;
}

/* ------------------------------------------------------------------ */
/* Error codes                                                         */
/* ------------------------------------------------------------------ */

export const SESSION_ERRORS = {
  NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID: "SESSION_INVALID",
  CLASS_NOT_FOUND: "SESSION_CLASS_NOT_FOUND",
  CLASS_ARCHIVED: "SESSION_CLASS_ARCHIVED",
  HAS_ATTENDANCE: "SESSION_HAS_ATTENDANCE",
  ALREADY_CANCELLED: "SESSION_ALREADY_CANCELLED",
  CANCEL_REASON_REQUIRED: "SESSION_CANCEL_REASON_REQUIRED",
  CONFLICT: "SESSION_CONFLICT",
  WARNINGS_UNACKNOWLEDGED: "SESSION_WARNINGS_UNACKNOWLEDGED",
  GENERATION_WINDOW_INVALID: "SESSION_GENERATION_WINDOW_INVALID",
} as const;
