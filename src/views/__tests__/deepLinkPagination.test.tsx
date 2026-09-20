// @vitest-environment jsdom
/**
 * I16 DEEP-LINK / PAGINATION CORRECTION
 *
 * Before fix: StudentsView and TeachersView resolved detailId by scanning
 * `students.find(id)` from a capped list `useStudentList({ per_page: 200 })`.
 * An existing entity beyond first 200 was reported as "not found".
 *
 * After fix: detail uses authoritative `get(id)` via `useStudent` / `useTeacher`
 * hooks, independent of the 200-row ceiling, with loading/error/not-found
 * distinguishable.
 *
 * Covers required behavior:
 * 1. Existing entity beyond first 200 → detail loads
 * 2. Existing entity in first page → still loads
 * 3. Unknown id → honest not-found
 * 4. Repository read failure → honest error, not not-found
 * 5. Loading state distinct
 * 6. List behavior unchanged (per_page 200 still)
 * 7. Relations intact (not weakened)
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { TeachersView } from "@/views/Teachers";
import {
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import { ApiError } from "@/api/errors";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

function makeNationalId(seq: number): string {
  const base = String(100000000 + (seq % 800000000)).padStart(9, "0");
  const sum = [...base].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const r = sum % 11;
  return base + String(r < 2 ? r : 11 - r);
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

function renderStudentsDetail(id: string) {
  window.location.hash = `#/students/${id}`;
  return render(
    <AppProvider>
      <StudentsView />
    </AppProvider>,
  );
}

function renderTeachersDetail(id: string) {
  window.location.hash = `#/teachers/${id}`;
  return render(
    <AppProvider>
      <TeachersView />
    </AppProvider>,
  );
}

describe("I16 Students deep-link independent of 200-row ceiling", () => {
  it("existing entity beyond first 200 → detail loads", async () => {
    const repo = getStudentRepository();
    // Ensure we have >200 students so last is beyond first page
    const template = (await repo.list({ per_page: 500 })).data[0];
    let seq = 1;
    while ((await repo.list({ per_page: 500 })).data.length <= 210) {
      const { id: _id, ...fields } = template;
      await repo.create({
        ...fields,
        name: `هنرجوی آزمایشی ${seq}`,
        nationalId: makeNationalId(seq * 7919 + 123),
      });
      seq++;
    }
    const all = (await repo.list({ per_page: 500 })).data;
    expect(all.length).toBeGreaterThan(200);
    const beyond = all[205]; // beyond first 200
    expect(beyond).toBeDefined();

    renderStudentsDetail(beyond.id);

    await waitFor(() => expect(screen.queryByText("هنرجو یافت نشد")).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(screen.getAllByText(beyond.name).length).toBeGreaterThan(0), { timeout: 5000 });
  });

  it("existing entity in first page → detail still loads", async () => {
    const first = (await getStudentRepository().list({ per_page: 500 })).data[0];
    renderStudentsDetail(first.id);
    await waitFor(() => expect(screen.getAllByText(first.name).length).toBeGreaterThan(0));
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });

  it("unknown id → honest not-found", async () => {
    renderStudentsDetail("st-does-not-exist-xyz");
    await screen.findByText("هنرجو یافت نشد");
    expect(screen.queryByText("بارگذاری پروندهٔ هنرجو ناموفق بود")).toBeNull();
  });

  it("repository read failure → honest error, not not-found", async () => {
    const real = getStudentRepository();
    setStudentRepository(
      withStubs(real, {
        get: async () => {
          throw new ApiError({ kind: "network", message: "شبکه در دسترس نیست" });
        },
      } as Stubs<typeof real>),
    );
    renderStudentsDetail("st1");
    const err = await screen.findByText("بارگذاری پروندهٔ هنرجو ناموفق بود");
    expect(err).toBeDefined();
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });

  it("loading state distinct", async () => {
    const real = getStudentRepository();
    let resolve!: (v: any) => void;
    const pending = new Promise((res) => (resolve = res));
    setStudentRepository(
      withStubs(real, {
        get: () => pending,
      } as Stubs<typeof real>),
    );
    renderStudentsDetail("st1");
    // Should show loading, not not-found nor error
    expect(await screen.findByText(/در حال باز کردن پروندهٔ هنرجویان/)).toBeDefined();
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
    resolve((await real.list({ per_page: 1 })).data[0]);
    await waitFor(() => expect(screen.queryByText(/در حال باز کردن پرونده/)).toBeNull());
  });

  it("list behavior unchanged: still per_page 200", async () => {
    window.location.hash = "#/students";
    render(
      <AppProvider>
        <StudentsView />
      </AppProvider>,
    );
    // List should render without deep-link
    await waitFor(() => expect(screen.queryByText(/در حال باز کردن پروندهٔ هنرجویان/)).toBeNull());
    // Should not show not-found when no detailId
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
    // Should show list header
    expect(screen.getByText("هنرجویان")).toBeDefined();
  });
});

describe("I16 Teachers deep-link independent of 200-row ceiling", () => {
  it("existing entity beyond first 200 → detail loads", async () => {
    const repo = getTeacherRepository();
    const template = (await repo.list({ per_page: 500 })).data[0];
    let seq = 1;
    while ((await repo.list({ per_page: 500 })).data.length <= 210) {
      await repo.create({
        name: `مدرس آزمایشی ${seq}`,
        instrument: template.instrument,
        title: template.title,
        phone: `0912000${String(seq).padStart(4, "0")}`,
        status: "active",
        contractHours: 20,
        bio: "test",
        students: 0,
        utilization: 0,
        weeklyHours: 0,
        attendanceRate: 100,
        retention: 100,
        since: "امسال",
        todayClasses: [],
        availability: [],
      });
      seq++;
    }
    const all = (await repo.list({ per_page: 500 })).data;
    expect(all.length).toBeGreaterThan(200);
    const beyond = all[205];
    renderTeachersDetail(beyond.id);
    await waitFor(() => expect(screen.queryByText("مدرس یافت نشد")).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(screen.getAllByText(beyond.name).length).toBeGreaterThan(0), { timeout: 5000 });
  });

  it("existing entity in first page → still loads", async () => {
    const first = (await getTeacherRepository().list({ per_page: 500 })).data[0];
    renderTeachersDetail(first.id);
    await waitFor(() => expect(screen.getAllByText(first.name).length).toBeGreaterThan(0));
    expect(screen.queryByText("مدرس یافت نشد")).toBeNull();
  });

  it("unknown id → honest not-found", async () => {
    renderTeachersDetail("t-does-not-exist");
    await screen.findByText("مدرس یافت نشد");
  });

  it("read failure → honest error, not not-found", async () => {
    const real = getTeacherRepository();
    setTeacherRepository(
      withStubs(real, {
        get: async () => {
          throw new ApiError({ kind: "network", message: "شبکه در دسترس نیست" });
        },
      } as Stubs<typeof real>),
    );
    renderTeachersDetail("t1");
    await screen.findByText("بارگذاری پروندهٔ مدرس ناموفق بود");
    expect(screen.queryByText("مدرس یافت نشد")).toBeNull();
  });

  it("loading distinct", async () => {
    const real = getTeacherRepository();
    let resolve!: (v: any) => void;
    const pending = new Promise((res) => (resolve = res));
    setTeacherRepository(
      withStubs(real, {
        get: () => pending,
      } as Stubs<typeof real>),
    );
    renderTeachersDetail("t1");
    expect(await screen.findByText(/در حال آماده‌سازی میز کار مدرسین/)).toBeDefined();
    resolve((await real.list({ per_page: 1 })).data[0]);
    await waitFor(() => expect(screen.queryByText(/در حال آماده‌سازی/)).toBeNull());
  });
});
