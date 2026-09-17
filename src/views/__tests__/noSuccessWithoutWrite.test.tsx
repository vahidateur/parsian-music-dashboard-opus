// @vitest-environment jsdom
/**
 * H2 — no control may report a write that did not happen.
 *
 * Seven places in the product used to fire a `tone: "success"` toast for an
 * operation that was never performed: a room transfer, a notification to a
 * teacher and student, a bulk attendance record, a follow-up message to a
 * guardian, two SMS reminders and a "new slot suggestion filed with scheduling".
 * None of them touched a repository, and none of them could: scheduling and
 * attendance have real domains these views do not use yet, finance has no domain
 * at all, and messaging has no provider.
 *
 * What each control does now, and what is asserted here:
 *
 *   - a control whose operation does not exist is GONE, and the truthful
 *     navigation or evidence beside it survives (scheduling, absentee follow-up);
 *   - a control that only needs a service the product lacks says so in `info`,
 *     the sanctioned "requires a server" shape (the finance export — and, before
 *     M10 deferred the whole Finance surface, the two SMS reminders — plus the
 *     attendance mark-all, which is a real on-screen convenience but records
 *     nothing);
 *   - a control that can do something true does that instead (the class waitlist
 *     now opens the schedule);
 *   - M10/F4 made that same rule quieter and stronger on `#/finance`: the view
 *     is explicitly deferred (D6/I2), so it carries no reminder controls at
 *     all — there is literally nothing left on it that could claim a send.
 *
 * These cases are the behavioural half of the guarantee; the structural half —
 * no success toast literal can exist in a view that cannot write — lives in
 * `src/__tests__/writeFeedbackHonesty.test.ts`, and together they are what makes
 * "no success notification without a write" enforceable rather than aspirational.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import {
  ATTENDANCE_ERRORS,
  type AttendanceRecord,
  type AttendanceStatus,
  type BulkRecordInput,
  type RecordAttendanceInput,
  type RosterAttendance,
  type SessionAttendance,
} from "@/domains/attendance/types";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AttendanceView } from "@/views/Attendance";
import { ClassesView } from "@/views/Classes";
import { FinanceView } from "@/views/Finance";
import { SchedulingView } from "@/views/Scheduling";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import {
  getAttendanceRepository,
  getClassRepository,
  getEnrollmentRepository,
  getSchedulingRepository,
  getStudentRepository,
  resetRegistry,
  setAttendanceRepository,
  setAuthRepository,
  setSchedulingRepository,
  setUserRepository,
} from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { faNum } from "@/lib/format";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import { SESSION_ERRORS, type Session } from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";

/** Every claim the seven controls used to make. None may appear anywhere. */
const RETRACTED_CLAIMS = [
  "تعارض برطرف شد",
  "همه حاضر ثبت شدند",
  "پیام پیگیری ارسال شد",
  "یادآوری ارسال شد",
  "یادآوری گروهی ارسال شد",
  "پیشنهاد بازهٔ جدید ثبت شد",
] as const;

/**
 * Surfaces that must announce nothing on render.
 *
 * The name is the M2 one and is now narrower than it reads. `#/schedule` left the
 * fixture list in M4 and `#/attendance` in M5 — both write for real now, and both
 * stay here because the rule this loop asserts was never "renders fixtures": it is
 * that opening the surface retracts no claim, offers no control whose operation
 * does not exist, and fires no success toast for merely arriving. That is a rule
 * a wired view has to keep satisfying, arguably more than a fixture did, since it
 * now has something to be tempted by. What each view does ON A WRITE is asserted
 * in its own describe below.
 */
const FIXTURE_VIEWS = [
  { hash: "#/schedule", View: SchedulingView },
  { hash: "#/attendance", View: AttendanceView },
  { hash: "#/finance", View: FinanceView },
] as const;

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

