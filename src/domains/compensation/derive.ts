/**
 * Pure derivation for the compensation domain.
 *
 * NO STORAGE, NO REPOSITORY, NO REACT, NO NETWORK, NO CLOCK. Everything the rules
 * need is passed in, exactly like `domains/scheduling/conflicts.ts` and
 * `generation.ts`: the same functions can serve the demo repository today and a
 * server-side implementation later, and the rules can be tested with no
 * environment at all.
 *
 * That purity is also the reason `compensationStatusOf` can be the whole of the
 * "cancelled attempt returns the obligation to `required`" rule: the function
 * reads the CURRENT state of the attempt's session, so cancelling that session
 * changes the answer without any write, listener or hook inside `cancelSession`.
 *
 * Nothing here reads the wall clock. `compensationDefaultFor` formats timestamps
 * the scheduling domain already recorded, through the scheduling domain's own
 * `addMinutes`, so the default is a reformat of stored facts rather than a
 * second opinion about time.
 */
import { addMinutes } from "@/domains/scheduling/dateBridge";
import type { RosterEntry } from "@/domains/scheduling/types";
import {
  COMPENSATION_ERRORS,
  DEFAULT_COMPENSATION_MINUTES,
  type AttemptSessionState,
  type CompensationClass,
  type CompensationDefault,
  type CompensationOriginal,
  type CompensationStatus,
  type SessionCompensationRecord,
} from "./types";

/** The fields `compensationDefaultFor` reformats. `Session` satisfies it. */
export interface CompensationOriginalSlot {
  date: string;
  startTime: string;
  roomId: string;
  teacherId: string;
}

/**
 * What a session an attempt points at currently is.
 *
 * `missing` is a real answer, not an error: the scheduling repository allows a
 * hard delete when no attendance exists, and a deleted attempt must not be
 * reported as if it were still bookable.
 */
export function attemptStateOf(
  session: { status: AttemptSessionState } | undefined,
): AttemptSessionState {
  return session?.status ?? "missing";
}

/**
 * The obligation's state, derived from the recorded facts plus the live state of
 * the current attempt's session.
 *
 * Order matters. `completedAt` is checked FIRST and is terminal: the owner's rule
 * returns an obligation to `required` when its attempt is cancelled *before
 * completion*, so a later cancellation must NOT reopen a discharged obligation —
 * it is reported through `attemptBroken` instead, and the read model shows both.
 */
export function compensationStatusOf(
  record: Pick<SessionCompensationRecord, "attempts" | "completedAt">,
  currentSession: { status: AttemptSessionState } | undefined,
): { status: CompensationStatus; attemptBroken: boolean } {
  const broken = attemptBroken(record, currentSession);
  if (record.completedAt !== undefined) {
    // Terminal: a discharge is a decision, and cancelling the session afterwards
    // cannot undo it. `broken` still reports the contradiction.
    return { status: "completed", attemptBroken: broken };
  }

  const state = attemptStateOf(currentSession);
  const live = record.attempts.length > 0 && state !== "missing" && state !== "cancelled";
  return { status: live ? "scheduled" : "required", attemptBroken: broken };
}

/**
 * True when the CURRENT attempt cannot fulfil the obligation any more.
 *
 * `cancelled` and `missing` both count. When there is no attempt at all this is
 * false: nothing is broken, the obligation is simply still open.
 */
export function attemptBroken(
  record: Pick<SessionCompensationRecord, "attempts">,
  currentSession: { status: AttemptSessionState } | undefined,
): boolean {
  if (record.attempts.length === 0) return false;
  const state = attemptStateOf(currentSession);
  return state === "cancelled" || state === "missing";
}

/**
 * The newest attempt, or `undefined` when the obligation was never booked.
 *
 * The ledger is append-only and chronological, so the last line IS the current
 * attempt — there is no separate pointer that could disagree with the history.
 */
