import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { emptyPage, type Page } from "@/api/types";
import { getStudentRepository } from "@/domains/registry";
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
  }, [repo, key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { page, students: page.data, total: page.meta.total, loading, error, reload };
}
