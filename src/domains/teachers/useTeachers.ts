import { useCallback, useMemo, useState } from "react";
import { getTeacherRepository } from "../registry";
import { useResourceList } from "../shared/useResource";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";

/**
 * Teacher list + mutations. The view never learns whether the demo or the API
 * repository answered; both satisfy `TeacherRepository`.
 */
export function useTeachers(params: TeacherListParams = {}) {
  const [revision, setRevision] = useState(0);
  const repository = useMemo(() => getTeacherRepository(), []);
  const list = useResourceList<Teacher, TeacherListParams>(
    (p, signal) => repository.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const create = useCallback(
    async (input: CreateTeacherInput) => {
      const created = await repository.create(input);
      refresh();
      return created;
    },
    [repository, refresh],
  );
  const update = useCallback(
    async (id: string, input: UpdateTeacherInput) => {
      const updated = await repository.update(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      await repository.delete(id);
      refresh();
    },
    [repository, refresh],
  );

  return { ...list, create, update, remove, refresh };
}
