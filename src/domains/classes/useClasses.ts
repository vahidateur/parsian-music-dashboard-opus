import { useCallback, useMemo, useState } from "react";
import { getClassRepository } from "../registry";
import { useResourceList } from "../shared/useResource";
import type { AcademyClass, ClassListParams, CreateClassInput, UpdateClassInput } from "./types";

/**
 * Class list + mutations, adapter-agnostic: the active repository is resolved
 * from the registry so the view works identically in demo and API mode.
 */
export function useClasses(params: ClassListParams = {}) {
  const [revision, setRevision] = useState(0);
  const repository = useMemo(() => getClassRepository(), []);
  const list = useResourceList<AcademyClass, ClassListParams>(
    (p, signal) => repository.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const create = useCallback(
    async (input: CreateClassInput) => {
      const created = await repository.create(input);
      refresh();
      return created;
    },
    [repository, refresh],
  );
  const update = useCallback(
    async (id: string, input: UpdateClassInput) => {
      const updated = await repository.update(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );

  return { ...list, create, update, refresh, repository };
}
