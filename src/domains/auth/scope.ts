/**
 * Ownership / scope pure functions — F2 RBAC + Ownership/Scope.
 *
 * These are pure, testable, backend-portable functions that decide whether an
 * actor may read/write a resource given a scope (self / assigned / org / device).
 * They do NOT touch repositories, demoStore, or UI — only data passed in.
 *
 * Frontend is UX-only: real enforcement must be server-side, but the same pure
 * logic can be reused there. The functions are the single source for
 * self vs assigned vs org decisions, so views must not re-derive the same logic
 * with ad-hoc filters.
 *
 * T-02: Teacher → unassigned student is OPEN EVIDENCE CONFLICTING.
 * Current observed behavior in rolePermissions: teacher has students.read org-wide
 * (ALLOWED). Desired smallest permission model per F2 goal: assigned-only (DENIED
 * for unassigned). This module implements the smallest model (assigned-only) as
 * `isAssignedStudent` and `canReadStudent` for teacher role, while preserving
 * evidence via `canReadStudentOrgWide` helper that documents the historical
 * ALLOWED behavior. Product decision remains OPEN, but implementation chooses
 * assigned-only as smallest per F2 acceptance.
 *
 * O-01: Student level scope per-program vs global — remains OPEN, not resolved
 * here. Scope functions operate per-program where placement exists, not global.
 */

import type { RoleId, Permission } from "./permissions";

export type Scope = "self" | "assigned" | "org" | "device";

export interface Actor {
  userId: string;
  role: RoleId;
  permissions: readonly Permission[];
  /** Teacher role: linked teacher id from DemoUser.teacherId */
  teacherId?: string;
  /** Future student portal: linked student id */
  studentId?: string;
}

export interface StudentRef {
  id: string;
}

export interface ClassRef {
  id: string;
  teacherId: string;
}

export interface EnrollmentRef {
  studentId: string;
  classId: string;
  status: "active" | "waitlist" | "completed" | "cancelled";
}

export interface SessionRef {
  id: string;
  classId: string;
  teacherId: string;
}

export interface AttendanceRecordRef {
  sessionId: string;
  studentId: string;
}

/**
 * Whether a teacher is assigned to a student via at least one active enrollment
 * in a class taught by that teacher.
 *
 * Pure: no repo, only passed arrays.
 */
export function isAssignedStudent(
  teacherId: string,
  studentId: string,
  classes: readonly ClassRef[],
  enrollments: readonly EnrollmentRef[],
): boolean {
  if (!teacherId || !studentId) return false;
  // Classes taught by this teacher
  const teacherClassIds = new Set(classes.filter((c) => c.teacherId === teacherId).map((c) => c.id));
  if (teacherClassIds.size === 0) return false;
  return enrollments.some(
    (e) => e.studentId === studentId && teacherClassIds.has(e.classId) && e.status === "active",
  );
}

/**
 * Students assigned to a teacher.
 */
export function assignedStudentIdsForTeacher(
  teacherId: string,
  classes: readonly ClassRef[],
  enrollments: readonly EnrollmentRef[],
): Set<string> {
  const teacherClassIds = new Set(classes.filter((c) => c.teacherId === teacherId).map((c) => c.id));
  const result = new Set<string>();
  for (const e of enrollments) {
    if (e.status !== "active") continue;
    if (teacherClassIds.has(e.classId)) result.add(e.studentId);
  }
  return result;
}

/**
 * Self check: actor is the student themselves.
 */
export function isSelfStudent(actor: Actor, studentId: string): boolean {
  return actor.studentId !== undefined && actor.studentId === studentId;
}

/**
 * Org-wide read as historically observed for teacher (ALLOWED) — preserved for
 * T-02 evidence. Returns true if actor has students.read permission (org-wide).
 * This is the historical behavior before assigned-only filtering.
 */
export function canReadStudentOrgWide(actor: Actor): boolean {
  return actor.permissions.includes("students.read");
}

/**
 * Can actor read a student?
 *
 * - administrator / manager / staff with students.read: org-wide ALLOWED (per rolePermissions)
 * - teacher with students.read: assigned-only ALLOWED per smallest model (T-02 DENIED desired)
 *   - if teacherId missing, fallback to org-wide (honest, no fabricated assignment)
 * - student self: self ALLOWED, other DENIED
 * - accountant with students.read: org-wide ALLOWED (finance needs roster)
 *
 * For teacher role, this implements assigned-only filtering (DENIED for unassigned)
 * as smallest permission model. The historical ALLOWED behavior is documented via
 * canReadStudentOrgWide.
 */
