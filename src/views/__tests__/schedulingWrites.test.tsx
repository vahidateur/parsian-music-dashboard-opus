// @vitest-environment jsdom
/**
 * Scheduling writes — reschedule and cancel (M4 / CP2).
 *
 * WHAT THESE CASES PROVE
 *
 * The view's half of the write contract, which is the half no domain test can
 * see: that a success is claimed only AFTER the repository's promise resolved,
 * that a refusal is reported in the repository's own words and changes nothing on
 * screen, that the write target is the session the user can actually see, and
 * that what appears afterwards is a re-read rather than a local edit.
 *
 * WHY A DOUBLE STANDS IN FOR THE REPOSITORY
 *
 * Fourteen of the sixteen cases drive a stub whose ids and titles exist nowhere
 * else in the codebase, for the same reason CP1's read tests do: a case that could
 * pass by rendering the demo seed is not testing the wiring, and the seeded
 * schedule is anchored to fixed dates that stop covering the current week. The
 * double mirrors the repository's documented reschedule semantics (a linked
 * replacement plus the original kept as cancelled) so the cases can assert what the
 * view makes visible after a write; the semantics themselves are the domain's, and
 * are proven by its own frozen tests.
 *
 * TWO CASES CROSS INTO THE REAL DEMO REPOSITORIES, because two questions cannot be
 * answered by a double:
 *
 *   - the attendance refusal: real attendance is recorded through the attendance
 *     repository, and the refusal the domain produces has to reach the user
 *     verbatim — the invariant is the repository's, and the view's job is not to
 *     soften it (E-4);
 *   - the whole chain, at the end of this file: a REAL stored conflict, the REAL
 *     engine's verdict through the REAL form, a refused attempt that mutates
 *     nothing, and then a write the REAL repository performed — asserted on the
 *     persisted rows and on the engine's own verdict after a re-read. A double
 *     could only ever restate what the test itself decided, so this one is the
 *     acceptance question ("a real reschedule resolves a real conflict") asked of
 *     the product rather than of the harness.
 *
 * No case waits on a timer, and none treats "the spinner went away" as
 * settlement: every wait is on data, on a toast, or on a named control.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AppProvider } from "@/context/AppContext";
import type { ClassRepository } from "@/domains/classes/repository";
import type { AcademyClass, ClassListParams } from "@/domains/classes/types";
import {
  getAttendanceRepository,
  getEnrollmentRepository,
  getSchedulingRepository,
  resetRegistry,
  setClassRepository,
  setRoomRepository,
  setSchedulingRepository,
  setTeacherRepository,
} from "@/domains/registry";
import type { RoomRepository } from "@/domains/rooms/repository";
import type { Room, RoomListParams } from "@/domains/rooms/types";
import { addDays, isoToJalaliDisplay, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { deterministicSessionId } from "@/domains/scheduling/generation";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import {
  SESSION_ERRORS,
  type ConflictItem,
  type ConflictReport,
  type RescheduleInput,
  type Session,
  type SessionCandidate,
  type SessionListParams,
} from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import type { TeacherRepository } from "@/domains/teachers/repository";
import type { Teacher, TeacherListParams } from "@/domains/teachers/types";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { SchedulingView } from "@/views/Scheduling";

/* ------------------------------------------------------------------ */
/* Probe data — identities that exist nowhere else                     */
/* ------------------------------------------------------------------ */

const STAMP = "2026-01-01T08:00:00Z";

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
    origin: "generated",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

const THEORY_CLASS = academyClass({ id: "cls_probe_theory", title: "کلاس تئوری آزمایشی" });
const DRUMS_CLASS = academyClass({ id: "cls_probe_drums", title: "کلاس درامز آزمایشی", instrument: "drums" });
const ROOM_A = room({ id: "room_probe", name: "اتاق آزمایشی" });
const ROOM_B = room({ id: "room_probe_b", name: "اتاق دوم آزمایشی" });
const PROBE_TEACHER = teacher({ id: "tea_probe", name: "مدرس آزمایشی" });
const OTHER_TEACHER = teacher({ id: "tea_probe_b", name: "مدرس دوم آزمایشی", instrument: "drums" });

function isoOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoOf(academyNow());
const WEEK_START = addDays(TODAY, -(weekdayIndex(TODAY) ?? 0))!;
const WEEK_END = addDays(WEEK_START, 6)!;
const NEXT_WEEK_START = addDays(WEEK_START, 7)!;
/** Another day of the same week, whichever weekday the suite runs on. */
const OTHER_DAY = WEEK_START === TODAY ? WEEK_END : WEEK_START;

