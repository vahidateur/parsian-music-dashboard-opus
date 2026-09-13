// @vitest-environment jsdom
/**
 * Scheduling view — the read wiring (M4 / CP1).
 *
 * Every case supplies its own data through stub repositories whose ids and titles
 * exist nowhere else in the codebase (`cls_probe_theory`, «کلاس تئوری آزمایشی»,
 * «اتاق آزمایشی»). That is deliberate on two counts: a case that could pass by
 * rendering the demo seed or the retired `weekSessions` fixture would not be
 * testing the wiring at all, and the seeded schedule is anchored to fixed dates,
 * so a case resting on it silently expires.
 *
 * What is asserted here is the shape of the reads (a bounded window and a stated
 * page size), the states they produce (loading, error, empty, truncated), and that
 * the calendar renders each session's own fields instead of an inferred story
 * about them — including the two stories this view used to invent: a conflict
 * verdict and a "completed" status read off the clock.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AppProvider } from "@/context/AppContext";
import type { ClassRepository } from "@/domains/classes/repository";
import type { AcademyClass, ClassListParams } from "@/domains/classes/types";
import {
  setClassRepository,
  setRoomRepository,
  setSchedulingRepository,
  setTeacherRepository,
} from "@/domains/registry";
import type { RoomRepository } from "@/domains/rooms/repository";
import type { Room, RoomListParams } from "@/domains/rooms/types";
import { addDays, isoToJalaliDisplay, weekdayIndex } from "@/domains/scheduling/dateBridge";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import type { Session, SessionListParams } from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import type { TeacherRepository } from "@/domains/teachers/repository";
import type { Teacher, TeacherListParams } from "@/domains/teachers/types";
import { SchedulingView } from "@/views/Scheduling";

/* ------------------------------------------------------------------ */
/* Probe data — identities that exist nowhere else                     */
/* ------------------------------------------------------------------ */

/** Fully typed: a missing field is a compile error, not a silent `undefined`. */
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

function room(over: Partial<Room> & { id: string; name: string }): Room {
  return { kind: "آموزشی", capacity: 8, occupancy: 2, ...over };
}

