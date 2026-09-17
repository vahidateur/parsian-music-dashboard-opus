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
 * The session it reads is the EFFECTIVE one — `attemptLineageOf` follows
 * scheduling's reschedule links first, because a move is a continuation and not
 * a cancellation.
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

/* ------------------------------------------------------------------ */
/* Reschedule lineage                                                  */
/* ------------------------------------------------------------------ */

/** One session as the lineage walk needs to see it. `Session` satisfies this. */
export interface LineageSession {
  id: string;
  status: AttemptSessionState;
  /** Scheduling's own link to the session this one was moved to. */
  rescheduledToId?: string;
}

/**
 * How far a make-up may be moved before the walk refuses to interpret the chain.
 *
 * A cap exists because the walk must terminate on ANY payload, including one a
 * hand-edited backup produced: it is deliberately far above any real chain (a
 * make-up moved thirty-two times is not a schedule, it is corrupt data).
 */
export const ATTEMPT_LINEAGE_MAX_MOVES = 32;

/**
 * Where a booked attempt's make-up stands NOW.
 *
 * `entrySessionId` is the session the ledger line recorded — a fact the
 * compensation domain owns and never rewrites. `effectiveSessionId` is the
 * session the make-up is on after every move: scheduling's `rescheduleSession`
 * cancels the row it moved and creates a replacement, so following
 * `rescheduledToId` to the end is what turns "moved" into "still booked".
 *
 * `chain` is the accepted path, entry first and effective last, so a reverse
 * lookup can answer for every session the booking has ever stood on.
 *
 * `resolvable` is the honest answer to "could the walk follow the booking to a
 * real row?". A chain that ends at a deleted row, or that cannot be walked at
 * all (a cycle, or more hops than `maxMoves`), is reported as unresolvable with
 * `effectiveStatus: "missing"` — never guessed at, and never silently treated as
 * a plain cancellation.
 */
export interface AttemptLineage {
  entrySessionId: string;
  effectiveSessionId: string;
  effectiveStatus: AttemptSessionState;
  /** How many reschedules were followed. `0` = the entry is still the make-up. */
  moves: number;
  resolvable: boolean;
  /** The accepted path, entry first. Never empty. */
  chain: string[];
}

/**
 * Resolves the make-up a booked attempt stands on, by walking Scheduling's own
 * reschedule links. PURE: the two lookups are passed in, so the rule is testable
 * with a map and the same code serves the demo store and a server.
 *
 * THE TWO LOOKUPS
 *
 *   - `lookup(sessionId)` — the session row itself (`Session` satisfies it);
 *   - `successorOf(sessionId)` — the session whose `rescheduledFromId` is that
 *     id, i.e. the replacement scheduling created when it moved it.
 *
 * A forward link is authoritative. The reverse relation is consulted only when
 * the row cannot stand as the make-up — it is gone, or it was cancelled and its
 * forward link went with it — which is how a lineage survives a hard delete of a
 * moved-from row. Because every replacement carries `rescheduledFromId`, that
 * lookup recovers the booking's continuation instead of reporting a debt that is
 * actually being honoured.
 */
export function attemptLineageOf(
  entrySessionId: string,
  lookup: (sessionId: string) => LineageSession | undefined,
  successorOf: (sessionId: string) => LineageSession | undefined,
  maxMoves: number = ATTEMPT_LINEAGE_MAX_MOVES,
): AttemptLineage {
  const visited = new Set<string>([entrySessionId]);
  let currentId = entrySessionId;
  let moves = 0;

  for (;;) {
    const row = lookup(currentId);

    const forward = row?.rescheduledToId;
    let nextId = forward !== undefined && forward.length > 0 ? forward : undefined;
    if (nextId === undefined && (row === undefined || row.status === "cancelled")) {
      nextId = successorOf(currentId)?.id;
    }

    if (nextId === undefined) {
      // The chain ends here: a live or plainly cancelled row, or nothing at all.
      return {
        entrySessionId,
        effectiveSessionId: currentId,
        effectiveStatus: row?.status ?? "missing",
        moves,
        resolvable: row !== undefined,
        chain: [...visited],
      };
    }

    if (visited.has(nextId) || moves >= maxMoves) {
      // A cycle, or a chain this walk refuses to follow. Reported, not guessed:
      // the effective id stays the last ACCEPTED one, and the state says the
      // make-up could not be resolved.
      return {
        entrySessionId,
        effectiveSessionId: currentId,
        effectiveStatus: "missing",
        moves,
        resolvable: false,
        chain: [...visited],
      };
    }

    visited.add(nextId);
    currentId = nextId;
    moves += 1;
  }
}

/**
 * Is the attempt still able to fulfil the obligation?
 *
 * This is the domain's own definition of "live", in one place, because two rules
 * depend on it and they must not drift apart:
 *
 *   - `compensationStatusOf` reports `scheduled` rather than `required` exactly
 *     when this is true;
 *   - `schedule` refuses a second booking while this is true
 *     (`COMPENSATION_ALREADY_SCHEDULED`): an obligation has at most ONE live
 *     make-up, and a second booking is not a supersede.
 *
 * THE INPUT IS THE EFFECTIVE SESSION, never the attempt's entry session: a
 * reschedule is a MOVE, and moving the make-up must not read as cancelling it.
 * Callers resolve the lineage first (`attemptLineageOf`) and pass its
 * `effectiveStatus`.
 *
 * `cancelled` and `missing` are both NOT live — the owner's rule returns the
 * obligation to `required` when the make-up is cancelled, and a session that
 * cannot be resolved must never be reported as if the booking still stood. With
 * no attempt at all it is false: nothing is booked, so nothing is live.
 */
export function attemptIsLive(
  record: Pick<SessionCompensationRecord, "attempts">,
  currentSession: { status: AttemptSessionState } | undefined,
): boolean {
  if (record.attempts.length === 0) return false;
  const state = attemptStateOf(currentSession);
  return state !== "missing" && state !== "cancelled";
}

/**
 * The obligation's state, derived from the recorded facts plus the live state of
 * the current attempt's EFFECTIVE session (see `attemptLineageOf`).
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

  return { status: attemptIsLive(record, currentSession) ? "scheduled" : "required", attemptBroken: broken };
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