/** Jalali, exactly as the form's own date field renders and reads it back. */
function jalaliInput(iso: string): string {
  return isoToJalaliDisplay(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
}

const SESSION_TODAY = session({ id: "ses_probe_today", date: TODAY, startTime: "16:00", endTime: "17:00" });
const SESSION_OTHER_DAY = session({
  id: "ses_probe_other",
  date: OTHER_DAY,
  classId: DRUMS_CLASS.id,
  roomId: ROOM_B.id,
  teacherId: OTHER_TEACHER.id,
  startTime: "18:00",
  endTime: "19:00",
});

/* ------------------------------------------------------------------ */
/* The scheduling double                                               */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const CLEAN_REPORT: ConflictReport = { hard: [], warnings: [], ok: true };

function item(kind: ConflictItem["kind"], severity: ConflictItem["severity"], message: string): ConflictItem {
  return { kind, severity, message };
}

type Outcome = { kind: "auto" } | { kind: "hold" } | { kind: "fail"; cause: unknown };

/**
 * A scheduling repository the test drives by hand.
 *
 * `outcome` decides what a write does: resolve at once, stay pending until
 * `release()`, or refuse without touching the store — the last being what makes
 * "nothing was mutated optimistically" assertable rather than assumed.
 */
function schedulingStub(initial: readonly Session[] = [SESSION_TODAY, SESSION_OTHER_DAY]) {
  const state = {
    rows: [...initial],
    reads: [] as SessionListParams[],
    reschedules: [] as { id: string; input: RescheduleInput }[],
    cancels: [] as { id: string; reason: string }[],
    conflictChecks: [] as SessionCandidate[],
    outcome: { kind: "auto" } as Outcome,
    report: (_candidate: SessionCandidate): ConflictReport => CLEAN_REPORT,
  };
  const held: { pending: Deferred<Session>; value: Session }[] = [];

  const matches = (row: Session, params: SessionListParams) =>
    (params.from === undefined || row.date >= params.from) &&
    (params.to === undefined || row.date <= params.to) &&
    (params.roomId === undefined || row.roomId === params.roomId) &&
    (params.teacherId === undefined || row.teacherId === params.teacherId);

  const hold = (value: Session): Promise<Session> => {
    const pending = deferred<Session>();
    held.push({ pending, value });
    return pending.promise;
  };

  const repository = {
    list: vi.fn(async (params: SessionListParams = {}): Promise<Page<Session>> => {
      state.reads.push(params);
      const matched = state.rows.filter((row) => matches(row, params));
      return { data: matched, meta: { page: 1, per_page: params.per_page ?? 200, total: matched.length } };
    }),
    checkConflicts: vi.fn(async (candidate: SessionCandidate): Promise<ConflictReport> => {
      state.conflictChecks.push(candidate);
      return state.report(candidate);
    }),
    cancelSession: vi.fn(async (id: string, reason: string): Promise<Session> => {
      state.cancels.push({ id, reason });
      if (state.outcome.kind === "fail") throw state.outcome.cause;
      const existing = state.rows.find((row) => row.id === id);
      if (!existing) throw new Error(`no such session: ${id}`);
      const cancelled: Session = { ...existing, status: "cancelled", cancelReason: reason, updatedAt: STAMP };
      state.rows = state.rows.map((row) => (row.id === id ? cancelled : row));
      return state.outcome.kind === "hold" ? hold(cancelled) : cancelled;
    }),
    rescheduleSession: vi.fn(async (id: string, input: RescheduleInput): Promise<Session> => {
      state.reschedules.push({ id, input });
      if (state.outcome.kind === "fail") throw state.outcome.cause;
      const existing = state.rows.find((row) => row.id === id);
      if (!existing) throw new Error(`no such session: ${id}`);
      /*
        The repository's documented semantics, mirrored: the replacement is
        created first and linked back, and the original is kept as a cancelled
        record rather than edited away — a parent disputing a moved lesson needs
        the original to have existed.
      */
      const replacement: Session = {
        ...existing,
        id: `${existing.id}_moved`,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        roomId: input.roomId ?? existing.roomId,
        teacherId: input.teacherId ?? existing.teacherId,
        status: "scheduled",
        origin: "manual",
        cancelReason: undefined,
        rescheduledFromId: existing.id,
        rescheduledToId: undefined,
        createdAt: STAMP,
        updatedAt: STAMP,
      };
      const original: Session = {
        ...existing,
        status: "cancelled",
        cancelReason: input.reason,
        rescheduledToId: replacement.id,
        updatedAt: STAMP,
      };
      state.rows = [...state.rows.map((row) => (row.id === id ? original : row)), replacement];
      return state.outcome.kind === "hold" ? hold(replacement) : replacement;
    }),
  } as unknown as SchedulingRepository;

  return {
    repository,
    state,
    /** The store as the repository holds it — what a re-read will answer. */
    row: (id: string) => state.rows.find((row) => row.id === id),
    rows: () => state.rows,
    /** Lets every held write resolve with the record the store already holds. */
    release: async () => {
      const waiting = held.splice(0, held.length);
      expect(waiting.length, "a write was expected to be in flight").toBeGreaterThan(0);
      await act(async () => {
        for (const entry of waiting) entry.pending.resolve(entry.value);
      });
    },
  };
}

function classRepo(rows: readonly AcademyClass[] = [THEORY_CLASS, DRUMS_CLASS]) {
  const list = vi.fn(async (_params: ClassListParams) => ({
    data: [...rows],
    meta: { page: 1, per_page: 200, total: rows.length },
  }));
  return { repository: { list } as unknown as ClassRepository, list };
}

function roomRepo(rows: readonly Room[] = [ROOM_A, ROOM_B]) {
  const list = vi.fn(async (_params: RoomListParams) => ({
    data: [...rows],
    meta: { page: 1, per_page: 200, total: rows.length },
  }));
  return { repository: { list } as unknown as RoomRepository, list };
}

function teacherRepo(rows: readonly Teacher[] = [PROBE_TEACHER, OTHER_TEACHER]) {
  const list = vi.fn(async (_params: TeacherListParams) => ({
    data: [...rows],
    meta: { page: 1, per_page: 200, total: rows.length },
  }));
  return { repository: { list } as unknown as TeacherRepository, list };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

let scheduling: ReturnType<typeof schedulingStub>;

function install(next: ReturnType<typeof schedulingStub> = schedulingStub()) {
  scheduling = next;
  setSchedulingRepository(scheduling.repository);
  setClassRepository(classRepo().repository);
  setRoomRepository(roomRepo().repository);
  setTeacherRepository(teacherRepo().repository);
  return scheduling;
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

/** The toast region: `Toasts` marks it `aria-live="polite"`. */
function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/**
 * A success toast is recognisable in the DOM by its two resonance rings around
 * the gold check; no other tone renders them. Tone has no other markup-level
 * signal, so this is the difference between "a success toast fired" and "some
 * toast fired" — which is precisely the H2 question.
 */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

async function expectToast(contains: string) {
  await waitFor(() => expect(toastText(), `toasts so far: ${toastText()}`).toContain(contains), { timeout: 8000 });
}

function expectNoSuccess() {
  expect(successRings(), `a success toast fired for: ${toastText()}`).toBe(0);
  expect(toastText()).not.toContain("تعارض برطرف شد");
}

/** Opens the session drawer by clicking the grid block carrying this class title. */
async function openDrawer(title: string) {
  const label = await screen.findByText(title);
  const block = label.closest("button");
  expect(block, `no session block for ${title}`).not.toBeNull();
  fireEvent.click(block!);
  return screen.findByRole("dialog", { name: new RegExp(title) });
}

async function openReschedule(title: string) {
  const drawer = await openDrawer(title);
  fireEvent.click(within(drawer).getByRole("button", { name: "جابه‌جایی" }));
  return screen.findByRole("dialog", { name: "جابه‌جایی جلسه" });
}

async function openCancel(title: string) {
  const drawer = await openDrawer(title);
  fireEvent.click(within(drawer).getByRole("button", { name: "لغو جلسه" }));
  return screen.findByRole("dialog", { name: "لغو جلسه" });
}

function field(dialog: HTMLElement, label: RegExp, selector = "input") {
  return within(dialog).getByLabelText(label, { selector });
}

function submitReschedule(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }));
}

