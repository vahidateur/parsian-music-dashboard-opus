import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { emptyPage, type Page } from "@/api/types";
import { useDataVersion } from "./dataVersion";

/**
 * Shared list-loading hook.
 *
 * Every domain list needs the same behaviour: load on param change, cancel the
 * in-flight request, ignore stale responses, expose loading/error, and allow a
 * manual reload. Implementing it once keeps the domain hooks to their own
 * vocabulary rather than five copies of this logic.
 *
 * THE INVARIANT (OPEN_ITEMS I13)
 *
 *   A list exposes either records belonging to its current params, or an
 *   explicit in-flight/empty state appropriate to those params. It never
 *   exposes records belonging to a different query.
 *
 * `loading` used to be set inside the effect, so the render that first saw a new
 * `key` still returned the *previous* key's page with `loading === false` — one
 * committed frame with no in-flight marker of any kind, in which a row control
 * could target a record belonging to another query (a delete offered under one
 * album that destroyed another album's image; a level row under one program's
 * heading that deleted another program's level). Waiting for a marker could not
 * catch it, because there was no marker to wait for.
 *
 * So the state now carries the query identity it answers, and what the hook
 * exposes is **derived at render** from `state.key === key` rather than set in
 * an effect. A frame can then no longer disagree with its own params: the very
 * render that changes the params also reports `loading: true` and no rows.
 *
 * A refetch of the SAME key deliberately keeps its rows. Every persisted write
 * anywhere bumps the global data version, so emptying on each effect run would
 * blank every list in the product after any mutation — the distinction between
 * "another query" and "this query again" is the whole of the fix.
 */
/**
 * Forces a caller to state its page size.
 *
 * `ListParams.per_page` is optional across the whole API, so omitting it
 * silently falls back to `DEFAULT_PER_PAGE` (25) and quietly truncates the
 * result — a calendar would render three weeks of a term and look correct.
 * Wrapping a params type in `Paged` turns that into a compile error at the
 * call site, without changing the shared `ListParams` contract or any
 * existing hook that has not opted in.
 */
export type Paged<P> = P & { per_page: number };

export interface ListState<T> {
  page: Page<T>;
  items: T[];
  total: number;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * The page plus the identity of the query that produced it.
 *
 * `key` is what makes the invariant checkable at render time: a page that
 * answers a different key is not this query's page, and must not be exposed as
 * one — not even behind an in-flight marker.
 */
interface ResourceState<T> {
  key: string;
  page: Page<T>;
  loading: boolean;
  error: ApiError | null;
}

export function useResourceList<T, P>(
  loader: (params: P, signal?: AbortSignal) => Promise<Page<T>>,
  params: P,
  /** Bump to force a refetch after a mutation elsewhere. */
  revision = 0,
): ListState<T> {
  // Any persisted write anywhere bumps the data version, so a list that shows
  // data touched by another domain refreshes without cross-view coupling.
  const dataVersion = useDataVersion();
  const key = JSON.stringify(params ?? {});
  const [state, setState] = useState<ResourceState<T>>(() => ({
    key,
    page: emptyPage<T>(),
    loading: true,
    error: null,
  }));
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const load = useRef(loader);
  load.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    // Another query's answer is dropped; this query's answer is kept while it
    // refreshes. See the invariant above — this branch is the whole of it.
    setState((current) =>
      current.key === key
        ? { ...current, loading: true }
        : { key, page: emptyPage<T>(), loading: true, error: null },
    );
    load
      .current(JSON.parse(key) as P, controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setState({ key, page: result, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setState((current) => ({ ...current, key, loading: false, error: normalized }));
      });
    return () => controller.abort();
  }, [key, nonce, revision, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => {
    const answers = state.key === key;
    const page = answers ? state.page : emptyPage<T>();
    return {
      page,
      items: page.data,
      total: page.meta.total,
      // Derived, not stored: the frame between a params change and the effect
      // above is in flight whether or not the effect has run yet.
      loading: !answers || state.loading,
      // A previous query's failure is not this query's failure.
      error: answers ? state.error : null,
      reload,
    };
  }, [state, key, reload]);
}
