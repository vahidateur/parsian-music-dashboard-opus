import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { getClassRepository } from "../registry";
import { useDataVersion } from "../shared/dataVersion";
import { useResourceList } from "../shared/useResource";
import type { AcademyClass, ClassListParams, CreateClassInput, UpdateClassInput } from "./types";
import type { ClassRepository } from "./repository";

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

export interface ClassDetailState {
  class: AcademyClass | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Authoritative single-record lookup for deep-link / detail routes.
 *
 * I16: resolving a detail by scanning a capped list (per_page: 200) reports an
 * existing record beyond the first page as "not found". The owning repository
 * already exposes get(id) which is the authoritative lookup — this hook is
 * that lookup with loading/error/not-found distinguishable and with the same
 * dataVersion invalidation the list hook uses.
 *
 * F1 absorbed hardening: Classes deep-link get(id) authoritative beyond capped list.
 */
export function useClass(id: string | undefined, repository?: ClassRepository): ClassDetailState {
  const repo = useMemo(() => repository ?? getClassRepository(), [repository]);
  const dataVersion = useDataVersion();
  const [cls, setCls] = useState<AcademyClass | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!id) {
      setCls(undefined);
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
        setCls(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setError(normalized);
        setCls(undefined);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [repo, id, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { class: cls, loading, error, reload };
}
