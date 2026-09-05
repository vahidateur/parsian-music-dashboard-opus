import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { emptyPage, type Page } from "@/api/types";

/**
 * Shared list-loading hook.
 *
 * Every domain list needs the same behaviour: load on param change, cancel the
 * in-flight request, ignore stale responses, expose loading/error, and allow a
 * manual reload. Implementing it once keeps the domain hooks to their own
 * vocabulary rather than five copies of this logic.
 */
export interface ListState<T> {
  page: Page<T>;
  items: T[];
  total: number;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function useResourceList<T, P>(
  loader: (params: P, signal?: AbortSignal) => Promise<Page<T>>,
  params: P,
  /** Bump to force a refetch after a mutation elsewhere. */
  revision = 0,
): ListState<T> {
  const key = JSON.stringify(params ?? {});
  const [page, setPage] = useState<Page<T>>(() => emptyPage<T>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const load = useRef(loader);
  load.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    load
      .current(JSON.parse(key) as P, controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setPage(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [key, nonce, revision]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(
    () => ({ page, items: page.data, total: page.meta.total, loading, error, reload }),
    [page, loading, error, reload],
  );
}
