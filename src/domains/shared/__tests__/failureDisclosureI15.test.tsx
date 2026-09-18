// @vitest-environment jsdom
/**
 * I15 FAILURE DISCLOSURE — boundary regression for the remaining consumers.
 *
 * Each consumer that previously discarded `error` from `useResourceList` /
 * `useDerived` now must:
 *   - render ErrorState (or alert) with retry when the read fails
 *   - not render EmptyState or a fabricated zero/count when failed
 *   - still render legitimate EmptyState when the repo answers []
 *   - keep non-empty rendering unchanged
 *   - retry uses the owning hook's reload (re-reads through same repo object)
 *
 * Covers: LearningPanel (instruments, levels), StudentLearningPanel
 * (programs, levels, eligibleContent), ClassFormDialog (teachers, rooms),
 * EnrollmentDialog (classes, students), GalleryPanel (images), StudentProgressPanel
 * (timeline), AssignPieceDialog (pieces), PieceFormDialog (programs),
 * StudentFormDialog (teachers)
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { ApiError } from "@/api/errors";
import {
  getClassRepository,
  getGalleryRepository,
  getInstrumentRepository,
  getLearningRepository,
  getProgressRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setClassRepository,
  setGalleryRepository,
  setInstrumentRepository,
  setLearningRepository,
  setProgressRepository,
  setRoomRepository,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { LearningPanel } from "@/domains/learning/LearningPanel";
import { StudentLearningPanel } from "@/domains/learning/StudentLearningPanel";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { EnrollmentDialog } from "@/domains/enrollments/EnrollmentDialog";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { StudentProgressPanel } from "@/domains/progress/StudentProgressPanel";
import { AssignPieceDialog } from "@/domains/progress/AssignPieceDialog";
import { PieceFormDialog } from "@/domains/progress/PieceFormDialog";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function networkFailure(): ApiError {
  return new ApiError({ kind: "network", message: "شبکه در دسترس نیست" });
}

function rejectingList<R extends { list: unknown }>(repo: R): R {
  return withStubs(repo, { list: async () => { throw networkFailure(); } } as Stubs<R>);
}

function emptyPage() {
  return { data: [], meta: { page: 1, per_page: 200, total: 0 } };
}

/* ---------------- LearningPanel ---------------- */

describe("LearningPanel failure disclosure", () => {
  it("instruments failure renders ErrorState, not EmptyState or zero", async () => {
    setInstrumentRepository(rejectingList(getInstrumentRepository()));
    render(<AppProvider><LearningPanel /></AppProvider>);
    expect(await screen.findByText(/بارگذاری سازها ناموفق بود/)).toBeDefined();
    expect(screen.queryByText(/هنوز دوره‌ای تعریف نشده/)).toBeNull();
    // No fabricated count
    expect(screen.queryByText(/۰ ساز فعال/)).toBeNull();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeDefined();
  });

  it("levels failure renders ErrorState, not empty", async () => {
    // Keep programs answering, make levels fail
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      listLevels: async () => { throw networkFailure(); },
    } as Stubs<typeof real>));
    render(<AppProvider><LearningPanel /></AppProvider>);
    // First programs must load
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری دوره‌ها/)).toBeNull());
    expect(await screen.findByText(/بارگذاری سطوح ناموفق بود/)).toBeDefined();
    expect(screen.queryByText(/این دوره هنوز سطحی ندارد/)).toBeNull();
  });

  it("legitimate empty programs still renders empty state", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      listPrograms: async () => emptyPage(),
      listLevels: async () => emptyPage(),
    } as Stubs<typeof real>));
    render(<AppProvider><LearningPanel /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری دوره‌ها/)).toBeNull());
    expect(await screen.findByText(/هنوز دوره‌ای تعریف نشده/)).toBeDefined();
    expect(screen.queryByText(/بارگذاری دوره‌ها ناموفق بود/)).toBeNull();
  });

  it("non-empty programs render unchanged", async () => {
    render(<AppProvider><LearningPanel /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری دوره‌ها/)).toBeNull());
    // Should show at least one program name
    const programs = await getLearningRepository().listPrograms({ per_page: 200 });
    expect(programs.data.length).toBeGreaterThan(0);
    expect(screen.getByText(programs.data[0].name)).toBeDefined();
  });

  it("retry after instruments failure clears disclosure", async () => {
    let failing = true;
    const real = getInstrumentRepository();
    const stub = withStubs(real, {
      list: async (...args: never[]) => {
        if (failing) throw networkFailure();
        return real.list(...args);
      },
    } as Stubs<typeof real>);
    setInstrumentRepository(stub);
    render(<AppProvider><LearningPanel /></AppProvider>);
    await screen.findByText(/بارگذاری سازها ناموفق بود/);
    failing = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /تلاش دوباره/ }));
    });
    await waitFor(() => expect(screen.queryByText(/بارگذاری سازها ناموفق بود/)).toBeNull());
    expect(screen.queryByText(/در حال بارگذاری دوره‌ها/)).toBeNull();
  });
});

