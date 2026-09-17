import { useCallback, useMemo, useState } from "react";
import { getCompensationRepository } from "../registry";
import { useResourceList } from "../shared/useResource";
import type {
  CompensationListParams,
  CompleteCompensationInput,
  RegisterCompensationInput,
  ScheduleCompensationInput,
  SessionCompensation,
} from "./types";

/**
 * Compensation list + the three verbs, adapter-agnostic: the active repository is
 * resolved from the registry, so this hook behaves identically in demo and API
 * mode.
 *
 * THE WRITE RULE THIS HOOK INHERITS (M2, unchanged)
 *
 * Each wrapper awaits the repository and re-reads only AFTER it resolved. Nothing
 * is written optimistically and nothing is announced here: the caller reports
 * what the returned record actually says, and a refusal reaches it as the
 * repository's own `ApiError`, verbatim.
 *
 * The three verbs are the domain's whole write surface: registering the
 * obligation, booking an attempt, and discharging it. There is deliberately no
 * `reopen` — the obligation returns to `required` by DERIVATION (see `derive.ts`)
 * and re-booking is another `schedule` call (DECISIONS D14).
 *
 * WHICH CANCELLATION REOPENS IT, AND WHICH DOES NOT
 *
 * A booking is read as a LINEAGE, not as a row. Moving a make-up with the
 * scheduling domain's `rescheduleSession` cancels the row it moved FROM and
 * creates a linked replacement — so a moved-from session is `cancelled` as the
 * NORMAL state of a booking that has been moved, and cancelling it (or finding it
 * cancelled) does NOT return the obligation to `required`. The make-up stays
 * LIVE on the session it was moved TO, a second booking stays refused, and the
 * obligation stays completable.
 *
 * Only cancelling or deleting the EFFECTIVE session — the END of the chain —
 * returns the obligation to `required` and makes re-booking legal. A screen must
 * therefore act on `currentAttempt.sessionId` (the effective session) and must
 * never treat `currentAttempt.bookedSessionId` (the session the ledger line
 * recorded) as the make-up for a cancel, reschedule or completion decision.
 *
 * THE CALLER SUPPLIES THE ACTOR, AND THE DOMAIN CHECKS IT
 *
 * Each of the three writes takes `actor: { userId, permissions }`; a screen
 * builds it from `useAuth()` (`{ userId: user.id, permissions }`). The repository
 * refuses an actor without `schedule.write` before it reads anything, so this
 * hook cannot be talked into a write by a role that may not perform one. The
 * permissions are the caller's statement — the browser is where they are known —
 * so the server still re-derives them from the token (see the domain README, §10).
 */
export function useCompensations(params: CompensationListParams = {}) {
  const [revision, setRevision] = useState(0);
  const repository = useMemo(() => getCompensationRepository(), []);
  const list = useResourceList<SessionCompensation, CompensationListParams>(
    (p, signal) => repository.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  /** Domain verb: register the obligation for a cancelled one-to-one session. */
  const register = useCallback(
    async (input: RegisterCompensationInput) => {
      const created = await repository.register(input);
      refresh();
      return created;
    },
    [repository, refresh],
  );

  /** Domain verb: book the make-up — a real session, created by scheduling. */
  const schedule = useCallback(
    async (id: string, input: ScheduleCompensationInput) => {
      const updated = await repository.schedule(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );

  /** Domain verb: discharge the obligation. Terminal. */
  const complete = useCallback(
    async (id: string, input: CompleteCompensationInput) => {
      const updated = await repository.complete(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );

  return { ...list, register, schedule, complete, refresh, repository };
}