function renderView(hash: string, View: () => React.ReactElement) {
  window.location.hash = hash;
  return render(
    <AuthProvider>
      <AppProvider>
        <View />
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

/** Waits for a data-backed view to finish loading before anything is clicked. */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
}

/** The toast region: `Toasts` marks it `aria-live="polite"` (ActionSheet.tsx). */
function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/**
 * A success toast is recognisable in the DOM by its two resonance rings around
 * the gold check (`Toasts`, ActionSheet.tsx); no other tone renders them. Tone
 * has no other markup-level signal, so this is the difference between "a success
 * toast fired" and "some toast fired" — which is precisely the H2 question.
 */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

/** Asserts a toast fired, in a tone that is not success. */
async function expectHonestToast(contains: string) {
  await waitFor(() => expect(toastText()).toContain(contains), { timeout: 8000 });
  expect(successRings(), `a success toast fired for: ${toastText()}`).toBe(0);
}

/** Asserts nothing at all was announced. */
function expectNoToast() {
  expect(toastText(), `unexpected toast: ${toastText()}`).toBe("");
  expect(successRings()).toBe(0);
}

/** The academy's own current date, `YYYY-MM-DD` — the calendar's anchor. */
function isoToday(): string {
  const now = academyNow();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Sites 1 and 2 — scheduling calendar and session drawer               */
/* ------------------------------------------------------------------ */
/*
  CP1 replaced this view's fixture week (`weekSessions` + `conflictWith`) with
  reads from the scheduling domain, so the fabricated conflict card these two
  cases used to click — «تعارض اتاق ۱ در سه‌شنبه ساعت ۱۴:۰۰», its «مشاهده در تقویم»
  button and the drawer's overlap verdict — no longer exists to be asserted
  against, and neither does the fixture they derived it from. What has to survive
  is the rule, restated against a session this file supplies: the calendar
  announces nothing, offers no control that claims a transfer, and the drawer
  opens and closes only on the user's own acts.

  A conflict verdict is the domain's (`checkConflicts`), and CP1 wires reads only,
  so nothing here asserts one either way. The session is dated on the academy's
  own current day rather than taken from the seeded schedule, whose dates are
  fixed and would quietly stop covering the current week.

  CP2 gave this view two real writes — `rescheduleSession` and `cancelSession` —
  which is exactly the situation H2 exists for: a view that CAN say «انجام شد» now
  has to earn it. The three cases at the end of this block are that earning, and
  they keep every M2 rule above intact: the retracted claims are still forbidden,
  and a real success may only describe the operation that really happened. The
  write's own mechanics — payload, conflict gating, repository links — are
  asserted in `schedulingWrites.test.tsx`; here the question is only whether the
  feedback waits for the repository.
*/
describe("scheduling", () => {
  /** One real session for today, so the calendar has something to render. */
  const probeSession = (): Session => ({
    id: "ses_probe",
    classId: "cl8",
    date: isoToday(),
    startTime: "16:00",
    endTime: "17:00",
    teacherId: "t5",
    roomId: "r3",
    status: "scheduled",
    origin: "manual",
    createdAt: "2026-01-01T08:00:00Z",
    updatedAt: "2026-01-01T08:00:00Z",
  });

  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({ data: [probeSession()], meta: { page: 1, per_page: 200, total: 1 } }),
      }),
    );
  });

  afterEach(() => setSchedulingRepository(undefined));

  it("renders a calendar that claims no conflict it did not read", async () => {
    renderView("#/schedule", SchedulingView);
    await settled();

    // The session this file supplied is on screen, so what follows is asserted
    // about a calendar that really read something.
    expect(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/)).toBeTruthy();

    // The fixture card named a Tuesday, room 1, 14:00 and a violin/piano overlap,
    // and offered to move the class to room 4. None of those facts came from a
    // read; neither the card nor the control may come back.
    expect(screen.queryByText(/روز سه‌شنبه/)).toBeNull();
    expect(screen.queryByText(/هم‌پوشانی/)).toBeNull();
    expect(screen.queryByRole("button", { name: /انتقال به اتاق ۴/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "مشاهده در تقویم" })).toBeNull();
    for (const claim of RETRACTED_CLAIMS) {
      expect(document.body.textContent, claim).not.toContain(claim);
    }
    expectNoToast();
  });

  it("opens the session and keeps the drawer open, with nothing claiming a transfer", async () => {
    renderView("#/schedule", SchedulingView);
    await settled();

    fireEvent.click(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/));
    const drawer = await screen.findByRole("dialog");
    // The session's own facts, read from the domains.
    expect(drawer.textContent).toContain("۱۶:۰۰");
    // No overlap verdict, and no control claiming to resolve one.
    expect(within(drawer).queryByText(/هم‌پوشانی/)).toBeNull();
    expect(within(drawer).queryByRole("button", { name: /انتقال به اتاق/ })).toBeNull();

    // Closing is still the user's own explicit act, not a side effect of a
    // write that was claimed but never performed.
    fireEvent.click(within(drawer).getAllByRole("button", { name: "بستن" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expectNoToast();
  });

  /**
   * The same readable probe session, plus whatever write verbs a case needs.
   * `checkConflicts` answers clean on purpose: these cases test whether the
   * feedback waits for the write, not whether the preview gates it — that gate
   * is asserted in `schedulingWrites.test.tsx`.
   */
  function installWrite(stubs: Stubs<SchedulingRepository> = {}) {
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({ data: [probeSession()], meta: { page: 1, per_page: 200, total: 1 } }),
        checkConflicts: async () => ({ hard: [], warnings: [], ok: true }),
        ...stubs,
      }),
    );
  }

  /** Opens the probe session's drawer, exactly as a user would. */
  async function openDrawer() {
    fireEvent.click(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/));
    return screen.findByRole("dialog");
  }

  /** Fills the reason and submits, then hands back the write dialog. */
  async function submitWrite(
    open: "جابه‌جایی" | "لغو جلسه",
    reason: string,
  ): Promise<HTMLElement> {
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: open }));
    const dialog = await screen.findByRole("dialog", {
      name: open === "جابه‌جایی" ? "جابه‌جایی جلسه" : "لغو جلسه",
    });
    fireEvent.change(
      within(dialog).getByLabelText(open === "جابه‌جایی" ? /دلیل جابه‌جایی/ : /دلیل لغو/),
      { target: { value: reason } },
    );
    if (open === "جابه‌جایی") {
      // The form will not write while its own preview is outstanding.
      await within(dialog).findByText(/تعارضی برای این بازه گزارش نشد/);
    }
    fireEvent.click(within(dialog).getByRole("button", { name: open === "جابه‌جایی" ? "جابه‌جایی جلسه" : "لغو جلسه" }));
    return dialog;
  }

  /** A promise the case controls, so "pending" is a state and not a race. */
  function held<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>((resolve) => {
      release = resolve;
    });
    return { promise, release: async (value: T) => act(() => { release(value); }) };
  }

  /** What a real success may still never say (E-3, and M2 before it). */
  const FORBIDDEN_IN_SUCCESS = [
    ...RETRACTED_CLAIMS,
    "مدرس مطلع شد",
    "هنرجو مطلع شد",
    "پیامک",
    "اطلاع‌رسانی شد",
    "در سرور ثبت شد",
    "حضور و غیاب",
  ];

  it("claims a reschedule only once the repository has answered", async () => {
    const write = held<Session>();
    installWrite({ rescheduleSession: () => write.promise });

    renderView("#/schedule", SchedulingView);
    await settled();
    const dialog = await submitWrite("جابه‌جایی", "درخواست هنرجو");

    // Pending: nothing is claimed, and the control says the write is in flight
    // rather than offering a second one.
    expectNoToast();
    expect(within(dialog).getByRole("button", { name: "در حال جابه‌جایی…" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "جابه‌جایی جلسه" })).toBeNull();

    await write.release({ ...probeSession(), startTime: "18:00", endTime: "19:00" });
    await waitFor(() => expect(toastText()).toContain("جلسه جابه‌جا شد"), { timeout: 8000 });
    expect(successRings(), "an awaited write may report success").toBeGreaterThan(0);
    for (const claim of FORBIDDEN_IN_SUCCESS) {
      expect(toastText(), claim).not.toContain(claim);
    }
  });

  it("reports a refused reschedule in the repository's own words, with no success", async () => {
    const refusal = new ApiError({
      kind: "conflict",
      code: SESSION_ERRORS.HAS_ATTENDANCE,
      message: "برای این جلسه حضور و غیاب ثبت شده است و جابه‌جا نمی‌شود.",
    });
    installWrite({
      rescheduleSession: async () => {
        throw refusal;
      },
    });

    renderView("#/schedule", SchedulingView);
    await settled();
    await submitWrite("جابه‌جایی", "درخواست هنرجو");

    // Verbatim, in a tone that is not success.
    await expectHonestToast(refusal.message);
    expect(toastText()).toContain("جابه‌جایی انجام نشد");

    // No optimistic move: the session on screen is still the one that was read,
    // and the form survives the refusal so the user can correct it.
    expect(screen.getByTitle(/۱۶:۰۰–۱۷:۰۰/)).toBeTruthy();
    expect(screen.queryByTitle(/۱۸:۰۰–۱۹:۰۰/)).toBeNull();
    expect(screen.getByRole("dialog", { name: "جابه‌جایی جلسه" })).toBeTruthy();
  });

  it("claims a cancellation only after the repository has cancelled", async () => {
    const write = held<Session>();
    installWrite({ cancelSession: () => write.promise });

    renderView("#/schedule", SchedulingView);
    await settled();
    const dialog = await submitWrite("لغو جلسه", "تعطیلی رسمی");

    expectNoToast();
    expect(within(dialog).getByRole("button", { name: "در حال لغو…" })).toBeTruthy();

    await write.release({ ...probeSession(), status: "cancelled", cancelReason: "تعطیلی رسمی" });
    await waitFor(() => expect(toastText()).toContain("جلسه لغو شد"), { timeout: 8000 });
    expect(successRings(), "an awaited cancellation may report success").toBeGreaterThan(0);
    for (const claim of FORBIDDEN_IN_SUCCESS) {
      expect(toastText(), claim).not.toContain(claim);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Sites 3 and 4 — attendance register and absentee follow-up           */
/* ------------------------------------------------------------------ */
/*
  M2 made these two sites honest by RETRACTING their claims: the mark-all
  convenience stayed on screen and said plainly that nothing had been recorded,
  and the absentee row's «پیگیری» button — which announced that a student and their
  guardian had been notified — was removed rather than reworded, because there is
  no messaging provider, no delivery channel and no guardian principal in the
  product.

  M5 wired this view to `src/domains/attendance`, which puts the first half in
  exactly the situation H2 exists for: a view that CAN record a mark now has to
  earn «ثبت شد». The second half must survive untouched — the follow-up control
  stays gone now that the view has a real repository to be tempted by.

  So the five cases below are the earning and the survival: a mark claimed only
  after the repository answered, a refusal carried in the repository's own words,
  a bulk save that counts the records it wrote instead of sweeping the page, an
  already-complete register that offers no bulk control and claims nothing, and
  the absentee row still navigating to a real profile with no notification
  control beside it.

  The write's own mechanics — payload shape, roster membership, atomicity, the
  append-only trail — are asserted in `src/views/__tests__/attendanceWrites.test.tsx`
  and by the domain's frozen suites; here the only question is whether the
  feedback waits for the repository and says no more than it did.
*/
describe("attendance", () => {
  const PROBE_SESSION_ID = "ses_att_probe";
  const PROBE_CLASS_ID = "cl8";
  /** Identities that exist in no fixture and no seed, so a row is unmistakably a read. */
  const STUDENT_A = { studentId: "st_probe_alef", studentName: "هنرجوی آزمایشی الف" };
  const STUDENT_B = { studentId: "st_probe_be", studentName: "هنرجوی آزمایشی ب" };
  const STUDENT_C = { studentId: "st_probe_se", studentName: "هنرجوی آزمایشی سین" };
  const ROSTER = [STUDENT_A, STUDENT_B, STUDENT_C];
  /** A real seeded student, so the absentee row's navigation lands on a real profile. */
  const SEEDED_STUDENT_ID = "st1";

  function probeSession(over: Partial<Session> = {}): Session {
    return {
      id: PROBE_SESSION_ID,
      classId: PROBE_CLASS_ID,
      date: isoToday(),
      startTime: "11:00",
      endTime: "12:00",
      teacherId: "t5",
      roomId: "r3",
      status: "scheduled",
      origin: "manual",
      createdAt: "2026-01-01T08:00:00Z",
      updatedAt: "2026-01-01T08:00:00Z",
      ...over,
    };
  }

  function probeRecord(
    studentId: string,
    status: AttendanceStatus = "present",
    sessionId = PROBE_SESSION_ID,
  ): AttendanceRecord {
    return {
      id: `att_${sessionId}_${studentId}`,
      sessionId,
      studentId,
      status,
      recordedAt: "2026-01-01T08:00:00Z",
      recordedByUserId: "usr_admin",
      updatedAt: "2026-01-01T08:00:00Z",
    };
  }

  /** A register built the way the domain builds one: no record means unmarked. */
  function registerWith(records: readonly AttendanceRecord[], roster = ROSTER): SessionAttendance {
    const rows: RosterAttendance[] = roster.map((student) => {
      const record = records.find((row) => row.studentId === student.studentId);
      return record ? { student, record } : { student };
    });
    return {
      sessionId: PROBE_SESSION_ID,
      roster: rows,
      recorded: rows.filter((row) => row.record !== undefined).length,
      expected: rows.length,
      locked: false,
    };
  }

  /** What a real attendance success may still never say (E-3, and M2 before it). */
  const FORBIDDEN_IN_SUCCESS = [
    ...RETRACTED_CLAIMS,
    "مدرس مطلع شد",
    "هنرجو مطلع شد",
    "سرپرست",
    "پیامک",
    "اطلاع‌رسانی شد",
    "در سرور ثبت شد",
    "دادهٔ دمو",
  ];

  /** A promise the case controls, so "pending" is a state and not a race. */
  function held<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>((resolve) => {
      release = resolve;
    });
    return { promise, release: async (value: T) => act(() => { release(value); }) };
  }

  /**
   * The register this file supplies, plus whatever write verbs a case needs.
   *
   * A stateful double over the real repository, for the reason the scheduling
   * block gives: a case that could pass by rendering the demo seed is not testing
   * the wiring. The demo schedule's dates are fixed, and the demo attendance store
   * starts empty, so without a double there is no register on screen to write
   * against at all.
   */
  function installRegister(
    options: { records?: AttendanceRecord[]; roster?: typeof ROSTER; attendance?: Stubs<AttendanceRepository> } = {},
  ) {
    const state = {
      recordCalls: [] as RecordAttendanceInput[],
      bulkCalls: [] as BulkRecordInput[],
    };
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({ data: [probeSession()], meta: { page: 1, per_page: 200, total: 1 } }),
      }),
    );
    setAttendanceRepository(
      withStubs(getAttendanceRepository(), {
        sessionAttendance: async () => registerWith(options.records ?? [], options.roster ?? ROSTER),
        record: async (input: RecordAttendanceInput) => {
          state.recordCalls.push(input);
          return probeRecord(input.studentId, input.status);
        },
        bulkRecord: async (input: BulkRecordInput) => {
          state.bulkCalls.push(input);
          return input.entries.map((entry) => probeRecord(entry.studentId, entry.status));
        },
        ...options.attendance,
      }),
    );
    return state;
  }

  /** Writes need a principal: `recordedByUserId` is required by the repository. */
  async function signIn() {
    const auth = new DemoAuthRepository(demoStore, memoryStorage());
    setAuthRepository(auth);
    setUserRepository(new DemoUserRepository(demoStore));
    await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  }

  /** The register row for one student, anchored so its mark buttons do not match. */
  function rowOf(name: string): HTMLElement {
    const label = screen.getByRole("button", { name: new RegExp(`^${name}`) });
    const row = label.closest("li");
    expect(row, `no register row for ${name}`).not.toBeNull();
    return row as HTMLElement;
  }

  function mark(row: HTMLElement, studentName: string, status: "حاضر" | "غایب" | "تأخیر" | "موجه") {
    fireEvent.click(within(row).getByRole("button", { name: `${status} — ${studentName}` }));
  }

  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  afterEach(() => {
    setSchedulingRepository(undefined);
    setAttendanceRepository(undefined);
    setAuthRepository(undefined);
    setUserRepository(undefined);
  });

  it("claims a mark only once the repository has answered", async () => {
    const write = held<AttendanceRecord>();
    installRegister({ attendance: { record: () => write.promise } });
    await signIn();

    renderView("#/attendance", AttendanceView);
    await settled();
    mark(rowOf(STUDENT_A.studentName), STUDENT_A.studentName, "حاضر");

    // Pending: nothing announced, and the row still shows what was read. A toast
    // here would be the claim arriving before the fact it claims.
    expectNoToast();
    expect(within(rowOf(STUDENT_A.studentName)).getAllByText(/ثبت‌نشده/).length).toBeGreaterThan(0);

    await write.release(probeRecord(STUDENT_A.studentId, "present"));
    await waitFor(() => expect(toastText()).toContain("حاضر ثبت شد"), { timeout: 8000 });
    expect(successRings(), "an awaited write may report success").toBeGreaterThan(0);
    for (const claim of FORBIDDEN_IN_SUCCESS) {
      expect(toastText(), `the success claims «${claim}»`).not.toContain(claim);
    }
  });

  it("reports a refused mark in the repository's own words, and claims no success", async () => {
    const refusal = new ApiError({
      kind: "validation",
      code: ATTENDANCE_ERRORS.DUPLICATE,
      message: "برای این هنرجو در این جلسه حضور و غیاب ثبت شده است. برای تغییر، از اصلاح استفاده کنید.",
    });
    installRegister({ attendance: { record: async () => { throw refusal; } } });
    await signIn();

    renderView("#/attendance", AttendanceView);
    await settled();
    mark(rowOf(STUDENT_A.studentName), STUDENT_A.studentName, "غایب");

    // Verbatim: the domain says which rule was hit and what to do instead, and a
    // paraphrase would trade that answer for an apology (§37).
    await expectHonestToast(refusal.message);
    expect(toastText()).toContain("ثبت حضور انجام نشد");
  });

  it("counts the records a bulk save wrote instead of sweeping the page", async () => {
    const seen: { payload: BulkRecordInput | null } = { payload: null };
    installRegister({
      attendance: {
        bulkRecord: async (input: BulkRecordInput) => {
          seen.payload = input;
          return input.entries.map((entry) => probeRecord(entry.studentId, entry.status));
        },
      },
    });
    await signIn();

    renderView("#/attendance", AttendanceView);
    await settled();
    const bulk = screen.getByRole("button", { name: /همه حاضر/ });
    fireEvent.click(bulk);

    await waitFor(() => expect(toastText()).toContain(`${faNum(ROSTER.length)} حضور ثبت شد`), { timeout: 8000 });
    expect(successRings(), "an awaited bulk write may report success").toBeGreaterThan(0);
    for (const claim of FORBIDDEN_IN_SUCCESS) {
      expect(toastText(), `the success claims «${claim}»`).not.toContain(claim);
    }
    // The retracted claim was «همه حاضر ثبت شدند» — a page-wide sweep. What is
    // said now is a count of records that exist, attributed to a real principal.
    expect(toastText()).not.toContain("همه حاضر ثبت شدند");
    expect(seen.payload?.entries).toHaveLength(ROSTER.length);
    expect(seen.payload?.recordedByUserId).toBe("usr_admin");
  });

  it("offers no bulk control and claims nothing when the register is already complete", async () => {
    const state = installRegister({ records: ROSTER.map((entry) => probeRecord(entry.studentId)) });
    await signIn();

    renderView("#/attendance", AttendanceView);
    await settled();

    // Removed, not disabled: with nobody left to submit, the control's operation
    // cannot run, and a disabled button would still advertise it (M2).
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(state.bulkCalls, "nothing was submitted").toHaveLength(0);
    // The marks that exist are still readable — this is a complete register, not
    // an empty one dressed up as complete.
    expect(within(rowOf(STUDENT_A.studentName)).getByRole("button", { name: /اصلاح/ })).toBeTruthy();
    expectNoToast();
  });

  it("drops the fake follow-up message and keeps the row's real navigation", async () => {
    const absent = probeRecord(SEEDED_STUDENT_ID, "absent");
    installRegister({
      records: [],
      attendance: {
        // The absentee tab reads the record list, bounded by the window on screen.
        list: async (params) => ({
          data: params?.status === "absent" ? [absent] : [],
          meta: { page: 1, per_page: 200, total: params?.status === "absent" ? 1 : 0 },
        }),
      },
    });
    await signIn();

    renderView("#/attendance", AttendanceView);
    await settled();
    fireEvent.click(screen.getByRole("tab", { name: /غایبان/ }));

    // The control that claimed a student and their guardian had been notified is
    // still gone, now that the view has a real repository to be tempted by.
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "پیگیری" })).toHaveLength(0));
    expect(document.body.textContent).not.toContain("پیام پیگیری ارسال شد");

    const rows = screen
      .getAllByRole("button")
      .filter((button) => (button.textContent ?? "").includes("شناسهٔ رکورد"));
    expect(rows.length, "the absentee list is populated from the read").toBeGreaterThan(0);

    // Opening the student's real profile is the truthful action this row had.
    fireEvent.click(rows[0]);
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/students\/.+/));
    expectNoToast();
  });
});

