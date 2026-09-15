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
 * `reopen` — cancelling an attempt returns the obligation to `required` by
 * derivation (see `derive.ts`), and re-booking is another `schedule` call
 * (DECISIONS D14).
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
