import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { emptyPage, type Page } from "@/api/types";
import { getStudentRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import type { StudentRepository } from "./repository";
import type { Student, StudentListParams } from "./types";

/**
 * The single integration point views will use in the Students migration.
 * It hides the repository selection, loading/error state and cancellation, so
 * `Students.tsx` can drop its direct `@/data/records` import without any
 * change to markup or styling.
 */

export interface StudentListState {
  page: Page<Student>;
  students: Student[];
  total: number;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function useStudentList(params: StudentListParams = {}, repository?: StudentRepository): StudentListState {
  const repo = useMemo(() => repository ?? getStudentRepository(), [repository]);
  // Refresh when any domain writes (e.g. an enrollment changes a student's class).
  const dataVersion = useDataVersion();
  const key = JSON.stringify(params);
  const [page, setPage] = useState<Page<Student>>(() => emptyPage<Student>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    repo
      .list(JSON.parse(key) as StudentListParams, controller.signal)
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
  }, [repo, key, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { page, students: page.data, total: page.meta.total, loading, error, reload };
}

export interface StudentDetailState {
  student: Student | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Authoritative single-record lookup for deep-link / detail routes.
 *
 * I16: resolving a detail by scanning a capped list (`per_page: 200`) reports an
 * existing record beyond the first page as "not found". The owning repository
 * already exposes `get(id)` which is the authoritative lookup — this hook is
 * that lookup with loading/error/not-found distinguishable and with the same
 * dataVersion invalidation the list hook uses.
 */
export function useStudent(id: string | undefined, repository?: StudentRepository): StudentDetailState {
  const repo = useMemo(() => repository ?? getStudentRepository(), [repository]);
  const dataVersion = useDataVersion();
  const [student, setStudent] = useState<Student | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!id) {
      setStudent(undefined);
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
        setStudent(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setError(normalized);
        setStudent(undefined);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [repo, id, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { student, loading, error, reload };
}
