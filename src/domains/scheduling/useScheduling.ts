/**
 * Scheduling hooks.
 *
 * List hooks reuse `useResourceList`, so they refresh on the same global data
 * version as every other domain: recording attendance or moving a session
 * refreshes the calendar without any cross-view coupling.
 *
 * The derived reads (`useSessionRoster`, `useGenerationPreview`) are single
 * consistent reads rather than compositions of several list hooks, because a
 * roster assembled from two independently-timed fetches can disagree with
 * itself mid-render.
 *
 * EVERY LIST CALL STATES AN EXPLICIT `per_page`. A paginated `list()` is not a
 * lookup table — relying on the repository's default page size silently
 * truncates the dataset and turns real sessions into "not found", and a calendar
 * is exactly the surface where three weeks of a term still looks like a term.
 * `useSessions` therefore takes `Paged<SessionListParams>`, so omitting the page
 * size is a **compile error at the call site** rather than a review habit, and
 * `src/__tests__/architectureBoundaries.test.ts` pins both the signature and the
 * call sites.
 *
 * What `Paged` guarantees is that the caller *states* a ceiling — not that the
 * ceiling is high enough. A read that means "everything" still stops at whatever
 * number it names (OPEN_ITEMS I16), which is why a window read here is bounded by
 * `from`/`to` rather than by a large page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getSchedulingRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState, type Paged } from "@/domains/shared/useResource";
import type {
  ConflictReport,
  GenerateInput,
  GenerationPlan,
  RosterEntry,
  Session,
  SessionCandidate,
  SessionListParams,
} from "./types";

/**
 * Sessions matching the given filters, newest data on every version bump.
 *
 * `per_page` is required at the type level (see `Paged`): a session list is a
 * window over a term, and the repository's default page size would silently
 * truncate it.
 */
export function useSessions(params: Paged<SessionListParams>): ListState<Session> {
  const loader = useCallback(
    (p: SessionListParams, signal?: AbortSignal) => getSchedulingRepository().list(p, signal),
    [],
  );
  return useResourceList<Session, SessionListParams>(loader, params);
}

/* ------------------------------------------------------------------ */
/* Derived reads                                                       */
/* ------------------------------------------------------------------ */

/**
 * Shared shape for the one-shot derived reads below.
 *
 * `data` is `undefined` until the first successful load, which is distinct
 * from "loaded and empty" — a roster of zero students is a real answer.
 */
