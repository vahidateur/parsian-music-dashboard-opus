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
 * current attempt is cancelled before completion, and that is a DERIVATION of the
 * attempt's live state (`derive.ts`), not a write. Re-booking is a second
 * `schedule` call — an operation the existing contract already expresses does not
 * get a new verb (DECISIONS D14).
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
   * scheduling repository and appends it to the attempt ledger. Refused when the
   * obligation is already completed.
   */
  schedule(id: string, input: ScheduleCompensationInput): Promise<SessionCompensation>;

  /**
   * Discharges the obligation. Requires a live (existing, not cancelled) current
   * attempt. Terminal.
   */
  complete(id: string, input: CompleteCompensationInput): Promise<SessionCompensation>;
}
