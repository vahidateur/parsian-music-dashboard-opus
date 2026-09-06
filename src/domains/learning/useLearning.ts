/**
 * Learning-domain React hooks.
 *
 * All of them go through `useResourceList`, so they inherit cancellation,
 * stale-response rejection and the global invalidation bus. That is what makes
 * "change a student's level and their library updates" work with no manual
 * refresh and no duplicated state.
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
function useDerived<T>(load: (signal?: AbortSignal) => Promise<T>, initial: T, deps: string): SingleState<T> {
  const dataVersion = useDataVersion();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    loader
      .current(controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setData(result);
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
    // `deps` is a stable serialization of the caller's inputs.
  }, [deps, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload]);
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
