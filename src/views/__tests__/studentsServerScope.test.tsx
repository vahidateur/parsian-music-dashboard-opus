// @vitest-environment jsdom
/**
 * T-02 in API mode: the server scopes student reads in SQL
 * (`StudentAccessPolicy::scopeQuery`), so the view must not re-derive that
 * scope from two capped reads — doing so turns their truncation into a false
 * "not found". These cases stub exactly that: one server-authorized student,
 * and scope pages whose `items` are empty while their `total` says the real
 * universe is far larger than one page.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import {
  resetRegistry,
  setAuthRepository,
  setClassRepository,
  setEnrollmentRepository,
  setRoomRepository,
  setStudentRepository,
  setTeacherRepository,
  setUserRepository,
} from "@/domains/registry";
import type { Student } from "@/domains/students/types";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { StudentsView } from "@/views/Students";

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

const page = <T,>(data: T[], total: number) => ({
  data,
  meta: { page: 1, per_page: 100, total },
});

/** Only the server-authorized student; the scope pages below are truncated. */
const assigned = student({ id: "st_assigned", name: "هنرجوی منتسب" });

function stubs() {
  const students = {
    list: vi.fn(async () => page([assigned], 1)),
    get: vi.fn(async (id: string) => {
      if (id !== assigned.id) throw new ApiError({ kind: "not_found", message: "not found" });
      return assigned;
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  // `items: []` with a large `total`: the teacher's own rows are past page 1.
  const classes = { list: vi.fn(async () => page([], 250)) };
  const enrollments = { list: vi.fn(async () => page([], 900)) };
  const teachers = {
    list: vi.fn(async () => page([], 0)),
    get: vi.fn(async () => {
      throw new ApiError({ kind: "not_found", message: "not found" });
    }),
  };
  const rooms = { list: vi.fn(async () => page([], 0)) };
  return { students, classes, enrollments, teachers, rooms };
}

async function renderAsTeacher() {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });

  render(
    <AuthProvider>
      <AppProvider>
        <StudentsView />
      </AppProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "";
  resetToDemoEnvironment();
  resetRegistry();
  // API mode: `studentScopeIsServerEnforced()` is true, and every un-overridden
  // repository would be the REST implementation — the stubs below replace the
  // ones this view reads.
  setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });

  const s = stubs();
  setStudentRepository(s.students as never);
  setClassRepository(s.classes as never);
  setEnrollmentRepository(s.enrollments as never);
  setTeacherRepository(s.teachers as never);
  setRoomRepository(s.rooms as never);
});

afterEach(() => {
  cleanup();
  resetRegistry();
  resetRuntimeConfig();
  window.location.hash = "";
});

describe("StudentsView — server-enforced T-02 (API mode)", () => {
  it("renders a server-authorized student even when the scope reads are truncated", async () => {
    await renderAsTeacher();

    await waitFor(() => expect(screen.getAllByText("هنرجوی منتسب").length).toBeGreaterThan(0));
    // Not the empty-filter state: the server authorized this row.
    expect(screen.queryByText("هنرجویی با این فیلترها پیدا نشد")).toBeNull();
    // The stats describe the loaded (server-scoped) row.
    const activeCard = screen.getByText("هنرجوی فعال").closest("button");
    expect(activeCard?.textContent).toContain("۱");
  });

  it("resolves a deep link to that server-authorized student despite truncated scope reads", async () => {
    window.location.hash = "#/students/st_assigned";
    await renderAsTeacher();

    await waitFor(() => expect(screen.getAllByText("هنرجوی منتسب").length).toBeGreaterThan(0));
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });
});
