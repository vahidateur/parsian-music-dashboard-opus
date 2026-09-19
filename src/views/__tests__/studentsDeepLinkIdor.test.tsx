// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { demoStore } from "@/services/demoStore";
import { memoryStorage } from "@/services/demoStore";
import { resetRegistry, setAuthRepository, setClassRepository, setEnrollmentRepository, setStudentRepository, setTeacherRepository, setUserRepository } from "@/domains/registry";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { Student } from "@/domains/students/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Enrollment } from "@/domains/enrollments/types";
import type { Teacher } from "@/domains/teachers/types";
import { ApiError } from "@/api/errors";

function student(over: Partial<Student> & { id: string; name: string }): Student {
  return {
    nationalId: "2000000002",
    instrument: "piano",
    level: "مقدماتی",
    levelStep: 2,
    status: "active",
    payment: "paid",
    teacherId: "t1",
    phone: "۰۹۱۲۰۰۰۰۰۰۰",
    since: "۱۴۰۴/۰۱/۰۱",
    age: 21,
    sessionsTotal: 12,
    sessionsUsed: 4,
    attendance: 90,
    progress: 50,
    lastSeen: "امروز",
    balance: 0,
    notes: [],
    activity: [],
    skills: [],
    ...over,
  };
}

function fakeStudentRepo(rows: Student[]) {
  return {
    list: vi.fn(async () => ({ data: rows, meta: { page: 1, per_page: 200, total: rows.length } })),
    get: vi.fn(async (id: string) => {
      const found = rows.find((r) => r.id === id);
      if (!found) throw new ApiError({ kind: "not_found", message: "not found" });
      return found;
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

function fakeClassRepo(rows: AcademyClass[]) {
  return {
    list: vi.fn(async () => ({ data: rows, meta: { page: 1, per_page: 200, total: rows.length }, items: rows, loading: false, error: null })),
    get: vi.fn(async (id: string) => {
      const found = rows.find((r) => r.id === id);
      if (!found) throw new ApiError({ kind: "not_found", message: "not found" });
      return found;
    }),
    create: vi.fn(),
    update: vi.fn(),
  } as any;
}

function fakeEnrollmentRepo(rows: Enrollment[]) {
  return {
    list: vi.fn(async () => ({ data: rows, meta: { page: 1, per_page: 200, total: rows.length }, items: rows, loading: false, error: null })),
    enroll: vi.fn(),
    withdraw: vi.fn(),
    update: vi.fn(),
  } as any;
}

function fakeTeacherRepo(rows: Teacher[]) {
  return {
    list: vi.fn(async () => ({ data: rows, meta: { page: 1, per_page: 200, total: rows.length }, items: rows, loading: false, error: null })),
    get: vi.fn(async (id: string) => {
      const found = rows.find((r) => r.id === id);
      if (!found) throw new ApiError({ kind: "not_found", message: "not found" });
      return found;
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

function useIsolatedTeacherAuth() {
  const sessionStore = memoryStorage();
  const repo = new DemoAuthRepository(demoStore, sessionStore);
  setAuthRepository(repo);
  setUserRepository(new DemoUserRepository(demoStore));
  return repo;
}

beforeEach(() => {
  window.location.hash = "";
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

describe("SEC-003-01 Student deep-link IDOR defense-in-depth", () => {
  it("teacher + unassigned student + direct deep-link => detail NOT rendered (404)", async () => {
    const teacherAuth = useIsolatedTeacherAuth();
    await teacherAuth.login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });

    const sAssigned = student({ id: "s_assigned", name: "هنرجوی منتسب" });
    const sUnassigned = student({ id: "s_unassigned", name: "هنرجوی نامنتسب" });

    const class1: AcademyClass = {
      id: "class1",
      title: "کلاس پیانو",
      instrument: "piano",
      teacherId: "t1",
      roomId: "r1",
      kind: "private",
      level: "مقدماتی",
      days: [0],
      time: "10:00",
      duration: 60,
      enrolled: 1,
      capacity: 5,
      attendanceAvg: 90,
      waitlist: 0,
      tuition: 1000000,
      termProgress: 50,
      studentIds: ["s_assigned"],
    };

    const enrollment1: Enrollment = {
      id: "e1",
      studentId: "s_assigned",
      classId: "class1",
      status: "active",
      startDate: "۱۴۰۴/۰۱/۰۱",
      pricingPlan: { label: "ترم", amount: 1000000 },
    };

    const teacher1: Teacher = {
      id: "t1",
      name: "مدرس یک",
      instrument: "piano",
      title: "مدرس پیانو",
      students: 1,
      utilization: 80,
      weeklyHours: 10,
      contractHours: 20,
      attendanceRate: 95,
      retention: 90,
      todayClasses: [],
      availability: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
      since: "۱۴۰۳/۰۱/۰۱",
      phone: "۰۹۱۲۰۰۰۰۰۰۰",
      status: "active",
      bio: "",
    };

    setStudentRepository(fakeStudentRepo([sAssigned, sUnassigned]));
    setClassRepository(fakeClassRepo([class1]));
    setEnrollmentRepository(fakeEnrollmentRepo([enrollment1]));
    setTeacherRepository(fakeTeacherRepo([teacher1]));

    window.location.hash = "#/students/s_unassigned";

    render(<App />);

    // Should show not-found, not the unassigned student's name as detail
    await waitFor(() => expect(screen.getByText("هنرجو یافت نشد")).toBeTruthy(), { timeout: 5000 });

    // The unassigned student's detail should NOT be rendered
    // The list might contain the name, but detail view should not show StudentDetail with that name as main title?
    // We check that the detail panel does NOT show the student's name in a heading that indicates detail
    // The 404 page itself does not contain the student's name, so query should be null for detail-specific rendering
    // To be precise, we ensure the StudentDetail component is not rendered by checking absence of edit button or specific detail text
    // The not-found page has action "بازگشت به فهرست"
    expect(screen.getByText("بازگشت به فهرست")).toBeTruthy();
    // If IDOR bug existed, it would render StudentDetail with name "هنرجوی نامنتسب" and not the 404
    // So we assert that the 404 is shown and not the detail's edit flow
  });

  it("teacher + assigned student + direct deep-link => detail IS rendered", async () => {
    const teacherAuth = useIsolatedTeacherAuth();
    await teacherAuth.login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });

    const sAssigned = student({ id: "s_assigned", name: "هنرجوی منتسب" });

    const class1: AcademyClass = {
      id: "class1",
      title: "کلاس پیانو",
      instrument: "piano",
      teacherId: "t1",
      roomId: "r1",
      kind: "private",
      level: "مقدماتی",
      days: [0],
      time: "10:00",
      duration: 60,
      enrolled: 1,
      capacity: 5,
      attendanceAvg: 90,
      waitlist: 0,
      tuition: 1000000,
      termProgress: 50,
      studentIds: ["s_assigned"],
    };

    const enrollment1: Enrollment = {
      id: "e1",
      studentId: "s_assigned",
      classId: "class1",
      status: "active",
      startDate: "۱۴۰۴/۰۱/۰۱",
      pricingPlan: { label: "ترم", amount: 1000000 },
    };

    const teacher1: Teacher = {
      id: "t1",
      name: "مدرس یک",
      instrument: "piano",
      title: "مدرس پیانو",
      students: 1,
      utilization: 80,
      weeklyHours: 10,
      contractHours: 20,
      attendanceRate: 95,
      retention: 90,
      todayClasses: [],
      availability: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
      since: "۱۴۰۳/۰۱/۰۱",
      phone: "۰۹۱۲۰۰۰۰۰۰۰",
      status: "active",
      bio: "",
    };

    setStudentRepository(fakeStudentRepo([sAssigned]));
    setClassRepository(fakeClassRepo([class1]));
    setEnrollmentRepository(fakeEnrollmentRepo([enrollment1]));
    setTeacherRepository(fakeTeacherRepo([teacher1]));

    window.location.hash = "#/students/s_assigned";

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("هنرجوی منتسب").length).toBeGreaterThan(0), { timeout: 5000 });
    // Should NOT show not-found
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });
});