/**
 * The reschedule form refuses to write while its own conflict preview is still
 * loading, so every case that expects a write waits for that preview to answer
 * first — an assertion about the dialog's own state, never a sleep.
 */
async function previewAnswered(dialog: HTMLElement) {
  await within(dialog).findByText(CLEAN_PREVIEW);
}

/**
 * Waits until the dialog offers its submit again: the preview has answered and
 * nothing in the report is blocking the write. Used wherever the case has just
 * consented to a warning, because a clean-report line will never appear there.
 */
async function submitReady(dialog: HTMLElement) {
  await waitFor(() =>
    expect(
      (within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
}

/** The line the dialog prints once the domain's preview has found nothing. */
const CLEAN_PREVIEW = /تعارضی برای این بازه گزارش نشد/;

function submitCancel(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getAllByRole("button", { name: "لغو جلسه" }).at(-1)!);
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

describe("reschedule", () => {
  it("writes through the repository, and claims nothing until it resolves", async () => {
    renderView();
    const dialog = await openReschedule(THEORY_CLASS.title);

    // The form starts from the session's own values, read from the domain.
    expect((field(dialog, /^روز/) as HTMLInputElement).value).toBe(jalaliInput(TODAY));
    expect((field(dialog, /ساعت شروع/) as HTMLInputElement).value).toBe("16:00");
    expect((field(dialog, /ساعت پایان/) as HTMLInputElement).value).toBe("17:00");

    fireEvent.change(field(dialog, /^روز/), { target: { value: jalaliInput(OTHER_DAY) } });
    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: "11:00" } });
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: "12:30" } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "درخواست هنرجو" } });

    // The candidate the domain was asked about is the form's, and it excludes the
    // session being moved so it cannot conflict with itself.
    await waitFor(() => expect(scheduling.state.conflictChecks.length).toBeGreaterThan(0));
    expect(scheduling.state.conflictChecks.at(-1)).toMatchObject({
      id: SESSION_TODAY.id,
      classId: THEORY_CLASS.id,
      date: OTHER_DAY,
      startTime: "11:00",
      endTime: "12:30",
      roomId: ROOM_A.id,
      teacherId: PROBE_TEACHER.id,
    });

    await previewAnswered(dialog);
    submitReschedule(dialog);

    // The verb, the target and the payload — including that no warning was
    // acknowledged on the user's behalf.
    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    expect(scheduling.state.reschedules[0]).toEqual({
      id: SESSION_TODAY.id,
      input: {
        date: OTHER_DAY,
        startTime: "11:00",
        endTime: "12:30",
        roomId: ROOM_A.id,
        teacherId: PROBE_TEACHER.id,
        reason: "درخواست هنرجو",
        acknowledgeWarnings: false,
      },
    });

    await expectToast("جلسه جابه‌جا شد");
    expect(successRings(), "a real, awaited write may report success").toBeGreaterThan(0);
    // The copy names the operation and its result — and nothing else.
    expect(toastText()).toContain("۱۱:۰۰");
    for (const claim of ["تعارض برطرف شد", "مدرس مطلع شد", "هنرجو مطلع شد", "پیامک", "در سرور ثبت شد"]) {
      expect(toastText(), claim).not.toContain(claim);
    }

    // Success closes the form, and the calendar re-read: the moved session is on
    // screen at its new time, and the original stays as a cancelled record.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "جابه‌جایی جلسه" })).toBeNull());
    expect(await screen.findByTitle(/۱۱:۰۰–۱۲:۳۰/)).toBeTruthy();
    expect(scheduling.state.reads.length).toBeGreaterThan(1);
  });

  it("holds every claim while the write is in flight, and will not close mid-write", async () => {
    install(schedulingStub([SESSION_TODAY]));
    scheduling.state.outcome = { kind: "hold" };
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /^روز/), { target: { value: jalaliInput(OTHER_DAY) } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "تغییر برنامه" } });
    await previewAnswered(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    // Pending: no success, no failure, and the form is still there and busy.
    expect(toastText()).toBe("");
    expectNoSuccess();
    expect(within(dialog).getByRole("button", { name: "در حال جابه‌جایی…" })).toBeTruthy();
    expect(
      (within(dialog).getByRole("button", { name: "در حال جابه‌جایی…" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Dismissing the form while a write is in flight is refused: closing it would
    // leave the user with no way to see how the write ended.
    fireEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));
    expect(screen.getByRole("dialog", { name: "جابه‌جایی جلسه" })).toBeTruthy();

    await scheduling.release();
    await expectToast("جلسه جابه‌جا شد");
    expect(successRings()).toBeGreaterThan(0);
  });

  it("reports a refusal in the repository's own words and changes nothing", async () => {
    install(schedulingStub([SESSION_TODAY]));
    const refusal = new ApiError({
      kind: "conflict",
      code: SESSION_ERRORS.CONFLICT,
      message: "اتاق در این بازه اشغال است و جلسه جابه‌جا نشد.",
    });
    scheduling.state.outcome = { kind: "fail", cause: refusal };
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: "11:00" } });
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: "12:00" } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "تغییر برنامه" } });
    await previewAnswered(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    await expectToast(refusal.message);
    expect(toastText()).toContain("جابه‌جایی انجام نشد");
    expectNoSuccess();

    // The form stays open with the same message, so the reason survives the toast.
    expect(screen.getByRole("dialog", { name: "جابه‌جایی جلسه" })).toBeTruthy();
    expect(within(dialog).getByText(refusal.message)).toBeTruthy();

    // Nothing was mutated optimistically: the store, the read and the screen all
    // still hold the session where it was.
    expect(scheduling.row(SESSION_TODAY.id)).toMatchObject({ date: TODAY, startTime: "16:00", status: "scheduled" });
    expect(scheduling.state.reads).toHaveLength(1);
    expect(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/)).toBeTruthy();
  });

  it("does not submit while the domain reports a hard conflict", async () => {
    install(schedulingStub([SESSION_TODAY]));
    const message = "اتاق «اتاق آزمایشی» در این ساعت جلسهٔ دیگری دارد.";
    scheduling.state.report = () => ({
      hard: [item("SESSION_ROOM_CONFLICT", "hard", message)],
      warnings: [],
      ok: false,
    });
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    // The report's own sentence, not a paraphrase of it.
    expect(await within(dialog).findByText(message)).toBeTruthy();

    const submit = within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }) as HTMLButtonElement;
    expect(submit.disabled, "a hard conflict blocks the write").toBe(true);
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "تغییر برنامه" } });
    fireEvent.click(submit);

    expect(scheduling.state.reschedules).toHaveLength(0);
    expect(toastText()).toBe("");
  });

  it("requires an explicit acknowledgement for warnings, and withdraws it on any edit", async () => {
    install(schedulingStub([SESSION_TODAY]));
    const warning = "این جلسه خارج از تکرار هفتگی کلاس است.";
    scheduling.state.report = () => ({
      hard: [],
      warnings: [item("SESSION_OFF_SCHEDULE", "warning", warning)],
      ok: true,
    });
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    expect(await within(dialog).findByText(warning)).toBeTruthy();
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "تغییر برنامه" } });

    const submit = within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }) as HTMLButtonElement;
    expect(submit.disabled, "a warning needs consent first").toBe(true);
    fireEvent.click(submit);
    expect(scheduling.state.reschedules, "no write without acknowledgement").toHaveLength(0);

    // Consent is the user's own act.
    const acknowledge = within(dialog).getByRole("switch", { name: "پذیرش هشدارهای تعارض" });
    expect(acknowledge.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(acknowledge);
    await waitFor(() =>
      expect(
        (within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );

    // Editing the candidate withdraws it: consent was for that report, not for
    // whatever the form says next.
    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: "13:00" } });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("switch", { name: "پذیرش هشدارهای تعارض" }).getAttribute("aria-checked"),
        "an edit withdrew the acknowledgement",
      ).toBe("false"),
    );
    expect(scheduling.state.reschedules).toHaveLength(0);

    // Consent has to be given again to the report the next edit produces, and a
    // re-check withdraws the warning list while it runs — so wait for it back.
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: "14:00" } });
    await within(dialog).findByRole("switch", { name: "پذیرش هشدارهای تعارض" });
    fireEvent.click(within(dialog).getByRole("switch", { name: "پذیرش هشدارهای تعارض" }));
    await submitReady(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    expect(scheduling.state.reschedules[0].input).toMatchObject({
      startTime: "13:00",
      endTime: "14:00",
      acknowledgeWarnings: true,
    });
  });

  it("does not write without a reason, and keeps the repository's reason error on the field", async () => {
    install(schedulingStub([SESSION_TODAY]));
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /^روز/), { target: { value: jalaliInput(OTHER_DAY) } });
    await previewAnswered(dialog);
    submitReschedule(dialog);

    // Blank reason: refused locally, so the repository is never asked.
    expect(await within(dialog).findByText("دلیل جابه‌جایی الزامی است.")).toBeTruthy();
    expect(scheduling.state.reschedules).toHaveLength(0);
    expect(toastText()).toBe("");

    // And when the repository is the one refusing, its own field message is what
    // the user reads — mapped onto the field, not flattened into a generic line.
    const fieldMessage = "دلیل جابه‌جایی را وارد کنید.";
    scheduling.state.outcome = {
      kind: "fail",
      cause: new ApiError({
        kind: "validation",
        code: SESSION_ERRORS.CANCEL_REASON_REQUIRED,
        message: "دلیل جابه‌جایی الزامی است.",
        fields: { reason: [fieldMessage] },
      }),
    };
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "دللی که انبار نپذیرفت" } });
    await previewAnswered(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    expect(await within(dialog).findByText(fieldMessage)).toBeTruthy();
    expect((field(dialog, /دلیل جابه‌جایی/) as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expectNoSuccess();
  });

  it("moves the room and teacher from the reads, not from a fixture list", async () => {
    install(schedulingStub([SESSION_TODAY]));
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    const roomSelect = field(dialog, /^اتاق/, "select") as HTMLSelectElement;
    const teacherSelect = field(dialog, /^مدرس/, "select") as HTMLSelectElement;
    // The options are the rooms and teachers the view actually read.
    expect([...roomSelect.options].map((option) => option.textContent)).toEqual([ROOM_A.name, ROOM_B.name]);
    expect([...teacherSelect.options].map((option) => option.textContent)).toEqual([
      PROBE_TEACHER.name,
      OTHER_TEACHER.name,
    ]);

    fireEvent.change(roomSelect, { target: { value: ROOM_B.id } });
    fireEvent.change(teacherSelect, { target: { value: OTHER_TEACHER.id } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "تغییر اتاق و مدرس" } });
    await previewAnswered(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    expect(scheduling.state.reschedules[0].input).toMatchObject({
      roomId: ROOM_B.id,
      teacherId: OTHER_TEACHER.id,
      // The class is not part of a reschedule: the offering does not change.
      date: TODAY,
      startTime: "16:00",
      endTime: "17:00",
    });
    expect(scheduling.state.reschedules[0].input).not.toHaveProperty("classId");
    // The check was re-run against the new room and teacher, not the old ones.
    expect(scheduling.state.conflictChecks.at(-1)).toMatchObject({ roomId: ROOM_B.id, teacherId: OTHER_TEACHER.id });
  });

  it("leaves the repository's links visible after the move, and follows the new session", async () => {
    install(schedulingStub([SESSION_TODAY]));
    renderView();

    const dialog = await openReschedule(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /^روز/), { target: { value: jalaliInput(OTHER_DAY) } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "درخواست هنرجو" } });
    await previewAnswered(dialog);
    submitReschedule(dialog);
    await expectToast("جلسه جابه‌جا شد");

    // What the repository now holds: the original cancelled and linked forward,
    // the replacement linked back. The view did not build either link.
    await waitFor(() => expect(scheduling.row(`${SESSION_TODAY.id}_moved`)).toBeDefined());
    expect(scheduling.row(SESSION_TODAY.id)).toMatchObject({
      status: "cancelled",
      cancelReason: "درخواست هنرجو",
      rescheduledToId: `${SESSION_TODAY.id}_moved`,
      date: TODAY,
    });
    expect(scheduling.row(`${SESSION_TODAY.id}_moved`)).toMatchObject({
      status: "scheduled",
      rescheduledFromId: SESSION_TODAY.id,
      date: OTHER_DAY,
    });

    // And what the user sees is a re-read of that, not a local edit: the drawer
    // now follows the replacement, and says where it came from.
    const drawer = await screen.findByRole("dialog", { name: new RegExp(THEORY_CLASS.title) });
    await waitFor(() => expect(within(drawer).getByText("این جلسه جایگزین یک جلسهٔ لغوشده است.")).toBeTruthy());
    expect(drawer.textContent).toContain(isoToJalaliDisplay(OTHER_DAY, { day: "numeric", month: "long" }));
  });
});

