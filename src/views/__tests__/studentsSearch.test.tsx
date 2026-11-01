// @vitest-environment jsdom
/**
 * I16 — the students list search is the server's.
 *
 * The box filtered the 200 rows already loaded, so a student past that page was
 * unfindable and the list said so. With a query the list asks the repository;
 * the four stat cards then describe the search result set and say so, because a
 * count is a measurement (D12). With no query the cards keep describing the
 * loaded page, and a short page is disclosed.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { resetRegistry, setAuthRepository, setStudentRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { Student, StudentListParams } from "@/domains/students/types";
import { StudentsView } from "@/views/Students";

// The whole StudentsView is a heavy jsdom render: measured ~5-6 s under a full
// parallel suite, 2 s alone. The 5 s default is too close to the real runtime.
vi.setConfig({ testTimeout: 60_000 });

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function student(index: number): Student {
  return {
    id: `st_${index}`,
    name: `هنرجوی شماره ${index}`,
    nationalId: `20${String(index).padStart(8, "0")}`,
    instrument: "piano",
    level: "مقدماتی",
    levelStep: 2,
    status: index % 2 === 0 ? "active" : "paused",
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
  };
}

/** 250 students that answer `search` and `per_page` exactly as the API does. */
function stubStudents(count: number) {
  const rows = Array.from({ length: count }, (_, index) => student(index + 1));
  const calls: StudentListParams[] = [];
  const list = vi.fn(async (params: StudentListParams = {}) => {
    calls.push(params);
    const query = params.search?.trim();
    const matched = query ? rows.filter((row) => row.name.includes(query)) : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  });
  setStudentRepository({ list } as unknown as Parameters<typeof setStudentRepository>[0]);
  return { calls };
}

async function renderAsAdmin() {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  render(
    <AuthProvider>
      <AppProvider>
        <StudentsView />
      </AppProvider>
    </AuthProvider>,
  );
}

describe("StudentsView search (I16)", () => {
  it("discloses a short idle page instead of presenting it as everyone", async () => {
    const students = stubStudents(250);
    await renderAsAdmin();
    await screen.findByText("هنرجویان");

    await waitFor(() => expect(screen.getByText(/از .* برای دیدن بقیه/)).toBeDefined());
    // Idle means no `search` reaches the repository, and the page is 200 rows.
    expect(students.calls.every((call) => call.search === undefined)).toBe(true);
    expect(students.calls.at(-1)?.per_page).toBe(200);
  });

  it("finds a student past the first page and says the stats describe that result set", async () => {
    const students = stubStudents(250);
    await renderAsAdmin();
    await screen.findByText("هنرجویان");

    fireEvent.change(screen.getByPlaceholderText("جستجوی نام، تلفن یا کد ملی هنرجو…"), {
      target: { value: "هنرجوی شماره 201" },
    });
    await waitFor(() => expect(students.calls.some((call) => call.search === "هنرجوی شماره 201")).toBe(true));
    await waitFor(() => expect(screen.getAllByText(/هنرجوی شماره 201/).length).toBeGreaterThan(0));

    // The cards now measure the search result set and say so.
    await waitFor(() => expect(screen.getAllByText(/در نتایج جست‌وجو/).length).toBe(4));
    // And they are counts of the single match, not of the loaded page.
    expect(screen.getAllByText("۰").length).toBeGreaterThan(0);
  });
});
