/**
 * Progress hooks.
 *
 * List hooks reuse `useResourceList`, so they refresh on the same global data
 * version as every other domain. `useStudentProgress` is a single derived read
 * rather than three list hooks, because the overview must be internally
 * consistent — assignments, insights and recommendations computed from one
 * snapshot of the log.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getProgressRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import type { StudentProgressOverview } from "./repository";
import type {
  AssignmentListParams,
  Piece,
  PieceAssignment,
  PieceListParams,
  ProgressEvent,
  ProgressEventListParams,
} from "./types";

export function usePieces(params: PieceListParams = {}): ListState<Piece> {
  const loader = useCallback(
    (p: PieceListParams, signal?: AbortSignal) => getProgressRepository().listPieces(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export function useAssignments(params: AssignmentListParams = {}): ListState<PieceAssignment> {
  const loader = useCallback(
    (p: AssignmentListParams, signal?: AbortSignal) => getProgressRepository().listAssignments(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export function useProgressEvents(params: ProgressEventListParams = {}): ListState<ProgressEvent> {
  const loader = useCallback(
    (p: ProgressEventListParams, signal?: AbortSignal) => getProgressRepository().listEvents(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export interface StudentProgressState {
  overview: StudentProgressOverview | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * The full progress picture for one student.
 *
 * Cancels in flight on unmount and ignores stale responses, so switching
 * quickly between students cannot paint the previous student's data.
 */
export function useStudentProgress(studentId: string | undefined): StudentProgressState {
  const dataVersion = useDataVersion();
  const [overview, setOverview] = useState<StudentProgressOverview | undefined>(undefined);
  const [loading, setLoading] = useState(studentId !== undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const ticket = useRef(0);

  useEffect(() => {
    if (!studentId) {
      setOverview(undefined);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const mine = ++ticket.current;
    setLoading(true);

    getProgressRepository()
      .studentOverview(studentId, controller.signal)
      .then((result) => {
        if (mine !== ticket.current) return;
        setOverview(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (mine !== ticket.current || normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (mine === ticket.current) setLoading(false);
      });

    return () => controller.abort();
  }, [studentId, dataVersion, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ overview, loading, error, reload }), [overview, loading, error, reload]);
}