describe("cancel", () => {
  it("claims the cancellation only after the repository resolves", async () => {
    install(schedulingStub([SESSION_TODAY]));
    scheduling.state.outcome = { kind: "hold" };
    renderView();

    const dialog = await openCancel(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /دلیل لغو/), { target: { value: "تعطیلی رسمی" } });
    submitCancel(dialog);

    await waitFor(() => expect(scheduling.state.cancels).toEqual([{ id: SESSION_TODAY.id, reason: "تعطیلی رسمی" }]));
    // In flight: nothing is claimed, and the control says it is working.
    expect(toastText()).toBe("");
    expectNoSuccess();
    expect(within(dialog).getByRole("button", { name: "در حال لغو…" })).toBeTruthy();

    await scheduling.release();
    await expectToast("جلسه لغو شد");
    expect(successRings()).toBeGreaterThan(0);
    // The reason in the confirmation is the one the returned record carries.
    expect(toastText()).toContain("تعطیلی رسمی");
    for (const claim of ["مدرس مطلع شد", "هنرجو مطلع شد", "پیامک", "حذف شد"]) {
      expect(toastText(), claim).not.toContain(claim);
    }
  });

  it("surfaces an already-cancelled refusal verbatim and keeps the session as it was", async () => {
    install(schedulingStub([SESSION_TODAY]));
    const refusal = new ApiError({
      kind: "conflict",
      code: SESSION_ERRORS.ALREADY_CANCELLED,
      message: "این جلسه پیش‌تر لغو شده است.",
    });
    scheduling.state.outcome = { kind: "fail", cause: refusal };
    renderView();

    const dialog = await openCancel(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /دلیل لغو/), { target: { value: "تعطیلی رسمی" } });
    submitCancel(dialog);

    await waitFor(() => expect(scheduling.state.cancels).toHaveLength(1));
    await expectToast(refusal.message);
    expect(toastText()).toContain("لغو انجام نشد");
    expectNoSuccess();
    // Still open, still showing the repository's sentence.
    expect(screen.getByRole("dialog", { name: "لغو جلسه" })).toBeTruthy();
    expect(within(dialog).getByText(refusal.message)).toBeTruthy();
    expect(scheduling.row(SESSION_TODAY.id)).toMatchObject({ status: "scheduled" });
    expect(scheduling.row(SESSION_TODAY.id)?.cancelReason).toBeUndefined();
  });

  it("does not write without a reason", async () => {
    install(schedulingStub([SESSION_TODAY]));
    renderView();

    const dialog = await openCancel(THEORY_CLASS.title);
    submitCancel(dialog);
    expect(await within(dialog).findByText("دلیل لغو الزامی است.")).toBeTruthy();
    expect(scheduling.state.cancels).toHaveLength(0);
    expect(toastText()).toBe("");
  });

  it("shows the cancelled session from a re-read, and withdraws the write controls", async () => {
    install(schedulingStub([SESSION_TODAY]));
    renderView();

    const dialog = await openCancel(THEORY_CLASS.title);
    fireEvent.change(field(dialog, /دلیل لغو/), { target: { value: "بیماری مدرس" } });
    submitCancel(dialog);
    await expectToast("جلسه لغو شد");

    // The read happened again, and what it now answers is a cancelled session.
    await waitFor(() => expect(scheduling.state.reads.length).toBeGreaterThan(1));
    expect(scheduling.row(SESSION_TODAY.id)).toMatchObject({ status: "cancelled", cancelReason: "بیماری مدرس" });

    // On screen: still visible (a cancelled lesson is a fact, not a deletion),
    // labelled from its own status, with the reason and no way to cancel twice.
    const drawer = await screen.findByRole("dialog", { name: new RegExp(THEORY_CLASS.title) });
    await waitFor(() => expect(within(drawer).getByText("لغو شده")).toBeTruthy());
    expect(within(drawer).getByText("بیماری مدرس")).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: "لغو جلسه" })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: "جابه‌جایی" })).toBeNull();
    expect(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/), "the session stays on the calendar").toBeTruthy();
  });
});

