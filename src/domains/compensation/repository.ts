import type { Page } from "@/api/types";
import type {
  CompensationListParams,
  CompleteCompensationInput,
  RegisterCompensationInput,
  ScheduleCompensationInput,
  SessionCompensation,
} from "./types";

/**
 * Compensation repository — the obligation and its bookings.
 *
 * FIVE VERBS, AND NO MORE
 *
 * `list`, `get`, `register`, `schedule`, `complete`. There is deliberately no
 * `reopen`: the owner's rule returns an obligation to `required` when its
 * current make-up is cancelled before completion, and that is a DERIVATION of the
 * attempt's live state (`derive.ts`), not a write. Re-booking is a second
 * `schedule` call — an operation the existing contract already expresses does not
 * get a new verb (DECISIONS D14) — and it is allowed exactly when the current
 * make-up is no longer live, i.e. when the end of its reschedule lineage is
 * cancelled or cannot be resolved.
 *
 * AT MOST ONE LIVE MAKE-UP PER OBLIGATION
 *
 * `schedule` refuses to book while the obligation's current make-up is live
 * (`ALREADY_SCHEDULED`), and `complete` refuses to discharge one that is not
 * (`NOT_SCHEDULED`). There is no supersede: a second booking never replaces,
 * re-points or invalidates the first one, and this domain never cancels,
 * reschedules or edits a session — not even to tidy up after itself.
 *
 * MOVING A MAKE-UP IS SCHEDULING'S CORRECTION, AND THE DERIVATION FOLLOWS IT
 *
 * `rescheduleSession` is the move path (an operator moves the booked make-up on
 * the calendar, with its reason and its `rescheduledFromId`/`rescheduledToId`
 * chain). Scheduling implements a move as "cancel the row, create a linked
 * replacement" — its audit device, and NOT a statement that the lesson was
 * called off. So this domain reads a move as a continuation:
 *
 *   - an attempt records a booking ACT, and the session its ledger line names is
 *     the ENTRY of that booking's reschedule lineage;
 *   - the make-up the obligation stands on is the EFFECTIVE session: the end of
 *     the chain reachable from the entry through `rescheduledToId`, with the
 *     reverse `rescheduledFromId` relation as the fallback when a moved-from row
 *     has been deleted;
 *   - `status`, `attemptBroken`, the `ALREADY_SCHEDULED` refusal and the
 *     `NOT_SCHEDULED` gate are all evaluated on the effective session, so moving
 *     a make-up keeps the obligation `scheduled`, keeps it completable, and keeps
 *     the second-booking refusal in force;
 *   - the ledger is NEVER re-pointed: a line keeps naming the session it created,
 *     and the read model reports both ids (`sessionId` = effective,
 *     `bookedSessionId` = the ledger's entry) and how many moves separate them;
 *   - a chain that cannot be resolved (deleted rows, a cycle, an absurd length) is
 *     reported through the derived fields (`attemptBroken`, `needsAttention`)
 *     rather than guessed at.
 *
 * WHILE A LIVE MAKE-UP EXISTS, AND A TERMINAL OBLIGATION ACQUIRES NOTHING
 *
 * Implementations MUST make `schedule` and `complete` observe each other's
 * committed state, so that two concurrent callers cannot both book (one gets the
 * session, the other is refused) and a booking racing a discharge resolves in a
 * fixed order: either the discharge sees the appended attempt, or the booking is
 * refused because the obligation is terminal. A discharged obligation must never
 * acquire an attempt afterwards, and no session may be created that no attempt
 * references. The demo adapter does this with one serialized section per
 * obligation; a server gets the same property from a transaction or an
 * optimistic-concurrency retry.
 *
 * SERVER-SIDE TRANSACTIONALITY AND IDEMPOTENCY ARE THE SERVER'S
 *
 * Everything above is enforced in-process for one event loop. Two browsers share
 * neither this event loop nor this memory, so a server MUST hold the invariant
 * itself: `schedule` as a transaction over the ledger and the session write, a
 * unique key that makes a double submit idempotent, and the authorization
 * re-derived from the token rather than trusted from the payload. A client-side
 * check cannot stand in for any of that, and this contract does not pretend it
 * does.
 *
 * WHAT THIS REPOSITORY DOES NOT DO
 *
 *   - **It does not own sessions.** `schedule` creates the make-up through the
 *     SCHEDULING repository's own `create()` verb, so shape validation, the
 *     duration bounds, the hard/warning conflict check and `origin: "manual"`
 *     stay in the one place that already owns them. A second session model or a
 *     second overlap rule here would eventually disagree with the engine that
 *     enforces it.
 *   - **It does not touch cancellation.** `cancelSession`, `rescheduleSession`,
 *     `update` and `delete` are unchanged by this domain, which never calls them
 *     and never needs to: cancelling an attempt is what the operator already does
 *     on the calendar, and the obligation reacts on read.
 *   - **It does not auto-register anything.** Cancelling a session creates no
 *     obligation; `register` is an explicit act by a person.
 *   - **It does not notify anyone.** No SMS, no provider, no message row.
 *
 * THE THREE WRITES ARE PROTECTED OPERATIONS
 *
 * `register`, `schedule` and `complete` each take an actor and refuse one that
 * does not hold **`schedule.write`** (`COMPENSATION_FORBIDDEN`): the permission
 * the scheduling domain already owns, because a make-up IS a session write. No
 * compensation-specific permission exists. The check is the first statement of
 * each verb, so a refused caller learns nothing about the records it named.
 *
 * Implementations MUST refuse an unauthorized actor. They must **not** trust the
 * permissions a client sends: a server implementation re-derives the actor and
 * its permissions from the session token, because the permission list travels
 * with the call only because the browser is where it is known. Reading is not
 * gated here — `list` and `get` are governed by the caller's own view permission.
 *
 * UNIQUENESS ACROSS CLIENTS IS THE SERVER'S
 *
 * The lifetime rule below is re-checked immediately before the write, with no
 * suspension point between the check and the write, so one event loop cannot
 * interleave two registrations. Two browsers do not share an event loop: a server
 * MUST enforce the same rule as a unique constraint or transaction. A client-side
 * re-check cannot stand in for it.
 *
 * DUPLICATE PROTECTION IS AN INVARIANT, NOT A CONVENTION
 *
 * At most ONE obligation may exist per `(originalSessionId, studentId)`, for the
 * lifetime of the pair — an open one refuses a second registration
 * (`ALREADY_OPEN`) and a completed one refuses it too (`ALREADY_SETTLED`).
 * `register` therefore always fails loudly and is never an upsert. The unit of
 * uniqueness is the pair rather than the session alone because the contract's own
 * history requirement implies it: a per-session unit would let a discharged
 * obligation be re-created as if it had never been honoured.
 */