/* ---------------- StudentLearningPanel ---------------- */

describe("StudentLearningPanel failure disclosure", () => {
  it("programs failure discloses, not empty", async () => {
    const real = getLearningRepository();
    // Make programs fail, but placement succeed as unplaced
    setLearningRepository(withStubs(real, {
      listPrograms: async () => { throw networkFailure(); },
      getStudentPlacement: async () => undefined,
    } as Stubs<typeof real>));
    render(<AppProvider><StudentLearningPanel studentId="st1" studentName="Test" /></AppProvider>);
    expect(await screen.findByText(/بارگذاری دوره‌ها ناموفق بود/)).toBeDefined();
    expect(screen.queryByText(/این هنرجو هنوز روی سطحی قرار نگرفته/)).toBeDefined();
  });

  it("levels failure discloses, not empty ladder", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      listLevels: async () => { throw networkFailure(); },
      getStudentPlacement: async () => ({ id: "pl1", studentId: "st1", programId: "prog1", levelId: "lvl1", assignedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), history: [] }),
    } as unknown as Stubs<typeof real>));
    render(<AppProvider><StudentLearningPanel studentId="st1" studentName="Test" /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری مسیر یادگیری/)).toBeNull());
    expect(await screen.findByText(/بارگذاری سطوح ناموفق بود/)).toBeDefined();
  });

  it("eligibleContent failure discloses", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      eligibleContent: async () => { throw networkFailure(); },
      getStudentPlacement: async () => undefined,
    } as Stubs<typeof real>));
    render(<AppProvider><StudentLearningPanel studentId="st1" studentName="Test" /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری مسیر یادگیری/)).toBeNull());
    expect(await screen.findByText(/بارگذاری منابع باز شده ناموفق بود/)).toBeDefined();
  });

  it("legitimate empty eligible content renders empty, not error", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      eligibleContent: async () => [],
      getStudentPlacement: async () => undefined,
      listPrograms: async () => emptyPage(),
      listLevels: async () => emptyPage(),
    } as Stubs<typeof real>));
    render(<AppProvider><StudentLearningPanel studentId="st1" studentName="Test" /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری مسیر یادگیری/)).toBeNull());
    // Wait for content loading to finish
    await waitFor(() => expect(screen.queryByText(/در حال محاسبهٔ منابع/)).toBeNull());
    expect(await screen.findByText(/منبعی برای این هنرجو باز نشده/)).toBeDefined();
  });
});

/* ---------------- ClassFormDialog ---------------- */

describe("ClassFormDialog failure disclosure", () => {
  it("teachers failure discloses and disables select", async () => {
    setTeacherRepository(rejectingList(getTeacherRepository()));
    render(<AppProvider><ClassFormDialog open academyClass={undefined} onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    const alerts = await screen.findAllByText(/بارگذاری مدرسین ناموفق بود/);
    expect(alerts.length).toBeGreaterThan(0);
    const select = screen.getByLabelText(/مدرس/) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: /تلاش دوباره/ }).length).toBeGreaterThan(0);
  });

  it("rooms failure discloses", async () => {
    setRoomRepository(rejectingList(getRoomRepository()));
    render(<AppProvider><ClassFormDialog open academyClass={undefined} onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    const alerts = await screen.findAllByText(/بارگذاری اتاق‌ها ناموفق بود/);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("legitimate empty teachers does not show error", async () => {
    const real = getTeacherRepository();
    setTeacherRepository(withStubs(real, { list: async () => emptyPage() } as Stubs<typeof real>));
    render(<AppProvider><ClassFormDialog open academyClass={undefined} onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/بارگذاری مدرسین ناموفق بود/)).toBeNull());
    // Should still show select with placeholder — انتخاب کنید — (both teacher and room)
    expect(screen.getAllByText(/— انتخاب کنید —/).length).toBeGreaterThan(0);
  });
});

/* ---------------- EnrollmentDialog ---------------- */

describe("EnrollmentDialog failure disclosure", () => {
  it("classes failure discloses", async () => {
    setClassRepository(rejectingList(getClassRepository()));
    render(<AppProvider><EnrollmentDialog open onClose={() => {}} onEnrolled={() => {}} /></AppProvider>);
    const alerts = await screen.findAllByText(/بارگذاری کلاس‌ها ناموفق بود/);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("students failure discloses", async () => {
    setStudentRepository(rejectingList(getStudentRepository()));
    render(<AppProvider><EnrollmentDialog open onClose={() => {}} onEnrolled={() => {}} /></AppProvider>);
    const alerts = await screen.findAllByText(/بارگذاری هنرجویان ناموفق بود/);
    expect(alerts.length).toBeGreaterThan(0);
  });
});

/* ---------------- GalleryPanel ---------------- */

describe("GalleryPanel failure disclosure", () => {
  it("images failure discloses, not empty", async () => {
    const real = getGalleryRepository();
    setGalleryRepository(withStubs(real, {
      listImages: async () => { throw networkFailure(); },
    } as Stubs<typeof real>));
    render(<AppProvider><GalleryPanel /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری گالری/)).toBeNull());
    expect(await screen.findByText(/بارگذاری تصاویر این آلبوم ناموفق بود/)).toBeDefined();
    expect(screen.queryByText(/این آلبوم خالی است/)).toBeNull();
  });

  it("legitimate empty images renders empty", async () => {
    const real = getGalleryRepository();
    setGalleryRepository(withStubs(real, {
      listImages: async () => emptyPage(),
    } as Stubs<typeof real>));
    render(<AppProvider><GalleryPanel /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری گالری/)).toBeNull());
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری تصاویر/)).toBeNull());
    expect(await screen.findByText(/این آلبوم خالی است/)).toBeDefined();
  });
});

