/**
 * Compensation domain types.
 *
 * THE OBLIGATION, NOT THE SESSION
 *
 * A cancelled session does not, by itself, owe anybody anything. Cancellation is
 * unchanged and creates nothing (this domain never touches `cancelSession`). What
 * exists here is the RECORD a human creates afterwards, explicitly, on the
 * cancelled session of a PRIVATE (one-to-one) class: "this student is owed a
 * make-up".
 *
 * A `SessionCompensation` is therefore:
 *
 *   - a separate entity, not a status on `Session` and not a field on it. The
 *     obligation must survive its own fulfilment being cancelled, and it must be
 *     listable and countable on its own (`required`/`scheduled`/`completed` are
 *     facts about the obligation, not about any session);
 *   - linked to the cancelled session by a TYPED id (`originalSessionId`), so the
 *     relation is queryable. Free-text linkage through `notes` is not a relation:
 *     it cannot be filtered, counted or enforced, and this codebase already spent
 *     a milestone removing exactly that class of quiet defect (see D17);
 *   - fulfilled by ORDINARY sessions, created through the scheduling repository's
 *     own `create()` verb — no second session model, no second conflict engine.
 *
 * WHY THERE IS NO STORED STATUS
 *
 * `required` → `scheduled` → `completed` is DERIVED from the recorded facts:
 *
 *     completed  ⇔ `completedAt` is set
 *     scheduled  ⇔ the newest attempt's session exists and is not `cancelled`
 *     required   ⇔ otherwise
 *
 * That is what makes the owner's rule — "if the compensation session is
 * cancelled before completion, the requirement returns to `required`, and the
 * cancelled attempt stays history" — true WITHOUT a write, a listener, or a hook
 * inside `cancelSession`: cancelling the attempt makes the derivation answer
 * `required` again, and the append-only attempt ledger keeps the cancelled
 * attempt in the record. A stored status would be a second source of truth that
 * `cancelSession` (a protected verb this phase may not modify) would have to be
 * taught to maintain.
 *
 * `completed` HERE IS NOT `Session.status === "completed"`
 *
 * They are different facts about different things and are deliberately NOT
 * derived from each other:
 *
 *   - the obligation's `completedAt` is a DECISION, recorded with an actor and a
 *     timestamp ("the academy regards this debt discharged");
 *   - `Session.status === "completed"` is a LIFECYCLE transition ("this
 *     occurrence happened"), and is the separate SL workstream of the approved
 *     contract — not implemented here, and not a dependency of this domain.
 *
 * The two can disagree (a `scheduled` attempt session that nobody completed while
 * the obligation was discharged by decision), and the read model reports both
 * rather than hiding the contradiction.
 *
 * ELIGIBILITY IS THE CLASS KIND, NEVER THE ROSTER SIZE
 *
 * `AcademyClass.kind === "private"` is the authority. A group class is not
 * eligible even when it currently holds exactly one student — counting roster
 * rows would make eligibility a function of data that changes, and would quietly
 * compensate a group class on a quiet week. Roster size is therefore used only as
 * a SAFETY CHECK on the named student (exactly one, and it must be the one the
 * caller named).
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 *   - no group/shared compensation (`kind: "group"` is refused outright);
 *   - no notification, SMS or provider of any kind;
 *   - no free-slot search: the same-day/one-hour shape is a PREFILL, computed by
 *     `compensationDefaultFor()` and typed into the ordinary scheduling form;
 *   - no effect on the existing cancellation/reschedule semantics, and no new
 *     `SessionStatus` member.
 */
import type { ListParams } from "@/api/types";
import type { AttendanceStatus } from "@/domains/attendance/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Session, SessionStatus } from "@/domains/scheduling/types";

/* ------------------------------------------------------------------ */
/* The obligation                                                      */
/* ------------------------------------------------------------------ */

/**
 * The obligation's own state. **Derived on read, never stored** — see the header.
 */
export type CompensationStatus = "required" | "scheduled" | "completed";

export const COMPENSATION_STATUS_LABEL: Record<CompensationStatus, string> = {
  required: "نیازمند جبرانی",
  scheduled: "جبرانی ثبت شده",
  completed: "جبرانی انجام شده",
};