export function canReadStudent(
  actor: Actor,
  student: StudentRef,
  ctx: { classes: readonly ClassRef[]; enrollments: readonly EnrollmentRef[] },
): boolean {
  if (!actor.permissions.includes("students.read")) return false;

  // Self scope for future student portal
  if (actor.role === "teacher" && actor.teacherId) {
    // Assigned-only for teacher
    return isAssignedStudent(actor.teacherId, student.id, ctx.classes, ctx.enrollments);
  }

  // For non-teacher roles, or teacher without teacherId (fallback), org-wide
  if (actor.role === "administrator" || actor.role === "manager" || actor.role === "staff" || actor.role === "accountant") {
    return true;
  }

  // Student self (future portal)
  if (isSelfStudent(actor, student.id)) return true;

  // Teacher without teacherId linkage: fallback to org-wide (honest, not fabricated DENY)
  if (actor.role === "teacher" && !actor.teacherId) {
    return true;
  }

  return false;
}

/**
 * Can actor write student?
 * Requires students.write permission, plus for teacher role: must be assigned?
 * For smallest model, teacher has no students.write at all (rolePermissions), so DENIED.
 */
export function canWriteStudent(
  actor: Actor,
  student: StudentRef,
  ctx: { classes: readonly ClassRef[]; enrollments: readonly EnrollmentRef[] },
): boolean {
  if (!actor.permissions.includes("students.write")) return false;
  // Teachers have no students.write per matrix, so this will be false for them
  if (actor.role === "teacher" && actor.teacherId) {
    // Even if permission existed, require assigned
    return isAssignedStudent(actor.teacherId, student.id, ctx.classes, ctx.enrollments);
  }
  return true;
}

/**
 * Can actor read teacher list?
 * teachers.read required. All roles with it see org-wide currently.
 */
export function canReadTeacher(actor: Actor): boolean {
  return actor.permissions.includes("teachers.read");
}

/**
 * Can actor write attendance for a session/student?
 * Requires attendance.write + assigned check for teacher.
 * For teacher: must be assigned to student's class OR be teacher of session's class.
 */
export function canWriteAttendance(
  actor: Actor,
  target: { studentId: string; session: SessionRef },
  ctx: { classes: readonly ClassRef[]; enrollments: readonly EnrollmentRef[] },
): boolean {
  if (!actor.permissions.includes("attendance.write")) return false;
  if (actor.role === "administrator" || actor.role === "manager") return true;
  if (actor.role === "teacher" && actor.teacherId) {
    // Teacher can write attendance for sessions they teach and students assigned to them
    if (target.session.teacherId !== actor.teacherId) return false;
    return isAssignedStudent(actor.teacherId, target.studentId, ctx.classes, ctx.enrollments);
  }
  // Staff with attendance.read but no write? Actually staff has no attendance.write per matrix
  return false;
}

/**
 * Can actor read attendance?
 * attendance.read required. Teacher: assigned sessions only? For now org-wide if permission.
 */
export function canReadAttendance(actor: Actor): boolean {
  return actor.permissions.includes("attendance.read");
}

/**
 * Can actor write compensation (schedule.write)?
 * Compensation borrows schedule permission per viewPermissions.
 * Teacher: DENIED per F2 visible outcome (compensation write teacher vs staff).
 * Staff: ALLOWED, manager/administrator ALLOWED.
 */
export function canWriteCompensation(actor: Actor): boolean {
  if (!actor.permissions.includes("schedule.write")) return false;
  // Teacher has no schedule.write per matrix, so DENIED automatically
  // Staff, manager, administrator have schedule.write
  return true;
}

export function canReadCompensation(actor: Actor): boolean {
  return actor.permissions.includes("schedule.read");
}

/**
 * Can actor read schedule?
 */
export function canReadSchedule(actor: Actor): boolean {
  return actor.permissions.includes("schedule.read");
}

export function canWriteSchedule(actor: Actor): boolean {
  return actor.permissions.includes("schedule.write");
}

/**
 * Export permission: requires read permission for the entity.
 * e.g., students export requires students.read
 */
export function canExport(actor: Actor, requiredPermission: Permission): boolean {
  return actor.permissions.includes(requiredPermission);
}

/**
 * Eligible vs locked content: Level N → 1..N per program (canonical rule).
 * Scope is per-program (O-01 provisional), not global.
 * This is already owned by learning/eligibility.ts, but we expose a helper for tests.
 */
export function isEligibleLevel(currentOrder: number, contentLevelOrder: number): boolean {
  return contentLevelOrder <= currentOrder;
}