export interface DerivedState<T> {
  data: T | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * The value plus the identity of the query that produced it.
 *
 * Carrying the key is what makes the invariant enforceable: without it the
 * state cannot say whose value it holds, so the render that first sees a new
 * session exposes the previous session's read (OPEN_ITEMS I13, Checkpoint 3B —
 * the same defect Checkpoint 1 closed in `useResourceList` and Checkpoint 3A
 * closed in learning's `useDerived`).
 */
interface DerivedReaderState<T> {
  key: string;
  data: T | undefined;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Runs an async read, cancelling in flight and discarding stale responses.
 *
 * TWO guards, because they answer two different questions:
 *
 *   - the **ticket** discards a late RESPONSE. A user clicking quickly between
 *     sessions must not have the slow first answer land after the fast second
 *     one and paint the wrong session's roster;
 *   - the **key** retracts an already-committed STATE. `loading` used to be set
 *     inside the effect, so the render that first saw a new key still returned
 *     the PREVIOUS key's data and error with `loading === false` — one committed
 *     frame in which a roster of one session's students is on screen under
 *     another session's heading, with no in-flight marker to wait for. A ticket
 *     cannot help there: nothing has resolved yet.
 *
 * So what the hook exposes is derived at render from `state.key === key`, and a
 * frame can no longer disagree with its own parameters. A refetch of the SAME
 * key deliberately keeps its value: every persisted write anywhere bumps the
 * global data version, so emptying on each effect run would blank the roster
 * after any mutation in the app.
 *
 * When there is nothing to run — no session selected, or a dialog holding the
 * preview until a range is chosen — the hook is NOT in flight. Reporting
 * `loading` there would promise an answer nobody asked for.
 */
function useDerivedRead<T>(
  run: ((signal: AbortSignal) => Promise<T>) | undefined,
  deps: readonly unknown[],
): DerivedState<T> {
  const dataVersion = useDataVersion();
  /** The query's identity, serialized from the caller's declared deps. */
  const key = JSON.stringify(deps);
  const [state, setState] = useState<DerivedReaderState<T>>(() => ({
    key,
    data: undefined,
    loading: run !== undefined,
    error: null,
  }));
  const [nonce, setNonce] = useState(0);
  const ticket = useRef(0);

  // Held in a ref so a caller passing an inline arrow does not re-run the
  // effect on every render; `deps` is the declared identity instead.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const current = runRef.current;
    if (!current) {
      // Nothing was asked for: no value, no failure, and nothing in flight.
      setState((previous) =>
        previous.key === key && previous.data === undefined && !previous.loading && previous.error === null
          ? previous
          : { key, data: undefined, loading: false, error: null },
      );
      return;
    }

    const controller = new AbortController();
    const mine = ++ticket.current;
    // A refetch of the SAME key keeps the value in hand and only marks itself in
    // flight. A genuinely NEW key drops it: that value belongs to another query.
    setState((previous) =>
      previous.key === key
        ? { ...previous, loading: true }
        : { key, data: undefined, loading: true, error: null },
    );

    current(controller.signal)
      .then((result) => {
        if (mine !== ticket.current) return;
        setState({ key, data: result, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        // A cancelled request is not a failure the user should see.
        if (mine !== ticket.current || normalized.kind === "cancelled") return;
        // Keep whatever this key already had: a failed refetch reports the
        // failure without discarding a value that is still this query's.
        setState((previous) =>
          previous.key === key ? { ...previous, error: normalized, loading: false } : previous,
        );
      })
      .finally(() => {
        if (mine !== ticket.current) return;
        setState((previous) =>
          previous.key === key && previous.loading ? { ...previous, loading: false } : previous,
        );
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dataVersion, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Derived at render, not set in an effect: the ticket guard above discards a
  // late RESPONSE, and only this can stop an already-committed STATE from being
  // read as the current query's.
  const answers = run !== undefined && state.key === key;
  return useMemo(
    () => ({
      data: answers ? state.data : undefined,
      loading: answers ? state.loading : run !== undefined,
      error: answers ? state.error : null,
      reload,
    }),
    [answers, run, state.data, state.loading, state.error, reload],
  );
}

/**
 * Students expected at a session, derived from Enrollment at the session date.
 *
 * Pass `undefined` when no session is selected; the hook then reports
 * not-loading with no data rather than fetching.
 */
export function useSessionRoster(sessionId: string | undefined): DerivedState<RosterEntry[]> {
  const run = useMemo(
    () =>
      sessionId
        ? (signal: AbortSignal) => getSchedulingRepository().sessionRoster(sessionId, signal)
        : undefined,
    [sessionId],
  );
  return useDerivedRead(run, [sessionId]);
}

/**
 * The generation plan for a window. **Never writes.**
 *
 * Backed by `previewGeneration`, so a component can show "۱۲ ایجاد · ۳ بدون
 * تغییر · ۲ محافظت‌شده" before the user commits to anything. `enabled` lets a
 * dialog hold the request until the user has actually chosen a range.
 */
export function useGenerationPreview(
  input: GenerateInput | undefined,
  enabled = true,
): DerivedState<GenerationPlan> {
  const key = input ? `${input.classId}|${input.from}|${input.to}|${input.confirmUpdates ?? false}` : "";
  const run = useMemo(
    () =>
      input && enabled
        ? (signal: AbortSignal) => getSchedulingRepository().previewGeneration(input, signal)
        : undefined,
    // `key` captures the input's identity; the object itself is often inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled],
  );
  return useDerivedRead(run, [key, enabled]);
}

/**
 * Live conflict feedback for a candidate session.
 *
 * Used by the session form so a clash is visible before submitting rather than
 * arriving as a rejection afterwards. The repository remains the authority —
 * this is a preview of the same computation.
 */
export function useConflictCheck(candidate: SessionCandidate | undefined): DerivedState<ConflictReport> {
  const key = candidate
    ? [
        candidate.id ?? "",
        candidate.classId,
        candidate.date,
        candidate.startTime,
        candidate.endTime,
        candidate.teacherId,
        candidate.roomId,
      ].join("|")
    : "";

  const run = useMemo(
    () =>
      candidate
        ? (signal: AbortSignal) => getSchedulingRepository().checkConflicts(candidate, signal)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return useDerivedRead(run, [key]);
}
