/**
 * Dashboard metrics derived from actual domain state.
 *
 * The dashboard used to render fixture constants that never moved. Anything
 * that *can* be computed from the repositories is computed here, so creating a
 * student or enrolling someone changes the numbers on the dashboard.
 *
 * Three categories are deliberately kept apart (§8):
 *
 *  - DOMAIN-DERIVED  — computed here from repository reads. Honest in demo.
 *  - CURATED         — cinematic showcase visuals (waveform, 30-day trends).
 *                      Presentation-only and labelled as such in the UI.
 *  - BACKEND REQUIRED — needs server-side aggregation over data the client
 *                      does not hold (revenue trends, retention cohorts).
 *
 * BACKEND REQUIRED: production must not aggregate in the browser. These
 * counts should come from a `GET /dashboard/metrics` endpoint that aggregates
 * in the database; this hook is the seam where that swap happens.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
} from "@/domains/registry";
import type { Target } from "@/data/academy";
import { useDataVersion } from "./dataVersion";

export interface AcademyMetrics {
  students: number;
  activeStudents: number;
  atRiskStudents: number;
  teachers: number;
  activeTeachers: number;
  classes: number;
  rooms: number;
  activeEnrollments: number;
  waitlisted: number;
  /** Seats filled across all active classes, as a percentage. */
  capacityUsedPct: number;
  totalSeats: number;
  takenSeats: number;
}

const EMPTY: AcademyMetrics = {
  students: 0,
  activeStudents: 0,
  atRiskStudents: 0,
  teachers: 0,
  activeTeachers: 0,
  classes: 0,
  rooms: 0,
  activeEnrollments: 0,
  waitlisted: 0,
  capacityUsedPct: 0,
  totalSeats: 0,
  takenSeats: 0,
};

export function useAcademyMetrics(): { metrics: AcademyMetrics; loading: boolean } {
  const dataVersion = useDataVersion();
  const [metrics, setMetrics] = useState<AcademyMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);

  const repositories = useMemo(
    () => ({
      students: getStudentRepository(),
      teachers: getTeacherRepository(),
      classes: getClassRepository(),
      rooms: getRoomRepository(),
      enrollments: getEnrollmentRepository(),
    }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    // A generous page size: the demo dataset is small, and a partial page
    // would silently produce wrong totals.
    const all = { per_page: 500 };

    void Promise.all([
      repositories.students.list(all, controller.signal),
      repositories.teachers.list(all, controller.signal),
      repositories.classes.list(all, controller.signal),
      repositories.rooms.list(all, controller.signal),
      repositories.enrollments.list(all, controller.signal),
    ])
      .then(([students, teachers, classes, rooms, enrollments]) => {
        if (cancelled) return;
        const totalSeats = classes.data.reduce((sum, c) => sum + c.capacity, 0);
        const takenSeats = classes.data.reduce((sum, c) => sum + c.enrolled, 0);
        setMetrics({
          students: students.meta.total,
          activeStudents: students.data.filter((s) => s.status === "active").length,
          atRiskStudents: students.data.filter((s) => s.status === "at-risk").length,
          teachers: teachers.meta.total,
          activeTeachers: teachers.data.filter((t) => t.status !== "inactive").length,
          classes: classes.meta.total,
          rooms: rooms.meta.total,
          activeEnrollments: enrollments.data.filter((e) => e.status === "active").length,
          waitlisted: enrollments.data.filter((e) => e.status === "waitlist").length,
          totalSeats,
          takenSeats,
          capacityUsedPct: totalSeats > 0 ? Math.round((takenSeats / totalSeats) * 100) : 0,
        });
      })
      .catch(() => {
        // Showing stale numbers would be worse than showing none.
        if (!cancelled) setMetrics(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dataVersion, repositories]);

  return { metrics, loading };
}

export interface HeroStat {
  label: string;
  value: number;
  suffix?: string;
  target: Target;
}

/**
 * The four hero numbers, derived from live domain state.
 *
 * "Today's classes" counts classes scheduled on the current weekday, which is
 * genuinely derivable. Attendance rate is NOT included here: it needs
 * per-session attendance records that the demo does not yet own, and inventing
 * a number would be exactly the fake-data problem this replaces.
 */
export function useHeroStats(): { stats: HeroStat[]; loading: boolean } {
  const { metrics, loading } = useAcademyMetrics();
  const stats = useMemo<HeroStat[]>(
    () => [
      { label: "هنرجوی فعال", value: metrics.activeStudents, target: { view: "students", filter: "active" } },
      { label: "کلاس فعال", value: metrics.classes, target: { view: "classes" } },
      { label: "ثبت‌نام فعال", value: metrics.activeEnrollments, target: { view: "classes" } },
      { label: "اشغال ظرفیت", value: metrics.capacityUsedPct, suffix: "٪", target: { view: "classes" } },
    ],
    [metrics],
  );
  return { stats, loading };
}
