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
 * EVERY LIST CALL PASSES AN EXPLICIT `per_page`. A paginated `list()` is not a
 * lookup table — relying on the repository's default page size silently
 * truncates the dataset and turns real sessions into "not found". The
 * architecture boundary test enforces this.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getSchedulingRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import type {
  ConflictReport,
  GenerateInput,
  GenerationPlan,
  RosterEntry,
  Session,
  SessionCandidate,
  SessionListParams,
} from "./types";

/** Sessions matching the given filters, newest data on every version bump. */
export function useSessions(params: SessionListParams): ListState<Session> {
  const loader = useCallback(
    (p: SessionListParams, signal?: AbortSignal) => getSchedulingRepository().list(p, signal),
    [],
  );
  return useResourceList(loader, params);
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
 * Runs an async read, cancelling in flight and discarding stale responses.
 *
 * The ticket guard matters when a user clicks quickly between sessions: without
 * it a slow first response can land after a fast second one and paint the
 * wrong session's roster.
 */
function useDerivedRead<T>(
  run: ((signal: AbortSignal) => Promise<T>) | undefined,
  deps: readonly unknown[],
): DerivedState<T> {
  const dataVersion = useDataVersion();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(run !== undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const ticket = useRef(0);

  // Held in a ref so a caller passing an inline arrow does not re-run the
  // effect on every render; `deps` is the declared identity instead.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const current = runRef.current;
    if (!current) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const mine = ++ticket.current;
    setLoading(true);

    current(controller.signal)
      .then((result) => {
        if (mine !== ticket.current) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        // A cancelled request is not a failure the user should see.
        if (mine !== ticket.current || normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (mine === ticket.current) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dataVersion, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload]);
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
