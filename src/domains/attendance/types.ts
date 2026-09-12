/**
 * Attendance domain types.
 *
 * WHERE ATTENDANCE HANGS
 *
 *   Class → Session → AttendanceRecord → Student
 *
 * Attendance belongs to a SESSION, never to a Class or an Enrollment. A class
 * meets many times, so one attendance row per class is meaningless; an
 * enrollment is a term-long relationship rather than an event. Only a session
 * corresponds 1:1 to a real-world occurrence a student either attended or did
 * not.
 *
 * WHO IS EXPECTED vs WHO CAME
 *
 * The roster is DERIVED from active Enrollment scoped to the session's date
 * (see `roster.ts`). It is never stored: a student who joins in week 6 must
 * not appear on week 2's register, and one who withdraws in week 8 must still
 * appear on weeks 1–7. Attendance records are then keyed against that derived
 * roster.
 *
 * UNMARKED IS THE ABSENCE OF A ROW
 *
 * There is deliberately no `null` or "unmarked" status. "Not taken yet" and
 * "marked absent" are different facts, and a disputed absence turns on exactly
 * that distinction. A student with no record simply has no record.
 *
 * MULTI-TENANCY (§21): production `attendance_records` needs
 * `organization_id`, and `UNIQUE(session_id, student_id)` must be a database
 * constraint rather than an application check.
 */
import type { ListParams } from "@/api/types";
import type { RosterEntry } from "@/domains/scheduling/types";

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

/**
 * The four recorded outcomes.
 *
 * `excused` is separate from `absent` on purpose: an authorised absence must
 * not count against a student's attendance rate, so the two cannot share a
 * value. `late` is separate because it is a distinct behavioural signal that
 * an academy acts on differently from a full absence.
 */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غایب",
  late: "تأخیر",
  excused: "موجه",
};

/** Every valid status, for validation and UI iteration. */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

/**
 * Statuses counted as having attended for rate calculations.
 *
 * `excused` is excluded from BOTH numerator and denominator, so an authorised
 * absence neither helps nor harms the figure.
 */
export const ATTENDED_STATUSES: readonly AttendanceStatus[] = ["present", "late"];

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  /** ISO-8601 timestamp the mark was recorded. */
  recordedAt: string;
  /**
   * Who recorded it.
   *
   * PROVENANCE, NOT AUTHORIZATION. This says who claims to have taken the
   * register; it never decides who is allowed to. A client-supplied id must
   * never be trusted as an access decision — the server enforces that (§31).
   */
  recordedByUserId: string;
  note?: string;
  /** ISO-8601; changes when a correction is applied. */
  updatedAt: string;
}

export interface AttendanceListParams extends ListParams {
  sessionId?: string;
  studentId?: string;
  status?: AttendanceStatus;
  /** ISO-8601 lower bound on `recordedAt`, inclusive. */
  since?: string;
  /** ISO-8601 upper bound on `recordedAt`, inclusive. */
  until?: string;
}

export interface RecordAttendanceInput {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedByUserId: string;
  note?: string;
  /** ISO-8601; defaults to now. Explicit for back-dated entry. */
  recordedAt?: string;
}

/** One row of a bulk register save. */
export interface BulkAttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export interface BulkRecordInput {
  sessionId: string;
  entries: readonly BulkAttendanceEntry[];
  recordedByUserId: string;
  recordedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Corrections — append-only                                           */
/* ------------------------------------------------------------------ */

/**
 * An immutable record of one change to an attendance mark.
 *
 * Attendance about a minor gets disputed ("my child WAS there"), so a silent
 * edit is unacceptable. The current record stays mutable for fast reads while
 * every change appends one of these. Corrections are never edited or deleted —
 * the same append-only discipline `ProgressEvent` already uses.
 */
export interface AttendanceCorrection {
  id: string;
  attendanceRecordId: string;
  /** Denormalized so a session's history can be queried without a join. */
  sessionId: string;
  studentId: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  /** REQUIRED. A correction without a stated reason is unauditable. */
  reason: string;
  changedByUserId: string;
  /** ISO-8601. */
  changedAt: string;
}

export interface CorrectionListParams extends ListParams {
  attendanceRecordId?: string;
  sessionId?: string;
  studentId?: string;
}

export interface CorrectionInput {
  status: AttendanceStatus;
  reason: string;
  changedByUserId: string;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Derived view                                                        */
/* ------------------------------------------------------------------ */

/**
 * A roster entry joined with its mark, if any.
 *
 * `record` is undefined for a student who has not been marked — the "no row"
 * rule above, surfaced to the UI without inventing a placeholder.
 */
export interface RosterAttendance {
  student: RosterEntry;
  record?: AttendanceRecord;
}

/** Everything the register screen needs, from one pass over the data. */
export interface SessionAttendance {
  sessionId: string;
  /** Derived from Enrollment at the session's date; never stored. */
  roster: RosterAttendance[];
  /** Students marked so far. */
  recorded: number;
  /** Roster size. */
  expected: number;
  /** True when the session is cancelled and cannot accept marks. */
  locked: boolean;
}

/* ------------------------------------------------------------------ */
/* Error codes                                                         */
/* ------------------------------------------------------------------ */

export const ATTENDANCE_ERRORS = {
  NOT_FOUND: "ATTENDANCE_NOT_FOUND",
  INVALID: "ATTENDANCE_INVALID",
  SESSION_NOT_FOUND: "ATTENDANCE_SESSION_NOT_FOUND",
  SESSION_CANCELLED: "ATTENDANCE_SESSION_CANCELLED",
  STUDENT_NOT_ON_ROSTER: "ATTENDANCE_STUDENT_NOT_ON_ROSTER",
  DUPLICATE: "ATTENDANCE_DUPLICATE",
  REASON_REQUIRED: "ATTENDANCE_REASON_REQUIRED",
  RECORDER_REQUIRED: "ATTENDANCE_RECORDER_REQUIRED",
} as const;