export function currentAttemptOf(
  record: Pick<SessionCompensationRecord, "attempts">,
): { sessionId: string; scheduledAt: string; scheduledByUserId: string } | undefined {
  return record.attempts.length > 0 ? record.attempts[record.attempts.length - 1] : undefined;
}

/**
 * The same-day, one-hour prefill for a cancelled session.
 *
 * A REFORMAT of what the original already says: same date, same room, same
 * teacher, and an end time one hour after the original's start. It books nothing,
 * searches nothing, and returns `null` when the original is gone or its times are
 * unreadable — an invented default would be worse than no default, because the
 * operator cannot tell which of the two they are looking at.
 */
export function compensationDefaultFor(
  original: CompensationOriginalSlot | undefined,
): CompensationDefault | null {
  if (!original) return null;
  const endTime = addMinutes(original.startTime, DEFAULT_COMPENSATION_MINUTES);
  if (endTime === null) return null;
  return {
    date: original.date,
    startTime: original.startTime,
    endTime,
    roomId: original.roomId,
    teacherId: original.teacherId,
  };
}

/**
 * The authoritative one-to-one rule, on its own.
 *
 * `schedule` re-checks it at booking time (a class may have been archived or had
 * its `kind` edited since registration) and registration uses it through
 * `isCompensableOriginal`. Exported separately so neither caller has to
 * reconstruct a "pretend cancelled" session to ask the class question.
 */
export function isCompensableClass(klass: CompensationClass | undefined): boolean {
  return klass?.kind === "private";
}

/**
 * Is this session eligible to be compensated at all?
 *
 * Two conditions, and neither is a roster size:
 *
 *   1. the session is CANCELLED — compensation follows a cancellation, and a
 *      cancellation never registers anything by itself;
 *   2. its class is `kind: "private"` — the authoritative one-to-one rule.
 *
 * A group class is refused even when it currently holds one student. Counting
 * roster rows would make eligibility depend on enrolment data that changes, and
 * would compensate a group class on a quiet week.
 */
export function isCompensableOriginal(
  original: Pick<CompensationOriginal, "status">,
  klass: CompensationClass | undefined,
): boolean {
  return original.status === "cancelled" && isCompensableClass(klass);
}

/** Why the named student could not be frozen. */
export type AffectedStudentFailure =
  | typeof COMPENSATION_ERRORS.NO_AFFECTED_STUDENT
  | typeof COMPENSATION_ERRORS.ROSTER_AMBIGUOUS
  | typeof COMPENSATION_ERRORS.STUDENT_MISMATCH;

export type AffectedStudentResolution =
  | { ok: true; studentId: string; studentName: string }
  | { ok: false; code: AffectedStudentFailure };

/**
 * Freezes the affected student of a one-to-one class from the ORIGINAL session's
 * derived roster.
 *
 * The roster is the scheduling domain's answer (`sessionRoster`), scoped to the
 * original's date from active enrollments — never the class's denormalized
 * `studentIds`, and never a mark. Three outcomes, all explicit:
 *
 *   - empty roster → nobody was expected, so nobody is owed;
 *   - two or more  → the data does not describe a one-to-one lesson, and picking
 *                    one silently would create an obligation for an arbitrary
 *                    student;
 *   - one, but not the named one → the caller is about to freeze the wrong
 *                    student, which is the one mistake that must never be quiet.
 */
export function resolveAffectedStudent(
  roster: readonly RosterEntry[],
  studentId: string,
): AffectedStudentResolution {
  if (roster.length === 0) return { ok: false, code: COMPENSATION_ERRORS.NO_AFFECTED_STUDENT };
  if (roster.length > 1) return { ok: false, code: COMPENSATION_ERRORS.ROSTER_AMBIGUOUS };
  const [only] = roster;
  if (only.studentId !== studentId) return { ok: false, code: COMPENSATION_ERRORS.STUDENT_MISMATCH };
  return { ok: true, studentId: only.studentId, studentName: only.studentName };
}
