/**
 * Derived session roster — who is expected at a given session.
 *
 * PURE: no storage, no repository, no React, no network, no clock. Everything
 * is passed in, so the rule can be unit tested with no environment and reused
 * unchanged by a future API implementation.
 *
 * THE RULE
 *
 *   active enrollment
 *   AND startDate <= session.date
 *   AND (endDate is null OR endDate >= session.date)
 *
 * Scoping to the session's DATE is the whole point. A stored roster would be
 * wrong twice over: a student who joins in week 6 would appear on week 2's
 * register, and one who withdraws in week 8 would vanish from weeks 1–7 whose
 * attendance is already recorded history.
 *
 * FAILING CLOSED
 *
 * `Enrollment.startDate` is a Jalali DISPLAY string with Persian digits
 * (`"۱۴۰۴/۰۷/۰۱"`). Enrollment is a protected domain and is deliberately not
 * migrated, so dates are read through `jalaliToIso`. When a date cannot be
 * parsed the student is EXCLUDED rather than admitted: silently adding someone
 * to a register is the worse error, and an over-strict roster is visible while
 * a wrongly-included student is not.
 *
 * COMPLEXITY
 *
 * One pass to index students by id, one pass over enrollments. No per-student
 * scan, so the cost is O(S + E) rather than O(S × E).
 */
import { jalaliToIso } from "@/domains/scheduling/dateBridge";
import type { RosterEntry } from "@/domains/scheduling/types";

/** The enrollment fields the rule reads. Structural, so no import coupling. */
export interface RosterEnrollment {
  studentId: string;
  classId: string;
  /** See `EnrollmentStatus`; only `active` places a student on a register. */
  status: string;
  /** Jalali display string, e.g. `"۱۴۰۴/۰۷/۰۱"`. */
  startDate: string;
  endDate?: string;
}

/** The student fields the roster needs. */
export interface RosterStudent {
  id: string;
  name: string;
  photoMediaId?: string;
}

export interface RosterInput {
  classId: string;
  /** ISO-8601 `YYYY-MM-DD` — the session's calendar date. */
  date: string;
  enrollments: readonly RosterEnrollment[];
  students: readonly RosterStudent[];
}

/**
 * Only `active` enrollments occupy a seat on a register.
 *
 * `waitlist` has no seat yet; `completed` and `cancelled` no longer hold one.
 * Matching on the one included value rather than excluding a list means a
 * future status added to `EnrollmentStatus` is excluded by default — the safe
 * direction for a rule that decides who is on a register.
 */
const ROSTER_STATUS = "active";

/**
 * Resolves the students expected at a session.
 *
 * Sorted by Persian name so the register reads consistently; the order of the
 * underlying enrollment rows is an implementation detail nobody should see.
 */
export function resolveSessionRoster(input: RosterInput): RosterEntry[] {
  const { classId, date, enrollments, students } = input;

  const byId = new Map<string, RosterStudent>();
  for (const student of students) byId.set(student.id, student);

  const out: RosterEntry[] = [];
  const seen = new Set<string>();

  for (const enrollment of enrollments) {
    if (enrollment.classId !== classId) continue;
    if (enrollment.status !== ROSTER_STATUS) continue;

    if (!coversDate(enrollment, date)) continue;

    // A student enrolled twice in one class (data error, or a re-enrollment
    // after completing) must appear once on the register, not twice.
    if (seen.has(enrollment.studentId)) continue;

    const student = byId.get(enrollment.studentId);
    // An enrollment pointing at a deleted student cannot be rendered.
    if (!student) continue;

    seen.add(enrollment.studentId);
    out.push({
      studentId: student.id,
      studentName: student.name,
      photoMediaId: student.photoMediaId,
    });
  }

  return out.sort((a, b) => a.studentName.localeCompare(b.studentName, "fa"));
}

/**
 * True when the enrollment was in force on `date`.
 *
 * Both bounds are inclusive: a session on the first day of an enrollment
 * counts, and so does one on its last.
 */
export function coversDate(enrollment: RosterEnrollment, date: string): boolean {
  const start = jalaliToIso(enrollment.startDate);
  // Unparseable start ⇒ excluded. Fail closed.
  if (start === null) return false;
  if (start > date) return false;

  if (enrollment.endDate !== undefined && enrollment.endDate !== "") {
    const end = jalaliToIso(enrollment.endDate);
    // An unparseable END is treated as "still open" rather than excluding the
    // student: the enrollment demonstrably started, and dropping someone from
    // a register they belong on would hide a real attendance obligation.
    if (end !== null && end < date) return false;
  }

  return true;
}

/** Ids only, when the caller does not need names. */
export function resolveRosterStudentIds(input: RosterInput): string[] {
  return resolveSessionRoster(input).map((entry) => entry.studentId);
}