describe("the write target", () => {
  it("cannot target a session that left the window, and never inherits another's form", async () => {
    install(schedulingStub([SESSION_TODAY, SESSION_OTHER_DAY]));
    renderView();

    // Select today's session and open its form…
    const dialog = await openReschedule(THEORY_CLASS.title);
    expect((field(dialog, /^روز/) as HTMLInputElement).value).toBe(jalaliInput(TODAY));
    // …then the window changes and today's session is no longer in it. The drawer
    // and both forms go with it: there is no target, so there is nothing to write.
    fireEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "جابه‌جایی جلسه" })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await waitFor(() =>
      expect(scheduling.state.reads.at(-1)).toMatchObject({ from: NEXT_WEEK_START, to: addDays(NEXT_WEEK_START, 6) }),
    );
    await waitFor(() => expect(screen.queryByText(THEORY_CLASS.title)).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(scheduling.state.reschedules).toHaveLength(0);
    expect(scheduling.state.cancels).toHaveLength(0);

    // Back to a window that holds both, and the second session's form is built
    // from the second session — not from whatever was typed for the first (H6).
    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ قبل" }));
    const second = await openReschedule(DRUMS_CLASS.title);
    expect((field(second, /^روز/) as HTMLInputElement).value).toBe(jalaliInput(OTHER_DAY));
    expect((field(second, /ساعت شروع/) as HTMLInputElement).value).toBe("18:00");
    expect((field(second, /دلیل جابه‌جایی/) as HTMLInputElement).value, "no inherited reason").toBe("");

    fireEvent.change(field(second, /دلیل جابه‌جایی/), { target: { value: "جابه‌جایی جلسهٔ دوم" } });
    submitReschedule(second);
    await waitFor(() => expect(scheduling.state.reschedules).toHaveLength(1));
    expect(scheduling.state.reschedules[0]).toMatchObject({ id: SESSION_OTHER_DAY.id });
    expect(scheduling.state.reschedules[0].input).toMatchObject({ date: OTHER_DAY, startTime: "18:00" });
  });

  it("offers reschedule and cancel, and no delete", async () => {
    renderView();
    const drawer = await openDrawer(THEORY_CLASS.title);

    expect(within(drawer).getByRole("button", { name: "جابه‌جایی" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "لغو جلسه" })).toBeTruthy();
    /*
      E-2 still holds in CP3. The repository has a `delete`, and generation now
      reports orphaned sessions, but nothing in this drawer removes a row:
      cancellation remains the only destructive operation on offer. Generation
      itself moved from "not exposed" (CP2) to its own surface in CP3 — what it
      does there is asserted in `schedulingGeneration.test.tsx` — and the drawer
      gained no control for it.
    */
    expect(within(drawer).queryByRole("button", { name: /حذف/ })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: /تولید/ })).toBeNull();
    // And nothing on the screen claims a generation nobody asked for.
    expect(document.body.textContent).not.toContain("تولید شد");
    expect(document.body.textContent).not.toContain("زمان‌بندی خودکار");
  });
});