function teacher(over: Partial<Teacher> & { id: string; name: string }): Teacher {
  return {
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
const VOICE_CLASS = academyClass({ id: "cls_probe_voice", title: "کلاس آواز آزمایشی", instrument: "voice" });
const ROOM_A = room({ id: "room_probe", name: "اتاق آزمایشی" });
const ROOM_B = room({ id: "room_probe_b", name: "اتاق دوم آزمایشی" });
const PROBE_TEACHER = teacher({ id: "tea_probe", name: "مدرس آزمایشی" });

/* ------------------------------------------------------------------ */
/* The academy's own dates, derived the way the view derives them       */
/* ------------------------------------------------------------------ */

function isoOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoOf(academyNow());
/** Saturday-first, matching `weekdayIndex` — the domain's own convention. */
const WEEK_START = addDays(TODAY, -(weekdayIndex(TODAY) ?? 0))!;
const WEEK_END = addDays(WEEK_START, 6)!;
const NEXT_WEEK_START = addDays(WEEK_START, 7)!;
const NEXT_WEEK_END = addDays(NEXT_WEEK_START, 6)!;
const YESTERDAY = addDays(TODAY, -1)!;
/**
 * Another day of the SAME week, whichever weekday the suite runs on: `TOMORROW`
 * would fall outside the window on a Friday, and today's own date would make the
 * day-narrowing case below vacuous.
 */
const OTHER_DAY = WEEK_START === TODAY ? WEEK_END : WEEK_START;

const SESSION_TODAY = session({ id: "ses_probe_today", date: TODAY, startTime: "16:00", endTime: "17:00" });
const SESSION_OTHER_DAY = session({
  id: "ses_probe_other",
  date: OTHER_DAY,
  classId: DRUMS_CLASS.id,
  roomId: ROOM_B.id,
  startTime: "18:00",
  endTime: "19:00",
  status: "cancelled",
  cancelReason: "بیماری مدرس",
});
/** A session whose date has passed but whose status was never changed. */
const SESSION_PAST = session({
  id: "ses_probe_past",
  date: YESTERDAY,
  classId: VOICE_CLASS.id,
  startTime: "09:00",
  endTime: "10:00",
});

const PROBE_CLASSES = [THEORY_CLASS, DRUMS_CLASS, VOICE_CLASS];
const PROBE_SESSIONS = [SESSION_TODAY, SESSION_OTHER_DAY, SESSION_PAST];

/* ------------------------------------------------------------------ */
/* Stub repositories                                                   */
/* ------------------------------------------------------------------ */

function pageOf<T>(rows: T[], total = rows.length, perPage = 200): Page<T> {
  return { data: rows, meta: { page: 1, per_page: perPage, total } };
}

/**
 * A window-aware `list`: it answers only the sessions that fall inside the
 * `from`/`to` the view asked for, and honours the room and teacher filters, so a
 * navigation or filter change is visible in the DOM and not only in the params.
 * `total` can be overridden to describe a window larger than the page returned.
 */
function schedulingRepo(
  rows: readonly Session[] = PROBE_SESSIONS,
  options: { fail?: () => boolean; total?: (matched: Session[]) => number } = {},
) {
  const list = vi.fn(async (params: SessionListParams = {}) => {
    if (options.fail?.()) {
      throw new ApiError({ kind: "server", code: "SCHEDULING_DOWN", message: "سرور برنامه‌ریزی پاسخ نداد." });
    }
    const matched = rows.filter(
      (row) =>
        (params.from === undefined || row.date >= params.from) &&
        (params.to === undefined || row.date <= params.to) &&
        (params.roomId === undefined || row.roomId === params.roomId) &&
        (params.teacherId === undefined || row.teacherId === params.teacherId),
    );
    return pageOf(matched, options.total ? options.total(matched) : matched.length, params.per_page);
  });
  return { repository: { list } as unknown as SchedulingRepository, list };
}

function classRepo(rows: readonly AcademyClass[] = PROBE_CLASSES) {
  const list = vi.fn(async (_params: ClassListParams) => pageOf([...rows]));
  return { repository: { list } as unknown as ClassRepository, list };
}

function roomRepo(rows: readonly Room[] = [ROOM_A, ROOM_B]) {
  const list = vi.fn(async (_params: RoomListParams) => pageOf([...rows]));
  return { repository: { list } as unknown as RoomRepository, list };
}

function teacherRepo(rows: readonly Teacher[] = [PROBE_TEACHER]) {
  const list = vi.fn(async (_params: TeacherListParams) => pageOf([...rows]));
  return { repository: { list } as unknown as TeacherRepository, list };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

let sessions: ReturnType<typeof schedulingRepo>;
let classes: ReturnType<typeof classRepo>;
let rooms: ReturnType<typeof roomRepo>;
let teachers: ReturnType<typeof teacherRepo>;

function install(next: {
  sessions?: ReturnType<typeof schedulingRepo>;
  classes?: ReturnType<typeof classRepo>;
  rooms?: ReturnType<typeof roomRepo>;
  teachers?: ReturnType<typeof teacherRepo>;
} = {}) {
  sessions = next.sessions ?? schedulingRepo();
  classes = next.classes ?? classRepo();
  rooms = next.rooms ?? roomRepo();
  teachers = next.teachers ?? teacherRepo();
  setSchedulingRepository(sessions.repository);
  setClassRepository(classes.repository);
  setRoomRepository(rooms.repository);
  setTeacherRepository(teachers.repository);
}

function renderView(hash = "#/schedule") {
  window.location.hash = hash;
  return render(
    <AppProvider>
      <SchedulingView />
      <Toasts />
    </AppProvider>,
  );
}

/** Waits on the probe's own data, never on a timer or on a spinner going away. */
async function expectSessions() {
  await screen.findByText(THEORY_CLASS.title);
}

/** The first read's params: the window the calendar opened on. */
function firstParams(): SessionListParams {
  return sessions.list.mock.calls[0]?.[0] ?? {};
}

function lastParams(): SessionListParams {
  return sessions.list.mock.calls[sessions.list.mock.calls.length - 1]?.[0] ?? {};
}

/** Clicks the grid block carrying a class title, in either density. */
async function openSession(title: string) {
  const label = await screen.findByText(title);
  const block = label.closest("button");
  expect(block, `no session block for ${title}`).not.toBeNull();
  fireEvent.click(block!);
  return screen.findByRole("dialog");
}

async function closeDrawer() {
  const drawer = screen.getByRole("dialog");
  fireEvent.click(screen.getAllByRole("button", { name: "بستن" })[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(drawer).toBeTruthy();
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

beforeEach(() => {
  window.location.hash = "";
  install();
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

describe("SchedulingView reads", () => {
  it("asks for a bounded window with an explicit page size on every read", async () => {
    renderView();
    await expectSessions();

    expect(sessions.list.mock.calls.length).toBeGreaterThan(0);
    for (const call of sessions.list.mock.calls) {
      const params = call[0] ?? {};
      // A session read with no window is a read of the whole table; one with no
      // page size silently falls back to the API default and truncates (I16).
      expect(params.from, "a session read without a lower bound").toBeTruthy();
      expect(params.to, "a session read without an upper bound").toBeTruthy();
      expect(params.per_page).toBe(200);
      // Cancelled sessions stay visible, so the view must not ask to hide them.
      expect(params.activeOnly).toBeUndefined();
    }
    expect(firstParams()).toMatchObject({ from: WEEK_START, to: WEEK_END });

    // The supporting reads state their own ceiling too. (The second argument is
    // the read's AbortSignal, so the params are asserted, not the call shape.)
    expect(classes.list.mock.calls[0]?.[0]).toMatchObject({ per_page: 200 });
    expect(rooms.list.mock.calls[0]?.[0]).toMatchObject({ per_page: 200 });
    expect(teachers.list.mock.calls[0]?.[0]).toMatchObject({ per_page: 200 });
  });

  it("renders the sessions the repository returned, and none of the retired fixture", async () => {
    renderView();
    await expectSessions();

    await screen.findByText(DRUMS_CLASS.title);
    // Rooms and teachers come from the same reads: the probe's own, not `r1`–`r4`.
    // Both appear twice — as a filter chip and in the legend — which is the point.
    await waitFor(() => expect(screen.getAllByText(ROOM_A.name).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText(PROBE_TEACHER.name).length).toBeGreaterThan(0));

    // Fixture vocabulary. None of it is reachable from a repository read.
    for (const retired of [
      "پیانو گروهی · میانی",
      "ویولن انفرادی",
      "اتاق ۱",
      "اشغال اتاق‌ها",
      "فشار اتاق‌ها",
      "بازه‌های خالی",
      "پیشنهاد هوش",
      "تعارض اتاق ۱ در سه‌شنبه ساعت ۱۴:۰۰",
    ]) {
      expect(document.body.textContent, retired).not.toContain(retired);
    }
  });

  it("places each block by its own start time and duration", async () => {
    renderView();
    await expectSessions();

    const theory = screen.getByText(THEORY_CLASS.title).closest("button")!;
    const drums = screen.getByText(DRUMS_CLASS.title).closest("button")!;
    const topOf = (block: HTMLElement) => Number.parseFloat(block.style.top);
    const heightOf = (block: HTMLElement) => Number.parseFloat(block.style.height);
    for (const block of [theory, drums]) {
      // A block that cannot be placed would be a session at the wrong time, so
      // the geometry has to be a real number of pixels.
      expect(Number.isFinite(topOf(block)), `${block.style.top} is not a position`).toBe(true);
      expect(Number.isFinite(heightOf(block))).toBe(true);
    }
    // 16:00–17:00 and 18:00–19:00: the same duration, so the same height, and
    // two hours apart, so exactly twice that height further down. Position and
    // size come from one minutes→pixels scale over the session's own times — not
    // from a fixture's index in a weekly array.
    expect(heightOf(drums)).toBeCloseTo(heightOf(theory), 5);
    expect((topOf(drums) - topOf(theory)) / 120).toBeCloseTo(heightOf(theory) / 60, 5);
  });

  it("reports a session's own status, including a cancellation and its reason", async () => {
    renderView();
    await expectSessions();

    const drawer = await openSession(DRUMS_CLASS.title);
    // The status is the session's own `cancelled`, and the legend also names it —
    // so the badge is looked for inside the drawer, not anywhere on the page.
    expect(await within(drawer).findByText("لغو شده")).toBeTruthy();
    expect(within(drawer).getByText("بیماری مدرس")).toBeTruthy();
    expect(within(drawer).queryByText("برگزار شده")).toBeNull();
  });

  it("does not infer «برگزار شده» from a date that has passed", async () => {
    renderView();
    await expectSessions();

    // Day mode, one day back: the session's date is in the past, its status is
    // still `scheduled`. Guessing "completed" off the clock would be a fabricated
    // fact about a session nobody marked.
    fireEvent.click(screen.getByRole("tab", { name: "روز" }));
    fireEvent.click(await screen.findByRole("button", { name: "روز قبل" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ from: YESTERDAY, to: YESTERDAY }));
    // The past session's own class title, from the day window's own read.
    await screen.findByText(VOICE_CLASS.title);

    await openSession(VOICE_CLASS.title);
    expect(await screen.findByText("برنامه‌ریزی‌شده")).toBeTruthy();
    expect(screen.queryByText("برگزار شده")).toBeNull();
  });

  it("narrows to a day window when the mode changes", async () => {
    renderView();
    await expectSessions();

    const tab = screen.getByRole("tab", { name: "روز" });
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-selected")).toBe("true");

    await waitFor(() => expect(lastParams()).toMatchObject({ from: TODAY, to: TODAY }));
    // The other day's session is not in this window, so it is not on screen: what
    // the calendar shows follows the read, not the other way round.
    await waitFor(() => expect(screen.queryByText(DRUMS_CLASS.title)).toBeNull());
    expect(screen.getByText(THEORY_CLASS.title)).toBeTruthy();
  });

  it("moves the window with its own navigation and labels the real dates", async () => {
    renderView();
    await expectSessions();

    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ from: NEXT_WEEK_START, to: NEXT_WEEK_END }));

    // The label is the window that was actually read, in Jalali, as presented.
    const expected = `${isoToJalaliDisplay(NEXT_WEEK_START, { day: "numeric", month: "short" })} – ${isoToJalaliDisplay(
      NEXT_WEEK_END,
      { day: "numeric", month: "short" },
    )}`;
    // The filter bar and the window stat both carry it; either is the truth.
    await waitFor(() => expect(screen.getAllByText(expected).length).toBeGreaterThan(0));

    // The probe holds nothing in that week, and the view says so plainly.
    expect(await screen.findByText("جلسه‌ای در این بازه نیست")).toBeTruthy();
    expect(screen.queryByText(THEORY_CLASS.title)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ قبل" }));
    await expectSessions();
    expect(lastParams()).toMatchObject({ from: WEEK_START, to: WEEK_END });
  });

  it("sends the room and teacher filters to the repository instead of filtering fixtures", async () => {
    renderView();
    await expectSessions();

    fireEvent.click(screen.getByRole("button", { name: ROOM_A.name }));
    await waitFor(() => expect(lastParams()).toMatchObject({ roomId: ROOM_A.id }));
    await waitFor(() => expect(screen.queryByText(DRUMS_CLASS.title)).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: PROBE_TEACHER.name }));
    await waitFor(() => expect(lastParams()).toMatchObject({ roomId: ROOM_A.id, teacherId: PROBE_TEACHER.id }));

    // Clearing a filter removes it from the read rather than widening it locally.
    fireEvent.click(screen.getByRole("button", { name: "همهٔ اتاق‌ها" }));
    await waitFor(() => expect(lastParams().roomId).toBeUndefined());
  });

  it("shows an empty window as an empty window", async () => {
    install({ sessions: schedulingRepo([]) });
    renderView();

    expect(await screen.findByText("جلسه‌ای در این بازه نیست")).toBeTruthy();
    expect(screen.getByText(/جلسه‌ای ثبت نشده است/)).toBeTruthy();
    // An empty answer is not a failure, and it is not a fabricated narrative.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.textContent).not.toContain("اشغال اتاق");
  });

  it("reports a failed read with its own message and a retry, never as an empty window", async () => {
    let fail = true;
    install({ sessions: schedulingRepo(PROBE_SESSIONS, { fail: () => fail }) });
    renderView();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("جلسات این بازه خوانده نشد");
    // The repository's own message, not a generic one and not an empty state.
    expect(alert.textContent).toContain("سرور برنامه‌ریزی پاسخ نداد.");
    expect(screen.queryByText("جلسه‌ای در این بازه نیست")).toBeNull();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /تلاش دوباره/ }));
    await expectSessions();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sessions.list.mock.calls.length).toBeGreaterThan(1);
  });

  it("says when the window is larger than the page it got", async () => {
    install({ sessions: schedulingRepo(PROBE_SESSIONS, { total: (matched) => matched.length + 5 }) });
    renderView();
    await expectSessions();

    // Three sessions are on screen; the window holds eight.
    expect(await screen.findByText(/این بازه .* جلسه دارد؛ .* جلسه نمایش داده شده است/)).toBeTruthy();
    expect(screen.getByText(/تقویم کامل نیست/)).toBeTruthy();
    // A per-day breakdown of a partial page would be a partial answer dressed as a
    // complete one, so the day counts are withheld while the notice stands.
    expect(screen.queryAllByText(/^[۰-۹]+ جلسه$/)).toHaveLength(0);
  });

  it("counts per day only when the page is the whole window", async () => {
    renderView();
    await expectSessions();

    expect(screen.queryByText(/تقویم کامل نیست/)).toBeNull();
    // Today's column carries exactly the one session the probe put there.
    expect(screen.getAllByText(/^۱ جلسه$/).length).toBeGreaterThan(0);
  });

  it("honours the conflict deep link as view state, without a write or a toast", async () => {
    renderView("#/schedule?filter=conflict");
    await expectSessions();

    // The intent this read-only checkpoint can honour: today, on its own, and
    // from the first read — no week window fetched and thrown away.
    await waitFor(() => expect(lastParams()).toMatchObject({ from: TODAY, to: TODAY }));
    expect(sessions.list.mock.calls).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "روز" }).getAttribute("aria-selected")).toBe("true");
    // And the part it cannot: said plainly, rather than an invented conflict card.
    expect(screen.getByText(/موتور تعارض/)).toBeTruthy();
    for (const retired of ["تعارض اتاق ۱ در سه‌شنبه ساعت ۱۴:۰۰", "مشاهده در تقویم", "انتقال به اتاق ۴"]) {
      expect(document.body.textContent, retired).not.toContain(retired);
    }
    expect(toastText()).toBe("");
  });

  it("honours the new-slot deep link without claiming a generation", async () => {
    renderView("#/schedule?filter=new-slot");
    await expectSessions();

    await waitFor(() => expect(lastParams()).toMatchObject({ from: TODAY, to: TODAY }));
    expect(screen.getByText(/زمان‌بندی خودکار/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("پیشنهاد بازهٔ جدید ثبت شد");
    expect(toastText()).toBe("");
  });

  it("opens a session's drawer from the loaded page and closes it on the user's own act", async () => {
    renderView();
    await expectSessions();

    const drawer = await openSession(THEORY_CLASS.title);
    // The drawer's facts are this session's, read from the domains.
    expect(drawer.textContent).toContain(THEORY_CLASS.title);
    expect(drawer.textContent).toContain(PROBE_TEACHER.name);
    expect(drawer.textContent).toContain(ROOM_A.name);
    expect(drawer.textContent).toContain("۱۶:۰۰");
    expect(drawer.textContent).toContain(isoToJalaliDisplay(TODAY, { weekday: "long", day: "numeric", month: "long" }));

    await closeDrawer();
    expect(toastText()).toBe("");
  });
});