/* ------------------------------------------------------------------ */
/* Sites 5 and 6 — finance reminders                                    */
/* ------------------------------------------------------------------ */
describe("finance reminders", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  it("carries no reminder controls at all — the deferral makes a false claim impossible", async () => {
    renderView("#/finance", FinanceView);
    await settled();

    // M10/F4 deferred the finance surface (D6/I2): the invoice table and its
    // two SMS reminders are gone, individually — not relocated into another
    // fixture. Nothing named «یادآوری» may exist on the surface.
    expect(screen.queryByRole("button", { name: /یادآوری/ }), "a reminder control survived on the deferred surface").toBeNull();
    expect(screen.queryByRole("table", { name: "فهرست فاکتورها" }), "the invoice table is deferred, not rendered from a replacement fixture").toBeNull();
    // The surface names its deferral instead (the I2 work item is in the page).
    expect(document.body.textContent).toContain("I2");
    // And rendering the surface retracts no claim — ever.
    for (const claim of RETRACTED_CLAIMS) expect(toastText()).not.toContain(claim);
  });

  it("says its export needs a server instead of announcing one", async () => {
    renderView("#/finance", FinanceView);
    await settled();

    fireEvent.click(await screen.findByRole("button", { name: /خروجی/ }));
    await expectHonestToast("نیازمند سرور است");
    expect(toastText()).toContain("در دمو فعال نیست");
    for (const claim of RETRACTED_CLAIMS) expect(toastText()).not.toContain(claim);
  });
});