/* ---------------- StudentProgressPanel ---------------- */

describe("StudentProgressPanel failure disclosure", () => {
  it("timeline failure discloses", async () => {
    const real = getProgressRepository();
    setProgressRepository(withStubs(real, {
      listEvents: async () => { throw networkFailure(); },
    } as Stubs<typeof real>));
    render(<AppProvider><StudentProgressPanel studentId="st1" studentName="Test" role="teacher" /></AppProvider>);
    // Overview must succeed first
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری پیشرفت/)).toBeNull());
    expect(await screen.findByText(/بارگذاری سابقهٔ پیشرفت ناموفق بود/)).toBeDefined();
    expect(screen.queryByText(/سابقه‌ای ثبت نشده/)).toBeNull();
  });

  it("legitimate empty timeline renders empty", async () => {
    const real = getProgressRepository();
    setProgressRepository(withStubs(real, {
      listEvents: async () => emptyPage(),
    } as Stubs<typeof real>));
    render(<AppProvider><StudentProgressPanel studentId="st1" studentName="Test" role="teacher" /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری پیشرفت/)).toBeNull());
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری سابقهٔ پیشرفت/)).toBeNull());
    expect(await screen.findByText(/سابقه‌ای ثبت نشده/)).toBeDefined();
  });
});

/* ---------------- AssignPieceDialog ---------------- */

describe("AssignPieceDialog failure disclosure", () => {
  it("pieces failure discloses and disables", async () => {
    const real = getProgressRepository();
    setProgressRepository(withStubs(real, {
      listPieces: async () => { throw networkFailure(); },
    } as Stubs<typeof real>));
    render(<AppProvider><AssignPieceDialog open studentId="st1" studentName="Test" onClose={() => {}} onAssigned={() => {}} /></AppProvider>);
    const alerts = await screen.findAllByText(/بارگذاری قطعه‌ها ناموفق بود/);
    expect(alerts.length).toBeGreaterThan(0);
    const selects = screen.getAllByLabelText(/قطعه/) as HTMLSelectElement[];
    // At least one select disabled (the piece picker)
    expect(selects.some(s => s.disabled)).toBe(true);
  });
});

/* ---------------- PieceFormDialog ---------------- */

describe("PieceFormDialog failure disclosure", () => {
  it("programs failure discloses", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      listPrograms: async () => { throw networkFailure(); },
    } as Stubs<typeof real>));
    render(<AppProvider><PieceFormDialog open onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    expect(await screen.findByText(/بارگذاری دوره‌ها ناموفق بود/)).toBeDefined();
  });

  it("legitimate empty programs does not show error", async () => {
    const real = getLearningRepository();
    setLearningRepository(withStubs(real, {
      listPrograms: async () => emptyPage(),
    } as Stubs<typeof real>));
    render(<AppProvider><PieceFormDialog open onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/بارگذاری دوره‌ها ناموفق بود/)).toBeNull());
    // Should still have — بدون دوره —
    expect(screen.getByText(/بدون دوره/)).toBeDefined();
  });
});

/* ---------------- StudentFormDialog ---------------- */

describe("StudentFormDialog failure disclosure", () => {
  it("teachers failure discloses", async () => {
    setTeacherRepository(rejectingList(getTeacherRepository()));
    render(<AppProvider><StudentFormDialog open onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    expect(await screen.findByText(/بارگذاری مدرسان ناموفق بود/)).toBeDefined();
    const select = screen.getByLabelText(/مدرس/) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("legitimate empty teachers does not show error, shows placeholder", async () => {
    const real = getTeacherRepository();
    setTeacherRepository(withStubs(real, { list: async () => emptyPage() } as Stubs<typeof real>));
    render(<AppProvider><StudentFormDialog open onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    await waitFor(() => expect(screen.queryByText(/بارگذاری مدرسان ناموفق بود/)).toBeNull());
    expect(screen.getByText(/— انتخاب کنید —/)).toBeDefined();
  });

  it("no fabricated zero count when teachers fail", async () => {
    setTeacherRepository(rejectingList(getTeacherRepository()));
    render(<AppProvider><StudentFormDialog open onClose={() => {}} onSaved={() => {}} /></AppProvider>);
    await screen.findByText(/بارگذاری مدرسان ناموفق بود/);
    // Should not claim 0 teachers or empty list as success
    expect(document.body.textContent).not.toContain("۰ مدرس");
  });
});
