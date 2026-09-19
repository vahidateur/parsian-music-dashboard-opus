import { describe, it, expect } from "vitest";
import { assignedStudentIdsForTeacher } from "@/domains/auth/scope";

/**
 * AUDIT-002 regression: Students scope leak when teacher scope dependencies loading or erroring.
 * Previously: if (classesForScope.loading || enrollmentsForScope.loading) return students; // LEAK org-wide
 * Fix: return [] safe restricted.
 */

type Student = { id: string; name: string };
type ClassRef = { id: string; teacherId: string };
type EnrollmentRef = { studentId: string; classId: string; status: string };

function filteredStudentsLogic(
  students: Student[],
  user: { role: string; teacherId?: string } | null,
  classesForScope: { items: ClassRef[]; loading: boolean; error: any },
  enrollmentsForScope: { items: EnrollmentRef[]; loading: boolean; error: any },
): Student[] {
  if (!user || user.role !== "teacher" || !user.teacherId) return students;
  // AUDIT-002 FIX
  if (classesForScope.loading || enrollmentsForScope.loading) return [];
  if (classesForScope.error || enrollmentsForScope.error) return [];
  const assigned = assignedStudentIdsForTeacher(
    user.teacherId,
    classesForScope.items.map((c) => ({ id: c.id, teacherId: c.teacherId })),
    enrollmentsForScope.items.map((e) => ({ studentId: e.studentId, classId: e.classId, status: e.status })),
  );
  return students.filter((s) => assigned.has(s.id));
}

const allStudents: Student[] = [
  { id: "s1", name: "assigned student" },
  { id: "s2", name: "unassigned student" },
  { id: "s3", name: "other student" },
];

const classes: ClassRef[] = [{ id: "class1", teacherId: "t1" }];
const enrollments: EnrollmentRef[] = [{ studentId: "s1", classId: "class1", status: "active" }];

describe("AUDIT-002 Students scope leak", () => {
  it("teacher scope loading returns [] not org-wide", () => {
    const user = { role: "teacher", teacherId: "t1" };
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: [], loading: true, error: null },
      { items: [], loading: false, error: null },
    );
    expect(result).toEqual([]);
    // Must NOT be org-wide leak
    expect(result.length).not.toBe(allStudents.length);
  });

  it("teacher scope enrollments loading returns []", () => {
    const user = { role: "teacher", teacherId: "t1" };
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: [], loading: false, error: null },
      { items: [], loading: true, error: null },
    );
    expect(result).toEqual([]);
  });

  it("teacher scope error returns [] not org-wide", () => {
    const user = { role: "teacher", teacherId: "t1" };
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: [], loading: false, error: new Error("failed") },
      { items: [], loading: false, error: null },
    );
    expect(result).toEqual([]);
  });

  it("teacher scope enrollments error returns []", () => {
    const user = { role: "teacher", teacherId: "t1" };
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: [], loading: false, error: null },
      { items: [], loading: false, error: new Error("failed") },
    );
    expect(result).toEqual([]);
  });

  it("when loaded, teacher sees only assigned students", () => {
    const user = { role: "teacher", teacherId: "t1" };
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: classes, loading: false, error: null },
      { items: enrollments, loading: false, error: null },
    );
    expect(result).toEqual([{ id: "s1", name: "assigned student" }]);
  });

  it("non-teacher sees all students (org-wide allowed)", () => {
    const user = { role: "manager" } as any;
    const result = filteredStudentsLogic(
      allStudents,
      user,
      { items: [], loading: true, error: null },
      { items: [], loading: true, error: null },
    );
    expect(result).toEqual(allStudents);
  });

  it("no user sees all students", () => {
    const result = filteredStudentsLogic(
      allStudents,
      null,
      { items: [], loading: true, error: null },
      { items: [], loading: true, error: null },
    );
    expect(result).toEqual(allStudents);
  });
});
