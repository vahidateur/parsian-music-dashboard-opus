// @vitest-environment jsdom
/**
 * A calendar window that is still loading must not show the previous window.
 *
 * This is OPEN_ITEMS I13 in the place it hurts most. A schedule is read per
 * window, so navigating from one week to the next replaces *every* row on screen
 * at once, and the view keeps a selected session beside it. If the previous
 * window's rows, its per-day counts or its open drawer survive the navigation —
 * even for one committed frame — the user is looking at one week's sessions under
 * another week's heading, and the control they click belongs to a session that is
 * no longer on screen.
 *
 * `useResourceList` already refuses to expose a page that answers a different
 * query. What this file pins down is the view's own half of that: the selection is
 * an id resolved against the loaded page, so the drawer closes with the window
 * instead of following the user into the next one, and nothing else in the view
 * caches rows of its own.
 *
 * The reads are settled by hand (`deferred`), so "still in flight" is a state the
 * test controls rather than a race it hopes to win. No case here waits on a timer.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "@/api/types";
import { AppProvider } from "@/context/AppContext";
import type { ClassRepository } from "@/domains/classes/repository";
import type { AcademyClass } from "@/domains/classes/types";
import {
  setClassRepository,
  setRoomRepository,
  setSchedulingRepository,
  setTeacherRepository,
} from "@/domains/registry";
import type { RoomRepository } from "@/domains/rooms/repository";
import type { Room } from "@/domains/rooms/types";
import { addDays, isoToJalaliDisplay, weekdayIndex } from "@/domains/scheduling/dateBridge";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { Session, SessionListParams } from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import type { TeacherRepository } from "@/domains/teachers/repository";
import type { Teacher } from "@/domains/teachers/types";
import { SchedulingView } from "@/views/Scheduling";

/* ------------------------------------------------------------------ */
/* Probe data                                                          */
/* ------------------------------------------------------------------ */

function academyClass(over: Partial<AcademyClass> & { id: string; title: string }): AcademyClass {
  return {
    instrument: "theory",
    teacherId: "tea_probe",
    roomId: "room_probe",
    kind: "group",
    level: "سطح ۱",
    days: [0],
    time: "16:00",
    duration: 60,
    enrolled: 4,
    capacity: 8,
    attendanceAvg: 90,
    waitlist: 0,
    tuition: 1_800_000,
    termProgress: 40,
    studentIds: [],
    ...over,
  };
}

function session(over: Partial<Session> & { id: string; date: string }): Session {
  return {
    classId: "cls_probe_theory",
    teacherId: "tea_probe",
    roomId: "room_probe",
    startTime: "16:00",
    endTime: "17:00",
    status: "scheduled",
    origin: "manual",
    createdAt: "2026-01-01T08:00:00Z",
    updatedAt: "2026-01-01T08:00:00Z",
    ...over,
  };
}

const THEORY_CLASS = academyClass({ id: "cls_probe_theory", title: "کلاس تئوری آزمایشی" });
const DRUMS_CLASS = academyClass({ id: "cls_probe_drums", title: "کلاس درامز آزمایشی", instrument: "drums" });
const ROOM_A: Room = { id: "room_probe", name: "اتاق آزمایشی", kind: "آموزشی", capacity: 8, occupancy: 2 };
const ROOM_B: Room = { id: "room_probe_b", name: "اتاق دوم آزمایشی", kind: "آموزشی", capacity: 6, occupancy: 1 };
const PROBE_TEACHER: Teacher = {
  id: "tea_probe",
  name: "مدرس آزمایشی",
  instrument: "theory",
  title: "مدرس",
  students: 4,
  utilization: 40,
  weeklyHours: 8,
  contractHours: 20,
  attendanceRate: 95,
  retention: 90,
  todayClasses: [],
  availability: [],
  since: "۱۴۰۳",
  phone: "۰۹۱۲۰۰۰۰۰۰۰",
  status: "active",
  bio: "",
};

function isoOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoOf(academyNow());
const WEEK_A_START = addDays(TODAY, -(weekdayIndex(TODAY) ?? 0))!;
const WEEK_A_END = addDays(WEEK_A_START, 6)!;
const WEEK_B_START = addDays(WEEK_A_START, 7)!;
const WEEK_B_END = addDays(WEEK_B_START, 6)!;

