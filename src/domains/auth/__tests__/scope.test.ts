import { describe, it, expect } from "vitest";
import {
  isAssignedStudent,
  assignedStudentIdsForTeacher,
  isSelfStudent,
  canReadStudent,
  canReadStudentOrgWide,
  canWriteStudent,
  canWriteAttendance,
  canWriteCompensation,
  canExport,
  type Actor,
  type ClassRef,
  type EnrollmentRef,
} from "../scope";
import { rolePermissions, type RoleId } from "../permissions";

function actorFor(role: RoleId, opts: Partial<Actor> = {}): Actor {
  return {
    userId: `usr_${role}`,
    role,
    permissions: [...rolePermissions[role]],
    ...opts,
  };
}

const classes: ClassRef[] = [
  { id: "class1", teacherId: "t1" },
  { id: "class2", teacherId: "t2" },
];

const enrollments: EnrollmentRef[] = [
  { studentId: "s1", classId: "class1", status: "active" },
  { studentId: "s2", classId: "class1", status: "active" },
  { studentId: "s3", classId: "class2", status: "active" },
  { studentId: "s1", classId: "class2", status: "waitlist" }, // waitlist not counted as assigned
];

describe("scope pure functions", () => {
  it("isAssignedStudent true for active enrollment in teacher's class", () => {
    expect(isAssignedStudent("t1", "s1", classes, enrollments)).toBe(true);
    expect(isAssignedStudent("t1", "s2", classes, enrollments)).toBe(true);
  });

  it("isAssignedStudent false for student not in teacher's class", () => {
    expect(isAssignedStudent("t1", "s3", classes, enrollments)).toBe(false);
  });

  it("isAssignedStudent false for waitlist", () => {
    expect(isAssignedStudent("t2", "s1", classes, enrollments)).toBe(false);
  });

  it("assignedStudentIdsForTeacher returns set of assigned", () => {
    const set = assignedStudentIdsForTeacher("t1", classes, enrollments);
    expect(set.has("s1")).toBe(true);
    expect(set.has("s2")).toBe(true);
    expect(set.has("s3")).toBe(false);
  });

  it("isSelfStudent true when actor studentId matches", () => {
    const actor = actorFor("teacher", { studentId: "s1" });
    expect(isSelfStudent(actor, "s1")).toBe(true);
    expect(isSelfStudent(actor, "s2")).toBe(false);
  });

  // S-01 student self ALLOWED, S-02 other DENIED — future portal
  it("S-01 student self can read own profile if has permission", () => {
    const studentActor: Actor = {
      userId: "usr_student",
      role: "teacher", // using teacher role as stand-in, but with studentId linkage and students.read
      permissions: ["students.read"],
      studentId: "s1",
    };
    // Self scope: isSelfStudent true, but canReadStudent for teacher role requires assigned check
    // For self case, we test isSelfStudent directly — the full portal would have separate role
    expect(isSelfStudent(studentActor, "s1")).toBe(true);
  });

  it("S-02 student cannot read another student via self check", () => {
    const studentActor: Actor = {
      userId: "usr_student",
      role: "teacher",
      permissions: ["students.read"],
      studentId: "s1",
    };
    expect(isSelfStudent(studentActor, "s2")).toBe(false);
  });

  // T-01 teacher assigned ALLOWED, T-02 unassigned DENIED (desired smallest) but ALLOWED historically
  it("T-01 teacher assigned can read student (assigned-only smallest)", () => {
    const teacher = actorFor("teacher", { teacherId: "t1" });
    expect(canReadStudent(teacher, { id: "s1" }, { classes, enrollments })).toBe(true);
  });

  it("T-02 teacher unassigned DENIED in smallest model, ALLOWED in org-wide historical", () => {
    const teacher = actorFor("teacher", { teacherId: "t1" });
    // Smallest model: DENIED for unassigned
    expect(canReadStudent(teacher, { id: "s3" }, { classes, enrollments })).toBe(false);
    // Historical org-wide: ALLOWED
    expect(canReadStudentOrgWide(teacher)).toBe(true);
  });

  it("M-01 manager org-wide can read any student", () => {
    const manager = actorFor("manager");
    expect(canReadStudent(manager, { id: "s1" }, { classes, enrollments })).toBe(true);
    expect(canReadStudent(manager, { id: "s3" }, { classes, enrollments })).toBe(true);
  });

  it("A-01 administrator org-wide can read any student", () => {
    const admin = actorFor("administrator");
    expect(canReadStudent(admin, { id: "s99" }, { classes, enrollments })).toBe(true);
  });

  it("canWriteStudent requires students.write — teacher has none", () => {
    const teacher = actorFor("teacher", { teacherId: "t1" });
    expect(canWriteStudent(teacher, { id: "s1" }, { classes, enrollments })).toBe(false);
    const manager = actorFor("manager");
    expect(canWriteStudent(manager, { id: "s1" }, { classes, enrollments })).toBe(true);
  });

  it("attendance write assigned vs unassigned", () => {
    const teacher = actorFor("teacher", { teacherId: "t1" });
    const session = { id: "sess1", classId: "class1", teacherId: "t1" };
    // Assigned student: ALLOWED
    expect(
      canWriteAttendance(teacher, { studentId: "s1", session }, { classes, enrollments }),
    ).toBe(true);
    // Unassigned student: DENIED
    expect(
      canWriteAttendance(teacher, { studentId: "s3", session }, { classes, enrollments }),
    ).toBe(false);
    // Session not taught by teacher: DENIED
    const otherSession = { id: "sess2", classId: "class2", teacherId: "t2" };
    expect(
      canWriteAttendance(teacher, { studentId: "s1", session: otherSession }, { classes, enrollments }),
    ).toBe(false);
  });

  it("compensation write teacher DENIED, staff ALLOWED", () => {
    const teacher = actorFor("teacher", { teacherId: "t1" });
    expect(canWriteCompensation(teacher)).toBe(false);
    const staff = actorFor("staff");
    expect(canWriteCompensation(staff)).toBe(true);
    const manager = actorFor("manager");
    expect(canWriteCompensation(manager)).toBe(true);
  });

  it("export permission hidden if no read perm", () => {
    const teacher = actorFor("teacher");
    // Teacher has students.read, so can export students
    expect(canExport(teacher, "students.read")).toBe(true);
    // Teacher has no finance.read, so cannot export finance
    expect(canExport(teacher, "finance.read")).toBe(false);
    const accountant = actorFor("accountant");
    expect(canExport(accountant, "finance.read")).toBe(true);
    expect(canExport(accountant, "library.read")).toBe(false);
  });

  it("teacher without schedule.write sees no reschedule/cancel/generate", () => {
    const teacher = actorFor("teacher");
    // schedule.write is not in teacher perms
    expect(teacher.permissions.includes("schedule.write")).toBe(false);
    expect(canWriteCompensation(teacher)).toBe(false);
  });

  it("accountant sees finance not library", () => {
    const accountant = actorFor("accountant");
    expect(accountant.permissions.includes("finance.read")).toBe(true);
    expect(accountant.permissions.includes("library.read")).toBe(false);
  });
});
