/**
 * Learning-domain React hooks — F1 genuine.
 *
 * List reads go through `useResourceList` and the two student-scoped derived
 * reads (placement, eligibility, locked) go through `useDerived` below. Both carry the
 * key they answer and derive what they expose at render, so neither can publish
 * a previous query's records — which is what makes "change a student's level and
 * their library updates" work with no manual refresh, no duplicated state, and
 * no frame in which one student is shown another student's data. Cancellation,
 * stale-response rejection and the global invalidation bus are inherited from
 * those two boundaries, never reimplemented per hook.
 *
 * F1: added useLockedContent for N+1+ honest reason در سطح X باز می‌شود.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getLearningRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import type {
  EligibleContent,
  LearningContent,
  LearningContentListParams,
  LearningLevel,
  LearningLevelListParams,
  LearningProgram,
  LearningProgramListParams,
  LockedContent,
  StudentPlacement,
} from "./types";

export function usePrograms(params: LearningProgramListParams = {}): ListState<LearningProgram> {
  const loader = useCallback(
    (p: LearningProgramListParams, signal?: AbortSignal) => getLearningRepository().listPrograms(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export function useLevels(params: LearningLevelListParams = {}): ListState<LearningLevel> {
  const loader = useCallback(
    (p: LearningLevelListParams, signal?: AbortSignal) => getLearningRepository().listLevels(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export function useLearningContent(params: LearningContentListParams = {}): ListState<LearningContent> {
  const loader = useCallback(
    (p: LearningContentListParams, signal?: AbortSignal) => getLearningRepository().listContent(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

interface SingleState<T> {
  data: T;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Shared loader for the two non-list learning reads (placement, eligibility).
 *
 * Same lifecycle contract as `useResourceList` — subscribe to the data version,
 * ignore stale resolutions — but for a value that is not a `Page`.
 */
interface DerivedState<T> {
  /**
   * The key this state answers, as serialized by the caller's `deps`.
   *
   * Carrying it is what makes the invariant enforceable: without it the state
   * cannot say whose data it holds, so the render that first sees a new student
   * exposes the previous one's read (I13, Checkpoint 3A).
   */
  key: string;
  data: T;
  loading: boolean;
  error: ApiError | null;
}

function useDerived<T>(load: (signal?: AbortSignal) => Promise<T>, initial: T, deps: string): SingleState<T> {
  const dataVersion = useDataVersion();
  const [state, setState] = useState<DerivedState<T>>({ key: deps, data: initial, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    // A refetch of the SAME key — a data-version bump after any write, or
    // reload() — keeps the value in hand and only marks itself in flight, so a
    // write elsewhere in the app cannot blank this read. A genuinely NEW key
    // drops it: that value belongs to another student, and exposing it for one
    // frame is the defect, not a cosmetic flicker.
    setState((current) =>
      current.key === deps
        ? { ...current, loading: true }
        : { key: deps, data: initial, loading: true, error: null },
    );
    loader
      .current(controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setState({ key: deps, data: result, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        // Keep whatever data this key already had, as before: a failed refetch
        // reports the failure without discarding a value that is still this
        // student's.
        setState((current) =>
          current.key === deps ? { ...current, error: normalized, loading: false } : current,
        );
      })
      .finally(() => {
        if (ticket !== latest.current) return;
        setState((current) =>
          current.key === deps && current.loading ? { ...current, loading: false } : current,
        );
      });
    return () => controller.abort();
    // `deps` is a stable serialization of the caller's inputs, and `initial` is
    // a stable per-hook constant.
  }, [deps, nonce, dataVersion, initial]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Derived at render, not set in an effect: what this hook exposes must belong
  // to the key it is being asked about, so no committed frame can pair one
  // student with another student's placement or eligible content. The ticket
  // guard above discards a late RESPONSE; only this can prevent an
  // already-committed STATE from being read as the current student's.
  const answers = state.key === deps;
  return useMemo(
    () => ({
      data: answers ? state.data : initial,
      loading: !answers || state.loading,
      error: answers ? state.error : null,
      reload,
    }),
    [answers, state.data, state.loading, state.error, initial, reload],
  );
}

/** The student's current placement, or `undefined` when unplaced. */
export function useStudentPlacement(studentId: string | undefined): SingleState<StudentPlacement | undefined> {
  const load = useCallback(
    (signal?: AbortSignal) =>
      studentId ? getLearningRepository().getStudentPlacement(studentId, signal) : Promise.resolve(undefined),
    [studentId],
  );
  return useDerived<StudentPlacement | undefined>(load, undefined, studentId ?? "");
}

const NO_CONTENT: EligibleContent[] = [];
const NO_LOCKED: LockedContent[] = [];

/**
 * Content the student may currently open.
 *
 * Recomputed whenever the data version changes, which is what makes a level
 * change or a new content link appear here immediately.
 */
export function useEligibleContent(studentId: string | undefined): SingleState<EligibleContent[]> {
  const load = useCallback(
    (signal?: AbortSignal) =>
      studentId ? getLearningRepository().eligibleContent(studentId, signal) : Promise.resolve(NO_CONTENT),
    [studentId],
  );
  return useDerived<EligibleContent[]>(load, NO_CONTENT, studentId ?? "");
}

/**
 * F1: Content locked for N+1+ with honest reason در سطح X باز می‌شود.
 * Locked no preview/download — UI enforces.
 */
export function useLockedContent(studentId: string | undefined): SingleState<LockedContent[]> {
  const load = useCallback(
    (signal?: AbortSignal) =>
      studentId ? getLearningRepository().lockedContent(studentId, signal) : Promise.resolve(NO_LOCKED),
    [studentId],
  );
  return useDerived<LockedContent[]>(load, NO_LOCKED, studentId ? `${studentId}:locked` : "locked");
}