/** One session per window, each with facts the other does not have. */
const SESSION_A = session({ id: "ses_probe_a", date: WEEK_A_END, startTime: "16:00", endTime: "17:00" });
const SESSION_B = session({
  id: "ses_probe_b",
  date: WEEK_B_START,
  classId: DRUMS_CLASS.id,
  roomId: ROOM_B.id,
  startTime: "11:00",
  endTime: "12:30",
  notes: "یادداشت پنجرهٔ دوم",
});

function windowLabel(from: string, to: string): string {
  const short = { day: "numeric", month: "short" } as const;
  return `${isoToJalaliDisplay(from, short)} – ${isoToJalaliDisplay(to, short)}`;
}

/* ------------------------------------------------------------------ */
/* A scheduling read the test settles by hand                          */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const windowKey = (params: SessionListParams) => `${params.from}|${params.to}`;

function controlledScheduling() {
  /** Every ask per window, in order, so a superseded one can be settled late. */
  const asks = new Map<string, Deferred<Page<Session>>[]>();

  const list = vi.fn((params: SessionListParams = {}) => {
    const key = windowKey(params);
    const pending = deferred<Page<Session>>();
    asks.set(key, [...(asks.get(key) ?? []), pending]);
    return pending.promise;
  });

  setSchedulingRepository({ list } as unknown as SchedulingRepository);

  return {
    list,
    /** How many reads were made for one window. */
    asksFor: (from: string, to: string) => asks.get(`${from}|${to}`)?.length ?? 0,
    /** Lets the newest read for a window resolve with its own sessions. */
    settle: async (from: string, to: string, rows: Session[]) => {
      const all = asks.get(`${from}|${to}`) ?? [];
      const pending = all[all.length - 1];
      expect(pending, `no pending read for ${from}..${to}`).toBeDefined();
      await act(async () => {
        pending.resolve({ data: rows, meta: { page: 1, per_page: 200, total: rows.length } });
      });
    },
    /** Lets a SPECIFIC — possibly superseded — read resolve. */
    settleAsk: async (from: string, to: string, index: number, rows: Session[]) => {
      const pending = asks.get(`${from}|${to}`)?.[index];
      if (!pending) throw new Error(`no read #${index} for ${from}..${to}`);
      await act(async () => {
        pending.resolve({ data: rows, meta: { page: 1, per_page: 200, total: rows.length } });
      });
    },
  };
}

let scheduling: ReturnType<typeof controlledScheduling>;

function renderView() {
  window.location.hash = "#/schedule";
  return render(
    <AppProvider>
      <SchedulingView />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "";
  setClassRepository({
    list: vi.fn(async () => ({ data: [THEORY_CLASS, DRUMS_CLASS], meta: { page: 1, per_page: 200, total: 2 } })),
  } as unknown as ClassRepository);
  setRoomRepository({
    list: vi.fn(async () => ({ data: [ROOM_A, ROOM_B], meta: { page: 1, per_page: 200, total: 2 } })),
  } as unknown as RoomRepository);
  setTeacherRepository({
    list: vi.fn(async () => ({ data: [PROBE_TEACHER], meta: { page: 1, per_page: 200, total: 1 } })),
  } as unknown as TeacherRepository);
  scheduling = controlledScheduling();
});

afterEach(() => {
  cleanup();
  setSchedulingRepository(undefined);
  setClassRepository(undefined);
  setRoomRepository(undefined);
  setTeacherRepository(undefined);
  window.location.hash = "";
});

/* ------------------------------------------------------------------ */

