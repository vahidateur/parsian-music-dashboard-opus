import { useCallback, useMemo, useState } from "react";
import { getEnrollmentRepository } from "../registry";
import { useResourceList } from "../shared/useResource";
import type { CreateEnrollmentInput, Enrollment, EnrollmentListParams, UpdateEnrollmentInput } from "./types";

/**
 * Enrollment list + mutations, adapter-agnostic: the active repository is resolved
 * from the registry so the view works identically in demo and API mode.
 */
export function useEnrollments(params: EnrollmentListParams = {}) {
  const [revision, setRevision] = useState(0);
  const repository = useMemo(() => getEnrollmentRepository(), []);
  const list = useResourceList<Enrollment, EnrollmentListParams>(
    (p, signal) => repository.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  /** Domain verb: seat a student in a class (may land on the waitlist). */
  const enroll = useCallback(
    async (input: CreateEnrollmentInput) => {
      const created = await repository.enroll(input);
      refresh();
      return created;
    },
    [repository, refresh],
  );

  /** Domain verb: release a seat; promotion of the waitlist is the repository's job. */
  const withdraw = useCallback(
    async (id: string) => {
      const result = await repository.withdraw(id);
      refresh();
      return result;
    },
    [repository, refresh],
  );
  const update = useCallback(
    async (id: string, input: UpdateEnrollmentInput) => {
      const updated = await repository.update(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );

  return { ...list, enroll, withdraw, update, refresh, repository };
}
