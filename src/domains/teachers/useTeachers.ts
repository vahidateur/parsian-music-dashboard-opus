import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { getTeacherRepository } from "../registry";
import { useDataVersion } from "../shared/dataVersion";
import { useResourceList } from "../shared/useResource";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";
import type { TeacherRepository } from "./repository";

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

export interface TeacherDetailState {
  teacher: Teacher | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Authoritative single-record lookup for deep-link / detail routes.
 *
 * I16: same gap as Students — capped list scan reports existing beyond first
 * 200 as not-found. Uses owning repository's get(id).
 */
export function useTeacher(id: string | undefined, repository?: TeacherRepository): TeacherDetailState {
  const repo = useMemo(() => repository ?? getTeacherRepository(), [repository]);
  const dataVersion = useDataVersion();
  const [teacher, setTeacher] = useState<Teacher | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!id) {
      setTeacher(undefined);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    repo
      .get(id, controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setTeacher(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setError(normalized);
        setTeacher(undefined);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [repo, id, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { teacher, loading, error, reload };
}