describe("SchedulingView across window changes", () => {
  it("shows window A, then nothing of A while window B is in flight, then only B", async () => {
    renderView();

    // Window A is in flight from the first frame: the view says so rather than
    // showing an empty calendar that could be read as "no sessions this week".
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText(/در حال خواندن جلسات این بازه/)).toBeTruthy();

    await scheduling.settle(WEEK_A_START, WEEK_A_END, [SESSION_A]);

    // A's own data, and only A's.
    expect(await screen.findByText(THEORY_CLASS.title)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(windowLabel(WEEK_A_START, WEEK_A_END)).length).toBeGreaterThan(0));
    expect(screen.queryByText(DRUMS_CLASS.title)).toBeNull();

    // The user opens A's session.
    fireEvent.click(screen.getByText(THEORY_CLASS.title).closest("button")!);
    const drawer = await screen.findByRole("dialog");
    expect(drawer.textContent).toContain(THEORY_CLASS.title);
    expect(drawer.textContent).toContain("۱۶:۰۰");

    // Navigate to window B and leave it pending.
    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await waitFor(() => expect(scheduling.asksFor(WEEK_B_START, WEEK_B_END)).toBe(1));

    // A is gone: its row, its drawer, and the facts that were in it. What stands
    // in their place is the in-flight marker for the window being read.
    expect(screen.queryByText(THEORY_CLASS.title)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("۱۶:۰۰")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
    // …and the heading already belongs to B, so nothing on screen claims to be A.
    await waitFor(() => expect(screen.getAllByText(windowLabel(WEEK_B_START, WEEK_B_END)).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(windowLabel(WEEK_A_START, WEEK_A_END))).toHaveLength(0);

    await scheduling.settle(WEEK_B_START, WEEK_B_END, [SESSION_B]);

    expect(await screen.findByText(DRUMS_CLASS.title)).toBeTruthy();
    expect(screen.queryByText(THEORY_CLASS.title)).toBeNull();
    // The selection did not survive the window either: A's drawer stays closed
    // until the user opens a session that belongs to B.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByText(DRUMS_CLASS.title).closest("button")!);
    const second = await screen.findByRole("dialog");
    expect(second.textContent).toContain(DRUMS_CLASS.title);
    expect(second.textContent).toContain("۱۱:۰۰");
    expect(second.textContent).toContain("یادداشت پنجرهٔ دوم");
    expect(second.textContent).not.toContain("۱۶:۰۰");
  });

  it("ignores a superseded window's answer that arrives late", async () => {
    renderView();

    // A is asked for and left unanswered: the user navigates on before the server
    // gets back, which is the ordinary way a stale answer is created.
    await waitFor(() => expect(scheduling.asksFor(WEEK_A_START, WEEK_A_END)).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await waitFor(() => expect(scheduling.asksFor(WEEK_B_START, WEEK_B_END)).toBe(1));

    // The superseded read answers anyway. Its rows belong to a window that is no
    // longer on screen, so they must not appear — not even for one frame.
    await scheduling.settleAsk(WEEK_A_START, WEEK_A_END, 0, [SESSION_A]);
    expect(screen.queryByText(THEORY_CLASS.title)).toBeNull();
    expect(screen.queryAllByText(windowLabel(WEEK_A_START, WEEK_A_END))).toHaveLength(0);
    expect(screen.getByRole("status")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(windowLabel(WEEK_B_START, WEEK_B_END)).length).toBeGreaterThan(0));

    // And when B answers, B is all there is.
    await scheduling.settle(WEEK_B_START, WEEK_B_END, [SESSION_B]);
    expect(await screen.findByText(DRUMS_CLASS.title)).toBeTruthy();
    expect(screen.queryByText(THEORY_CLASS.title)).toBeNull();
  });

  it("reads each window once, with its own bounds", async () => {
    renderView();
    await scheduling.settle(WEEK_A_START, WEEK_A_END, [SESSION_A]);
    expect(await screen.findByText(THEORY_CLASS.title)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await scheduling.settle(WEEK_B_START, WEEK_B_END, [SESSION_B]);
    expect(await screen.findByText(DRUMS_CLASS.title)).toBeTruthy();

    const windows = scheduling.list.mock.calls.map(([params]) => `${params?.from}|${params?.to}`);
    expect(windows).toEqual([`${WEEK_A_START}|${WEEK_A_END}`, `${WEEK_B_START}|${WEEK_B_END}`]);
    for (const call of scheduling.list.mock.calls) {
      expect(call[0]?.per_page).toBe(200);
    }
  });
});
