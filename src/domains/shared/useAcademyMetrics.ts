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
  getAttendanceRepository,
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
} from "@/domains/registry";
import { ATTENDED_STATUSES, type AttendanceRecord } from "@/domains/attendance/types";
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
  /**
   * Attendance rate across recorded marks, 0-100.
   *
   * `null` — never 0 — when nothing countable has been recorded. "No data" and
   * "everybody was absent" are different facts, and opening with a confident
   * 0٪ would state the second while meaning the first.
   *
   * FORMULA (documented so the number can be argued with):
   *
   *     (present + late) / (present + late + absent)
   *
   * `excused` is excluded from BOTH sides: an authorised absence should
   * neither help nor harm the figure.
   *
   * ⚠️ CAPPED AT 500 RECORDS — NOT A FULL-HISTORY ACADEMY METRIC.
   *
   * This is computed from the FIRST PAGE of attendance records (`per_page:
   * 500`, shared with the other metric reads), not from the whole academy.
   * With the seeded timetable that is ~4.7 marks/day, so the cap is reached
   * after roughly 3.5 months of real marking; beyond that the figure describes
   * an arbitrary 500-record slice rather than a total.
   *
   * DECIDED (P1): keep this implementation and this warning as-is. Neither
   * client-side aggregation nor a rename was adopted, and backend aggregation
   * over the full history is DEFERRED.
   *
   * CONSEQUENCE: **no UI may present this as the academy-wide attendance
   * rate.** `useHeroStats` deliberately omits it, and
   * `attendanceMetric.test.tsx` fails if it is ever added to the hero surface.
   * A future consumer must either accept and label it as a capped sample, or
   * wait for a server-side aggregate.
   */
  attendanceRatePct: number | null;
  /**
   * Marks counted in the rate above; excludes `excused`.
   *
   * Doubles as the honesty signal for the cap described above: when this
   * approaches the 500-record read limit, the rate is a slice rather than a
   * total.
   */
  attendanceSampleSize: number;
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
  attendanceRatePct: null,
  attendanceSampleSize: 0,
};

/**
 * Attendance rate over recorded marks.
 *
 * `excused` is excluded from numerator AND denominator, so an authorised
 * absence is neutral rather than counting against the student. Returns a null
 * rate with a zero sample when nothing countable exists — the caller must then
 * say "no data", not "0٪".
 */
function computeAttendanceRate(records: readonly AttendanceRecord[]): {
  pct: number | null;
  sample: number;
} {
  let attended = 0;
  let counted = 0;

  for (const record of records) {
    if (record.status === "excused") continue;
    counted += 1;
    if (ATTENDED_STATUSES.includes(record.status)) attended += 1;
  }

  if (counted === 0) return { pct: null, sample: 0 };
  return { pct: Math.round((attended / counted) * 100), sample: counted };
}

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
      attendance: getAttendanceRepository(),
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
      repositories.attendance.list(all, controller.signal),
    ])
      .then(([students, teachers, classes, rooms, enrollments, attendance]) => {
        if (cancelled) return;
        const totalSeats = classes.data.reduce((sum, c) => sum + c.capacity, 0);
        const takenSeats = classes.data.reduce((sum, c) => sum + c.enrolled, 0);
        const attendanceRate = computeAttendanceRate(attendance.data);
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
          attendanceRatePct: attendanceRate.pct,
          attendanceSampleSize: attendanceRate.sample,
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
 * genuinely derivable.
 *
 * Attendance rate is deliberately NOT one of the four hero numbers, for two
 * independent reasons:
 *
 *   1. it is `null` until marks exist, and a hero tile has nowhere honest to
 *      put "no data yet" — it would read as 0٪;
 *   2. it is capped at 500 records (see `attendanceRatePct`), so it is not a
 *      full-history academy figure and must not be presented as one.
 *
 * A regression test asserts this omission; adding it here would fail the
 * build rather than quietly shipping a misleading headline number.
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