/* ------------------------------------------------------------------ */
/* The domain's own protection, through the real repositories           */
/* ------------------------------------------------------------------ */

describe("attendance protection", () => {
  it("surfaces the repository's refusal for a session that has attendance", async () => {
    // Real demo repositories end to end: the enrollment, the session, the
    // attendance mark and the refusal are the domains' own, so what is under test
    // is only whether the view carries the refusal to the user intact (E-4).
    resetToDemoEnvironment();
    resetRegistry();

    const realScheduling = getSchedulingRepository();
    const attendance = getAttendanceRepository();
    const enrollments = getEnrollmentRepository();

    // A seat in a real class from a date early enough to cover the session below:
    // the seeded enrollments all start later than this week.
    await enrollments.enroll({ studentId: "st2", classId: "cl1", startDate: "۱۴۰۳/۰۱/۰۱" });

    const created = await realScheduling.create({
      classId: "cl1",
      date: TODAY,
      startTime: "09:00",
      endTime: "10:00",
      teacherId: "t1",
      roomId: "r1",
      // Off the class's weekly recurrence, which the domain reports as a warning.
      acknowledgeWarnings: true,
    });
    const roster = await realScheduling.sessionRoster(created.id);
    expect(roster.length, "the session needs a roster to take attendance").toBeGreaterThan(0);
    await attendance.record({
      sessionId: created.id,
      studentId: roster[0].studentId,
      status: "present",
      recordedByUserId: "usr_admin",
    });

    renderView();
    const block = await screen.findByTitle(/۰۹:۰۰–۱۰:۰۰/);
    fireEvent.click(block);
    const drawer = await screen.findByRole("dialog", { name: /پیانو گروهی/ });
    fireEvent.click(within(drawer).getByRole("button", { name: "جابه‌جایی" }));
    const dialog = await screen.findByRole("dialog", { name: "جابه‌جایی جلسه" });

    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: "11:00" } });
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: "12:00" } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "درخواست هنرجو" } });
    // The real engine warns about leaving the class's recurrence; wait for that
    // report, then consent to it so the write reaches the protection under test.
    await within(dialog).findByRole("button", { name: "جابه‌جایی جلسه" });
    const acknowledge = within(dialog).queryByRole("switch", { name: "پذیرش هشدارهای تعارض" });
    if (acknowledge) fireEvent.click(acknowledge);
    await submitReady(dialog);
    submitReschedule(dialog);

    // The repository's own sentence, verbatim, in a danger toast — and no success.
    await expectToast("برای این جلسه حضور و غیاب ثبت شده است و جابه‌جا نمی‌شود.");
    expect(toastText()).toContain("جابه‌جایی انجام نشد");
    expectNoSuccess();
    expect(screen.getByRole("dialog", { name: "جابه‌جایی جلسه" }), "the form survives a refusal").toBeTruthy();

    // And the session really is untouched: still scheduled, still at 09:00.
    const unchanged = await realScheduling.get(created.id);
    expect(unchanged).toMatchObject({ status: "scheduled", date: TODAY, startTime: "09:00", endTime: "10:00" });
    expect(screen.getByTitle(/۰۹:۰۰–۱۰:۰۰/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* The whole chain: real conflict, real engine, real write, real state  */
/* ------------------------------------------------------------------ */

/**
 * The composition M4's acceptance asks for and no double can answer: a REAL
 * stored conflict, the REAL engine's verdict inside the REAL form, a refused
 * attempt that leaves the store byte-identical, and then a write the REAL
 * repository performed — judged afterwards on the persisted rows and on the
 * engine's own verdict over a re-read.
 *
 * Three verbs are wrapped so a case can see them (`list`, `checkConflicts`,
 * `rescheduleSession`); every wrapper runs the real implementation, so observing
 * a call is not the same as replacing one.
 *
 * WHY ONE ROW IS ARRANGED THROUGH THE STORE
 *
 * Two stored rows that clash cannot be produced through the repository: refusing
 * to write them is the invariant, and this case asserts that refusal first. So the
 * clash is planted the way it reaches a real academy — as data the product did not
 * write (an import, a legacy row, a server's own history) — through the same store
 * seam the domain's frozen tests arrange state with. The demo seed plants exactly
 * such a clash (`SEEDED_CONFLICT` in `src/domains/demo/schedulingSeed.ts`), but on
 * a fixed date the calendar's current week stops covering, so this case plants its
 * own on the academy's today instead of depending on the seed's calendar.
 *
 * Both slots sit in the early-morning band: nothing the seed schedules starts
 * before 09:30, so every row below is free of seeded clashes whichever weekday the
 * suite runs on. Waits are on rendered verdicts, on control state and on
 * repository state — never on a timer or on a spinner going away.
 */
describe("a real reschedule resolving a real conflict", () => {
  /** The day's rows as the repository holds them — the mutation baseline. */
  async function dayFingerprint(real: SchedulingRepository): Promise<string[]> {
    const page = await real.list({ from: TODAY, to: TODAY, per_page: 200 });
    return page.data
      .map((row) =>
        [row.id, row.status, row.date, row.startTime, row.endTime, row.roomId, row.teacherId, row.updatedAt].join("|"),
      )
      .sort();
  }

  it("refuses the contested slot at both gates without mutating, then resolves the clash with a write the repository performed", async () => {
    resetToDemoEnvironment();
    resetRegistry();

    const real = getSchedulingRepository();
    const list: Mock = vi.fn(real.list.bind(real));
    const checkConflicts: Mock = vi.fn(real.checkConflicts.bind(real));
    const rescheduleSession: Mock = vi.fn(real.rescheduleSession.bind(real));
    const stubs: Stubs<SchedulingRepository> = { list, checkConflicts, rescheduleSession };
    setSchedulingRepository(withStubs(real, stubs));

    /* ---- the row that holds the slot, written by the real repository ---- */

    const holder = await real.create({
      classId: "cl1",
      date: TODAY,
      startTime: "07:00",
      endTime: "08:00",
      teacherId: "t1",
      roomId: "r1",
      // Off cl1's weekly recurrence, which the domain reports as a warning.
      acknowledgeWarnings: true,
    });

    /* ---- the clash: refused by the repository, then planted as foreign data ---- */

    const intruderSlot = {
      classId: "cl2",
      date: TODAY,
      startTime: "07:30",
      endTime: "08:30",
      teacherId: "t1",
      roomId: "r1",
    };
    const refusal = await real
      .create({ ...intruderSlot, acknowledgeWarnings: true })
      .then(() => null, (cause: unknown) => cause as ApiError);
    expect(refusal?.code, "the repository will not store an overlap").toBe(SESSION_ERRORS.CONFLICT);

    const intruderId = deterministicSessionId(intruderSlot.classId, TODAY, intruderSlot.startTime);
    demoStore.scheduledSessions.create({
      id: intruderId,
      ...intruderSlot,
      status: "scheduled",
      origin: "generated",
      createdAt: STAMP,
      updatedAt: STAMP,
    });

    /* ---- the engine's own verdicts, before any UI is involved ---- */

    const contested = { id: intruderId, ...intruderSlot };
    const holderSlot = {
      id: holder.id,
      classId: holder.classId,
      date: TODAY,
      startTime: "07:00",
      endTime: "08:00",
      teacherId: "t1",
      roomId: "r1",
    };
    const FREE_SLOT = { date: TODAY, startTime: "06:00", endTime: "07:00", roomId: "r3", teacherId: "t5" };

    const intruderVerdict = await real.checkConflicts(contested);
    expect(intruderVerdict.ok, "the planted row really clashes").toBe(false);
    expect(intruderVerdict.hard.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["SESSION_ROOM_CONFLICT", "SESSION_TEACHER_CONFLICT"]),
    );
    expect(intruderVerdict.hard.every((item) => item.conflictingSessionId === holder.id)).toBe(true);

    // The same clash asked from the other side. This is the verdict the move has
    // to turn clean, and it comes from the engine rather than from this file.
    const holderVerdictBefore = await real.checkConflicts(holderSlot);
    expect(holderVerdictBefore.ok, "the holder's own slot is contested too").toBe(false);
    expect(holderVerdictBefore.hard.every((item) => item.conflictingSessionId === intruderId)).toBe(true);

    const destination = await real.checkConflicts({ id: intruderId, classId: intruderSlot.classId, ...FREE_SLOT });
    expect(destination.ok, "the destination is certified free before the move").toBe(true);

    const storeBefore = await dayFingerprint(real);

    /* ---- the real view, the real drawer, the real form ---- */

    renderView();
    fireEvent.click(await screen.findByTitle(/۰۷:۳۰–۰۸:۳۰/));
    const drawer = await screen.findByRole("dialog", { name: /پیانو انفرادی/ });
    fireEvent.click(within(drawer).getByRole("button", { name: "جابه‌جایی" }));
    const dialog = await screen.findByRole("dialog", { name: "جابه‌جایی جلسه" });

    // The form opens on the session's own values, and the engine's first answer is
    // already the planted clash: the view asked, the domain answered.
    expect((field(dialog, /ساعت شروع/) as HTMLInputElement).value).toBe("07:30");
    await within(dialog).findByText("این جابه‌جایی ممکن نیست");
    expect(checkConflicts.mock.calls.at(-1)?.[0]).toMatchObject({ id: intruderId, roomId: "r1", teacherId: "t1" });

    // Step into the holder's exact slot: the engine names the row holding it.
    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: "07:00" } });
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: "08:00" } });
    fireEvent.change(field(dialog, /دلیل جابه‌جایی/), { target: { value: "درخواست هنرجو" } });
    await within(dialog).findByText(/این اتاق در بازهٔ 07:00–08:00 اشغال است/);
    expect(within(dialog).getByText(/این مدرس در بازهٔ 07:00–08:00 جلسهٔ دیگری دارد/)).toBeTruthy();
    expect(checkConflicts.mock.calls.at(-1)?.[0]).toMatchObject({
      id: intruderId,
      date: TODAY,
      startTime: "07:00",
      endTime: "08:00",
      roomId: "r1",
      teacherId: "t1",
    });

    // GATE ONE — the form. The control says no, and clicking it goes nowhere.
    expect(
      (within(dialog).getByRole("button", { name: "جابه‌جایی جلسه" }) as HTMLButtonElement).disabled,
      "a hard conflict disables the write",
    ).toBe(true);
    submitReschedule(dialog);
    expect(rescheduleSession, "the form never reached the repository").not.toHaveBeenCalled();
    expect(await dayFingerprint(real), "the blocked attempt mutated nothing").toEqual(storeBefore);
    expectNoSuccess();

    // GATE TWO — the repository, with the form's own gate bypassed. The write is
    // attempted for real and refused for real, and still nothing moves: the
    // invariant is the repository's, not the button's.
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(rescheduleSession).toHaveBeenCalledTimes(1));
    expect(rescheduleSession.mock.calls[0]).toEqual([intruderId, expect.objectContaining({ startTime: "07:00" })]);
    await expectToast("جابه‌جایی انجام نشد");
    expect(toastText()).toContain("این اتاق در بازهٔ 07:00–08:00 اشغال است.");
    expectNoSuccess();
    expect(await dayFingerprint(real), "the refused write mutated nothing").toEqual(storeBefore);
    expect(await real.get(intruderId)).toMatchObject({
      status: "scheduled",
      startTime: "07:30",
      roomId: "r1",
      teacherId: "t1",
    });
    expect(await real.checkConflicts(holderSlot), "the clash is still there to resolve").toMatchObject({ ok: false });

    /* ---- a genuinely free slot, through the same real form ---- */

    fireEvent.change(field(dialog, /ساعت شروع/), { target: { value: FREE_SLOT.startTime } });
    fireEvent.change(field(dialog, /ساعت پایان/), { target: { value: FREE_SLOT.endTime } });
    fireEvent.change(field(dialog, /^اتاق/, "select"), { target: { value: FREE_SLOT.roomId } });
    fireEvent.change(field(dialog, /^مدرس/, "select"), { target: { value: FREE_SLOT.teacherId } });
    // Wait for the engine's answer to the new slot to be ON SCREEN, in whichever
    // of its two shapes it comes: nothing to report, or a warning to consent to.
    await waitFor(() =>
      expect(
        within(dialog).queryByText(CLEAN_PREVIEW) !== null ||
          within(dialog).queryByRole("switch", { name: "پذیرش هشدارهای تعارض" }) !== null,
        "the engine answered for the free slot",
      ).toBe(true),
    );
    // Leaving the class's recurrence warns, and the form withdraws a consent on
    // any edit — so the acknowledgement is the operator's, given last.
    const acknowledge = within(dialog).queryByRole("switch", { name: "پذیرش هشدارهای تعارض" });
    if (acknowledge) fireEvent.click(acknowledge);
    await submitReady(dialog);
    submitReschedule(dialog);

    await waitFor(() => expect(rescheduleSession).toHaveBeenCalledTimes(2));
    expect(rescheduleSession.mock.calls[1]).toEqual([
      intruderId,
      {
        date: FREE_SLOT.date,
        startTime: FREE_SLOT.startTime,
        endTime: FREE_SLOT.endTime,
        roomId: FREE_SLOT.roomId,
        teacherId: FREE_SLOT.teacherId,
        reason: "درخواست هنرجو",
        acknowledgeWarnings: acknowledge !== null,
      },
    ]);
    await expectToast("جلسه جابه‌جا شد");
    expect(successRings(), "an awaited, real write may report success").toBeGreaterThan(0);

    /* ---- what the repository holds now, read back from the repository ---- */

    const replacement = (await rescheduleSession.mock.results[1].value) as Session;
    expect(replacement.id, "a reschedule creates a new session").not.toBe(intruderId);
    expect(replacement).toMatchObject({
      classId: intruderSlot.classId,
      status: "scheduled",
      ...FREE_SLOT,
      rescheduledFromId: intruderId,
    });

    const original = await real.get(intruderId);
    expect(original).toMatchObject({
      status: "cancelled",
      cancelReason: "درخواست هنرجو",
      rescheduledToId: replacement.id,
      date: TODAY,
    });
    expect(await real.get(holder.id), "the row that held the slot was never touched").toMatchObject({
      status: "scheduled",
      startTime: "07:00",
      endTime: "08:00",
      roomId: "r1",
      teacherId: "t1",
    });
    const scheduledForClass = (await real.list({ from: TODAY, to: TODAY, per_page: 200 })).data.filter(
      (row) => row.classId === intruderSlot.classId && row.status === "scheduled",
    );
    expect(scheduledForClass.map((row) => row.id), "one move, not a duplicate").toEqual([replacement.id]);

    /* ---- the conflict is gone: the same real query, asked again ---- */

    const holderVerdictAfter = await real.checkConflicts(holderSlot);
    expect(holderVerdictAfter.hard, "the cancelled row no longer contests the slot").toEqual([]);
    expect(holderVerdictAfter.ok, "the clash the move was for is resolved").toBe(true);
    const landed = await real.checkConflicts({ id: replacement.id, classId: intruderSlot.classId, ...FREE_SLOT });
    expect(landed.ok, "where the session landed is certified free").toBe(true);

    // And the screen is a re-read of that, not a local edit.
    expect(list.mock.calls.length, "the calendar re-read after the write").toBeGreaterThan(1);
    expect(await screen.findByTitle(/۰۶:۰۰–۰۷:۰۰/)).toBeTruthy();
    const movedDrawer = await screen.findByRole("dialog", { name: /پیانو انفرادی/ });
    expect(within(movedDrawer).getByText("این جلسه جایگزین یک جلسهٔ لغوشده است.")).toBeTruthy();
  });
});