/**
 * One booking of the make-up.
 *
 * Append-only: a line is never edited and never removed — including when its
 * session is cancelled, which is exactly the case that must stay traceable. The
 * CURRENT attempt is the newest line, so there is no separate current-pointer to
 * fall out of step with the history.
 */
export interface CompensationAttempt {
  /** The `Session` this attempt booked. */
  sessionId: string;
  /** ISO-8601 timestamp of the booking act. */
  scheduledAt: string;
  /**
   * Who booked it.
   *
   * PROVENANCE, NOT AUTHORIZATION — the same caveat the attendance domain
   * documents. It says who claims to have booked the make-up; it never decides
   * who is allowed to. The server enforces that.
   */
  scheduledByUserId: string;
}

/** The STORED shape: facts only, no status field. */
export interface SessionCompensationRecord {
  id: string;
  /** The typed link to the CANCELLED session this record compensates for. */
  originalSessionId: string;
  /**
   * The original's class, snapshotted at registration.
   *
   * A session's class never changes (the scheduling repository pins `classId` on
   * every write), so this cannot drift — and keeping it means the obligation can
   * still say WHICH class is owed a make-up after the original session row has
   * been hard-deleted (the repository allows that when no attendance exists).
   */
  classId: string;
  /** The single affected student, FROZEN at registration. */
  studentId: string;
  /** Why compensation was decided. Required, and distinct from `cancelReason`. */
  reason: string;
  /** ISO-8601. */
  requiredAt: string;
  /** PROVENANCE, NOT AUTHORIZATION. */
  requiredByUserId: string;
  /** Oldest → newest. Empty means the obligation was never booked. */
  attempts: CompensationAttempt[];
  /**
   * Set when registration acknowledged an attendance mark the student already
   * had on the CANCELLED original.
   *
   * Marked sessions are not a reason to invent a compensation, but they are a
   * reason to ask before creating one: the session is locked for new marks, so a
   * registered compensation is the explicit decision that the student is still
   * owed. The mark itself is NOT copied here — it is derived on read.
   */
  originalAttendanceAcknowledgedAt?: string;
  /** ISO-8601; set exactly once, by `complete`. Terminal. */
  completedAt?: string;
  /** PROVENANCE, NOT AUTHORIZATION. */
  completedByUserId?: string;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. */
  updatedAt: string;
}

/** Live state of a session an attempt points at. `missing` = hard-deleted. */
export type AttemptSessionState = SessionStatus | "missing";