/* ------------------------------------------------------------------ */
/* Site 7 — class waitlist                                              */
/* ------------------------------------------------------------------ */
describe("class waitlist", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  it("opens the schedule instead of claiming a suggestion was filed with it", async () => {
    // The seeded classes carry no waitlist, so make a real one through the
    // enrollment repository — the projection is the domain's own.
    const cls = (await getClassRepository().list({ per_page: 200 })).data.find((c) => c.capacity > 0)!;
    const taken = new Set(cls.studentIds);
    const candidate = (await getStudentRepository().list({ per_page: 200 })).data.find(
      (s) => !taken.has(s.id),
    )!;
    await getEnrollmentRepository().enroll({
      studentId: candidate.id,
      classId: cls.id,
      status: "waitlist",
    });
    expect((await getClassRepository().get(cls.id)).waitlist).toBeGreaterThan(0);

    renderView(`#/classes/${cls.id}`, ClassesView);
    await settled();

    expect(await screen.findByText("لیست انتظار")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ایجاد بازهٔ جدید/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /بررسی در برنامه‌ریزی/ }));
    // The truthful effect: the schedule really opens, and nothing is announced.
    await waitFor(() => expect(window.location.hash).toBe("#/schedule"));
    expectNoToast();
    for (const claim of RETRACTED_CLAIMS) {
      expect(document.body.textContent, claim).not.toContain(claim);
    }
  });
});

/* ------------------------------------------------------------------ */
/* The customer-facing statement of the whole finding                   */
/* ------------------------------------------------------------------ */
describe("a customer's own environment", () => {
  it("offers no control that claims a write these views cannot perform", async () => {
    // EMPTY, not DEMO: these views still render fixtures, so this is the
    // environment where a false «ثبت شد» would be a lie about the customer's
    // own academy rather than about the showcase.
    resetToEmptyEnvironment();
    resetRegistry();

    for (const { hash, View } of FIXTURE_VIEWS) {
      cleanup();
      renderView(hash, View);
      await settled();
      const body = document.body.textContent ?? "";
      for (const claim of RETRACTED_CLAIMS) {
        expect(body, `${hash} still claims «${claim}»`).not.toContain(claim);
      }
      expect(screen.queryByRole("button", { name: /انتقال به اتاق ۴/ }), hash).toBeNull();
      expect(screen.queryByRole("button", { name: "پیگیری" }), hash).toBeNull();
      expect(successRings(), `${hash} fired a success toast on render`).toBe(0);
    }
  });
});
