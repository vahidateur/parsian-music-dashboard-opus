/**
 * Cross-domain search for the command palette.
 *
 * The palette used to read a hand-written `searchIndex` fixture, so records
 * created at runtime were undiscoverable and deleted ones still appeared. This
 * hook queries the actual repositories instead — one search index, derived
 * from the same data the rest of the app reads.
 *
 * There is deliberately no separate search store to keep in sync: results are
 * computed from repository reads, and the data-version bus re-runs them after
 * any write.
 *
 * BACKEND REQUIRED: in API mode this issues one list request per domain and
 * filters client-side, which is fine for an academy-sized dataset but will not
 * scale. Production should expose a single `GET /search?q=` endpoint and this
 * hook should call that instead — the palette itself would not change.
 */
import { useEffect, useMemo, useState } from "react";
import { instrumentLabel } from "@/data/academy";
import type { Target } from "@/data/academy";
import {
  getClassRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
} from "@/domains/registry";
import { useDataVersion } from "./dataVersion";

export type SearchResultKind = "student" | "teacher" | "class" | "room";

export interface DomainSearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  target: Target;
}

/** Per-kind cap so one domain cannot crowd out the others. */
const PER_KIND_LIMIT = 5;

export function useDomainSearch(query: string): {
  results: DomainSearchResult[];
  loading: boolean;
} {
  const dataVersion = useDataVersion();
  const trimmed = query.trim();
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const repositories = useMemo(
    () => ({
      students: getStudentRepository(),
      teachers: getTeacherRepository(),
      classes: getClassRepository(),
      rooms: getRoomRepository(),
    }),
    [],
  );

  useEffect(() => {
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    // `search` is part of every list contract, so the repository (or a future
    // backend) does the filtering; the extra client-side match only refines
    // ordering-independent fields like the instrument label.
    void Promise.all([
      repositories.students.list({ search: trimmed, per_page: PER_KIND_LIMIT }, controller.signal),
      repositories.teachers.list({ search: trimmed, per_page: PER_KIND_LIMIT }, controller.signal),
      repositories.classes.list({ search: trimmed, per_page: PER_KIND_LIMIT }, controller.signal),
      repositories.rooms.list({ search: trimmed, per_page: PER_KIND_LIMIT }, controller.signal),
    ])
      .then(([students, teachers, classes, rooms]) => {
        if (cancelled) return;
        const out: DomainSearchResult[] = [
          ...students.data.map((student) => ({
            id: `student-${student.id}`,
            kind: "student" as const,
            title: student.name,
            // Never put the national ID in a search subtitle (§30).
            subtitle: `${instrumentLabel[student.instrument]} · ${student.level}`,
            target: { view: "students", id: student.id } satisfies Target,
          })),
          ...teachers.data.map((teacher) => ({
            id: `teacher-${teacher.id}`,
            kind: "teacher" as const,
            title: teacher.name,
            subtitle: `${instrumentLabel[teacher.instrument]} · ${teacher.title}`,
            target: { view: "teachers", id: teacher.id } satisfies Target,
          })),
          ...classes.data.map((cls) => ({
            id: `class-${cls.id}`,
            kind: "class" as const,
            title: cls.title,
            subtitle: `${instrumentLabel[cls.instrument]} · ${cls.enrolled} از ${cls.capacity}`,
            target: { view: "classes", id: cls.id } satisfies Target,
          })),
          ...rooms.data.map((room) => ({
            id: `room-${room.id}`,
            kind: "room" as const,
            title: room.name,
            subtitle: `${room.kind} · ظرفیت ${room.capacity}`,
            target: { view: "settings", filter: "operations" } satisfies Target,
          })),
        ];
        setResults(out);
      })
      .catch(() => {
        // A failed search shows no results rather than a stale list; the
        // palette's other groups (navigation, actions) still work.
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trimmed, dataVersion, repositories]);

  return { results, loading };
}