export interface CompensationRepository {
  /**
   * Obligations, newest requirement first, filtered by the typed link, the
   * frozen student, the derived status, or the current attempt's session.
   */
  list(params?: CompensationListParams, signal?: AbortSignal): Promise<Page<SessionCompensation>>;

  /** One obligation, with its derived status and attendance evidence. */
  get(id: string, signal?: AbortSignal): Promise<SessionCompensation>;

  /**
   * Registers the obligation. Refused unless the original session is `cancelled`
   * and its class is `kind: "private"`, the original's derived roster yields
   * exactly the named student, no obligation exists for the pair, a reason is
   * present, and an actor is named.
   */
  register(input: RegisterCompensationInput): Promise<SessionCompensation>;

  /**
   * Books the make-up: creates an ordinary manual `Session` through the
   * scheduling repository and appends it to the attempt ledger.
   *
   * Refused when the obligation is already completed (`ALREADY_SETTLED`) or when
   * its current make-up is still live (`ALREADY_SCHEDULED`) — evaluated on the
   * EFFECTIVE session, so a make-up that was moved still refuses a new booking.
   * Nothing is created on a refusal: the make-up a caller may already have been
   * promised is never cancelled, superseded or re-pointed, and the only way to
   * move it is the scheduling domain's own `rescheduleSession`.
   */
  schedule(id: string, input: ScheduleCompensationInput): Promise<SessionCompensation>;

  /**
   * Discharges the obligation. Requires a live EFFECTIVE session — a make-up that
   * exists, has not been cancelled, and was not left unresolvable by a broken
   * chain, including one that a reschedule moved to another slot. Terminal.
   *
   * Shares its critical section with `schedule`, so a discharge and a booking of
   * the same obligation cannot interleave: whatever order they settle in, the
   * discharge is decided against a state the booking has already committed.
   */
  complete(id: string, input: CompleteCompensationInput): Promise<SessionCompensation>;
}