/** The READ model: the stored facts plus everything derived from them. */
export interface SessionCompensation extends SessionCompensationRecord {
  /** Derived. See the header for the exact rules. */
  status: CompensationStatus;
  /** The newest attempt with its session's live state. Absent when never booked. */
  currentAttempt?: { sessionId: string; sessionStatus: AttemptSessionState };
  /** True when the current attempt's session is `cancelled` or `missing`. */
  attemptBroken: boolean;
  /** True when the original session row no longer resolves. */
  originalMissing: boolean;
  /**
   * The affected student's mark on the ORIGINAL session, when one exists.
   *
   * Derived from the attendance domain on every read and never stored: a
   * correction must change what this shows without a second write. `undefined`
   * means "no mark", which is a different fact from "not read" — this field is
   * always populated by a real read effect.
   */
  originalStudentAttendance?: AttendanceStatus;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface RegisterCompensationInput {
  /** Must be an existing session whose `status` is `cancelled`. */
  originalSessionId: string;
  /** Must be the single student the original's derived roster yields. */
  studentId: string;
  /** Required. The decision's justification. */
  reason: string;
  /**
   * Consent to register despite the student already having a mark on the
   * original. Without it, registration is refused rather than silently assumed.
   */
  acknowledgedOriginalAttendance?: boolean;
  /** PROVENANCE, NOT AUTHORIZATION. */
  requiredByUserId: string;
}

/**
 * The booking input.
 *
 * Deliberately a SUBSET of `CreateSessionInput`: `classId` is not accepted (it is
 * the original's class, recorded on the obligation), and `status`/`notes` are not
 * accepted — an attempt is always a plain `scheduled` manual session.
 */
export interface ScheduleCompensationInput {
  /** ISO-8601 `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  startTime: string;
  /** `HH:mm`, exclusive. */
  endTime: string;
  /** Defaults to the original session's room. */
  roomId?: string;
  /** Defaults to the original session's teacher. */
  teacherId?: string;
  /** Same meaning as `CreateSessionInput`: a warning refuses unless acknowledged. */
  acknowledgeWarnings?: boolean;
  /** PROVENANCE, NOT AUTHORIZATION. */
  scheduledByUserId: string;
}

export interface CompleteCompensationInput {
  /** PROVENANCE, NOT AUTHORIZATION. */
  completedByUserId: string;
}

/**
 * The same-day, one-hour PREFILL.
 *
 * A proposal for a form, never a booking: nothing here writes, and there is no
 * free-slot search in this phase. The caller renders it, the operator may change
 * any field, and only `schedule()` writes.
 */
export interface CompensationDefault {
  /** The original session's date. */
  date: string;
  /** The original session's `startTime`. */
  startTime: string;
  /** `startTime + 60 minutes`, through the domain's own clock arithmetic. */
  endTime: string;
  /** The original session's room. */
  roomId: string;
  /** The original session's teacher. */
  teacherId: string;
}

/** The agreed default length, in minutes. Not a constraint on `schedule()`. */
export const DEFAULT_COMPENSATION_MINUTES = 60;

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface CompensationListParams extends ListParams {
  /** The typed link, queried directly. */
  originalSessionId?: string;
  studentId?: string;
  classId?: string;
  /** Derived filter — a cancelled attempt counts as `required`. */
  status?: CompensationStatus;
  /** `required` or `scheduled` (i.e. not completed). */
  openOnly?: boolean;
  /** Reverse lookup: the obligation whose CURRENT attempt is this session. */
  compensationSessionId?: string;
  /** Obligations whose current attempt was cancelled or deleted. */
  needsAttention?: boolean;
}

/* ------------------------------------------------------------------ */
/* Eligibility (pure predicate inputs)                                 */
/* ------------------------------------------------------------------ */

/** The class fields eligibility reads. `AcademyClass` satisfies it. */
export type CompensationClass = Pick<AcademyClass, "id" | "kind">;

/** The session fields eligibility reads. `Session` satisfies it. */
export type CompensationOriginal = Pick<Session, "id" | "status" | "classId">;

/* ------------------------------------------------------------------ */
/* Error codes                                                         */
/* ------------------------------------------------------------------ */

export const COMPENSATION_ERRORS = {
  NOT_FOUND: "COMPENSATION_NOT_FOUND",
  ORIGINAL_NOT_FOUND: "COMPENSATION_ORIGINAL_NOT_FOUND",
  ORIGINAL_NOT_CANCELLED: "COMPENSATION_ORIGINAL_NOT_CANCELLED",
  CLASS_NOT_FOUND: "COMPENSATION_CLASS_NOT_FOUND",
  /** The class is not `kind: "private"` — all group classes, without exception. */
  CLASS_NOT_PRIVATE: "COMPENSATION_CLASS_NOT_PRIVATE",
  NO_AFFECTED_STUDENT: "COMPENSATION_NO_AFFECTED_STUDENT",
  ROSTER_AMBIGUOUS: "COMPENSATION_ROSTER_AMBIGUOUS",
  STUDENT_MISMATCH: "COMPENSATION_STUDENT_MISMATCH",
  REASON_REQUIRED: "COMPENSATION_REASON_REQUIRED",
  ORIGINAL_ATTENDANCE_UNACKNOWLEDGED: "COMPENSATION_ORIGINAL_ATTENDANCE_UNACKNOWLEDGED",
  ALREADY_OPEN: "COMPENSATION_ALREADY_OPEN",
  ALREADY_SETTLED: "COMPENSATION_ALREADY_SETTLED",
  NOT_SCHEDULED: "COMPENSATION_NOT_SCHEDULED",
  SESSION_ALREADY_LINKED: "COMPENSATION_SESSION_ALREADY_LINKED",
  ACTOR_REQUIRED: "COMPENSATION_ACTOR_REQUIRED",
} as const;
