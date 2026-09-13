/**
 * Attendance hooks.
 *
 * `useSessionAttendance` is the one a register screen needs: it returns the
 * derived roster already joined with whatever marks exist, from a single
 * repository read. Composing it from a roster hook plus a records hook would
 * let the two arrive at different moments and render a student as unmarked
 * when their mark had in fact just loaded.
 *
 * Every list call passes an explicit `per_page`; correction history in
 * particular grows without bound and must never be fetched whole.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getAttendanceRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import type {
  AttendanceCorrection,
  AttendanceListParams,
  AttendanceRecord,
  CorrectionListParams,
  SessionAttendance,
} from "./types";

/** Raw attendance rows. Prefer `useSessionAttendance` for a register view. */
export function useAttendanceRecords(params: AttendanceListParams): ListState<AttendanceRecord> {
  const loader = useCallback(
    (p: AttendanceListParams, signal?: AbortSignal) => getAttendanceRepository().list(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

/**
 * Correction history, newest first.
 *
 * Paginated by design: this is an append-only audit trail, so it only ever
 * grows and must never be read in full.
 */
export function useAttendanceCorrections(
  params: CorrectionListParams,
): ListState<AttendanceCorrection> {
  const loader = useCallback(
    (p: CorrectionListParams, signal?: AbortSignal) =>
      getAttendanceRepository().listCorrections(p, signal),
    [],
  );
  return useResourceList(loader, params);
}

export interface SessionAttendanceState {
  attendance: SessionAttendance | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * The register for one session: derived roster joined with existing marks.
 *
 * Cancels in flight on unmount and ignores stale responses, so moving quickly
 * between sessions cannot paint the previous session's register.
 *
 * Refreshes on every `dataVersion` bump, which is how recording a mark, saving
 * a bulk register or applying a correction all reflect immediately without the
 * caller wiring anything.
 */
export function useSessionAttendance(sessionId: string | undefined): SessionAttendanceState {
  const dataVersion = useDataVersion();
  const [attendance, setAttendance] = useState<SessionAttendance | undefined>(undefined);
  const [loading, setLoading] = useState(sessionId !== undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const ticket = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setAttendance(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const mine = ++ticket.current;
    setLoading(true);

    getAttendanceRepository()
      .sessionAttendance(sessionId, controller.signal)
      .then((result) => {
        if (mine !== ticket.current) return;
        setAttendance(result);
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
  }, [sessionId, dataVersion, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(
    () => ({ attendance, loading, error, reload }),
    [attendance, loading, error, reload],
  );
}
