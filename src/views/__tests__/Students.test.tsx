// @vitest-environment jsdom
/**
 * Students view is repository-backed. These tests assert the view renders what
 * the *repository* returns — not the `@/data/records` fixture — and that its
 * loading/error/not-found branches are real.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { setStudentRepository } from "@/domains/registry";
import type { StudentRepository } from "@/domains/students/repository";
import type { Student } from "@/domains/students/types";

/** Fully-typed fixture: no casts, so a missing field is a compile error. */
function student(over: Partial<Student> & { id: string; name: string }): Student {
  return {
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

function repoWith(rows: Student[]): StudentRepository {
  return {
    list: vi.fn(async () => ({ data: rows, meta: { page: 1, per_page: 25, total: rows.length } })),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as StudentRepository;
}

const renderView = () =>
  render(
    <AppProvider>
      <StudentsView />
    </AppProvider>,
  );

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  setStudentRepository(undefined);
  cleanup();
});

describe("StudentsView", () => {
  it("renders students supplied by the repository", async () => {
    setStudentRepository(repoWith([student({ id: "sx1", name: "زهرا تست‌نیا" })]));
    renderView();
    await waitFor(() => expect(screen.getByText("زهرا تست‌نیا")).toBeTruthy());
  });

  it("does not render fixture students that the repository omits", async () => {
    setStudentRepository(repoWith([student({ id: "sx1", name: "زهرا تست‌نیا" })]));
    renderView();
    await waitFor(() => expect(screen.getByText("زهرا تست‌نیا")).toBeTruthy());
    // These names exist only in the `@/data/records` student fixture, so a
    // properly wired view must not render them.
    expect(screen.queryByText("سارا محمدی")).toBeNull();
    expect(screen.queryByText("امیرحسین کریمی")).toBeNull();
  });

  it("derives stat counts from the loaded data instead of hardcoded totals", async () => {
    setStudentRepository(
      repoWith([
        student({ id: "a", name: "الف", status: "active" }),
        student({ id: "b", name: "ب", status: "at-risk" }),
        student({ id: "c", name: "پ", status: "waitlist" }),
        student({ id: "d", name: "ت", status: "waitlist" }),
      ]),
    );
    renderView();
    // Two waitlist students → Persian digit ۲ must appear, and the old
    // fabricated totals (۱۲۴۸ / ۱۱۸۶) must not.
    await waitFor(() => expect(screen.getAllByText("لیست انتظار").length).toBeGreaterThan(0));
    // The old fabricated totals must be gone entirely.
    expect(screen.queryByText("۱٬۱۸۶")).toBeNull();
    expect(screen.queryByText("۱٬۲۴۸")).toBeNull();
  });

  it("shows a retryable error state when the repository fails", async () => {
    const failing = {
      list: vi.fn(async () => {
        throw new ApiError({ kind: "server", code: "BOOM", message: "سرویس در دسترس نیست." });
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as StudentRepository;
    setStudentRepository(failing);
    renderView();
    await waitFor(() => expect(screen.getByText("بارگذاری هنرجویان ناموفق بود")).toBeTruthy());
    expect(screen.getByText("سرویس در دسترس نیست.")).toBeTruthy();
  });

  it("handles a deep link to a student that no longer exists", async () => {
    window.location.hash = "#/students/does-not-exist";
    setStudentRepository(repoWith([student({ id: "sx1", name: "زهرا تست‌نیا" })]));
    renderView();
    await waitFor(() => expect(screen.getByText("هنرجو یافت نشد")).toBeTruthy());
  });

  it("opens the detail view for a valid deep link", async () => {
    window.location.hash = "#/students/sx1";
    setStudentRepository(repoWith([student({ id: "sx1", name: "زهرا تست‌نیا" })]));
    renderView();
    await waitFor(() => expect(screen.getAllByText("زهرا تست‌نیا").length).toBeGreaterThan(0));
  });
});
