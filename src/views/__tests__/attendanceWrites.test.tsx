// @vitest-environment jsdom
/**
 * Attendance writes — record, bulkRecord and correct (M5).
 *
 * WHAT THESE CASES PROVE
 *
 * The view's half of the write contract, which is the half no domain test can see:
 * that the register on screen is the one the repository derived for the session the
 * user selected, that a success is claimed only AFTER the repository's promise
 * resolved, that a refusal is reported in the repository's own words and changes
 * nothing, that provenance is the authenticated principal rather than a name the
 * view invented, that a user without the permission has no write control at all,
 * and that what appears afterwards is a re-read rather than a local edit.
 *
 * TWO KINDS OF CASE, AND WHY
 *
 * The wiring cases drive a **stateful double** over the real repository, for the
 * same reason `schedulingWrites.test.tsx` does: a case that could pass by rendering
 * the demo seed is not testing the wiring, and the seeded schedule's dates are
 * fixed. The double mirrors the documented semantics so a case can hold a write
 * pending, refuse one, or answer for the wrong session.
 *
 * The acceptance cases cross into the **real demo repositories**, because seven
 * questions cannot be answered by a double: that the roster is really derived from
 * Enrollment at the session's date, that a real mark persists with real
 * provenance, that the repository really refuses a second mark for the same
 * student, that a bulk save really skips the students who already have one, that a
 * correction really appends immutable history, that a mark really makes the session
 * protected in the scheduling domain, and that a customer's own EMPTY environment
 * really renders nothing fabricated. A double could only restate what the test
 * itself decided.
 *
 * What is NOT re-proven here: atomicity, uniqueness, roster enforcement, the
 * cancelled-session refusal and the append-only trail are the domain's invariants,
 * pinned by its own frozen suites (Group D, 79 tests). Where a case below touches
 * one of them, it asserts that the VIEW carries the domain's answer to the user
 * intact and leaves the repository's truth unchanged (E-4) — never that the view
 * enforces it.
 *
 * No case waits on a timer, and none treats "the spinner went away" as settlement:
 * every wait is on data, on a toast, or on a named control.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import {
  ATTENDANCE_ERRORS,
  type AttendanceRecord,
  type AttendanceStatus,
  type BulkRecordInput,
  type CorrectionInput,
  type RecordAttendanceInput,
  type RosterAttendance,
  type SessionAttendance,
} from "@/domains/attendance/types";
import {
  getClassRepository,
  getAttendanceRepository,
  getSchedulingRepository,
  resetRegistry,
  setAttendanceRepository,
  setAuthRepository,
  setSchedulingRepository,
  setUserRepository,
} from "@/domains/registry";
import { SESSION_ERRORS, type Session } from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { faNum } from "@/lib/format";
import { AttendanceView } from "@/views/Attendance";

/* ------------------------------------------------------------------ */
/* Probe data — identities that exist nowhere else                     */
/* ------------------------------------------------------------------ */

const STAMP = "2026-01-01T08:00:00Z";
const PROBE_SESSION_ID = "ses_att_probe";
/** A real seeded class, so the title and teacher the view renders are real reads. */
const PROBE_CLASS_ID = "cl8";
const PROBE_TEACHER_ID = "t5";
const PROBE_ROOM_ID = "r3";

const STUDENT_A = { studentId: "st_probe_alef", studentName: "هنرجوی آزمایشی الف" };
const STUDENT_B = { studentId: "st_probe_be", studentName: "هنرجوی آزمایشی ب" };
const STUDENT_C = { studentId: "st_probe_se", studentName: "هنرجوی آزمایشی سین" };
const ROSTER = [STUDENT_A, STUDENT_B, STUDENT_C];

function isoOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoOf(academyNow());

function probeSession(over: Partial<Session> = {}): Session {
  return {
    id: PROBE_SESSION_ID,
    classId: PROBE_CLASS_ID,
    date: TODAY,
    startTime: "11:00",
    endTime: "12:00",
    teacherId: PROBE_TEACHER_ID,
    roomId: PROBE_ROOM_ID,
    status: "scheduled",
    origin: "manual",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

function probeRecord(
  studentId: string,
  status: AttendanceStatus = "present",
  by = "usr_admin",
  sessionId = PROBE_SESSION_ID,
): AttendanceRecord {
  return {
    id: `att_${sessionId}_${studentId}`,
    sessionId,
    studentId,
    status,
    recordedAt: STAMP,
    recordedByUserId: by,
    updatedAt: STAMP,
  };
}

/** A register built the way the domain builds one: no record means unmarked. */
function registerView(
  sessionId: string,
  roster: readonly { studentId: string; studentName: string }[],
  records: readonly AttendanceRecord[],
  over: Partial<SessionAttendance> = {},
): SessionAttendance {
  const rows: RosterAttendance[] = roster.map((student) => {
    const record = records.find((row) => row.studentId === student.studentId && row.sessionId === sessionId);
    return record ? { student, record } : { student };
  });
  return {
    sessionId,
    roster: rows,
    recorded: rows.filter((row) => row.record !== undefined).length,
    expected: rows.length,
    locked: false,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

function renderView(hash = "#/attendance") {
  window.location.hash = hash;
  return render(
    <AuthProvider>
      <AppProvider>
        <AttendanceView />
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

/** Waits for every read to answer before anything is clicked. */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
}

/** Signs in, because a write without a principal is refused by the repository. */
async function signInAs(email = "admin@demo.local") {
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/**
 * A success toast is recognisable in the DOM by its two resonance rings around the
 * gold check; no other tone renders them. Tone has no other markup-level signal, so
 * this is the difference between "a success toast fired" and "some toast fired" —
 * which is precisely the H2 question.
 */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

function expectNoToast() {
  expect(toastText(), `unexpected toast: ${toastText()}`).toBe("");
  expect(successRings()).toBe(0);
}

function expectNoSuccess() {
  expect(successRings(), `a success toast fired for: ${toastText()}`).toBe(0);
}

async function expectToast(contains: string) {
  await waitFor(() => expect(toastText(), `toasts so far: ${toastText()}`).toContain(contains), { timeout: 8000 });
}

/** Asserts a toast fired, in a tone that is not success. */
async function expectHonestToast(contains: string) {
  await expectToast(contains);
  expectNoSuccess();
}

/** What a real attendance success may never claim (E-3, I11, and M2 before them). */
const FORBIDDEN_IN_SUCCESS = [
  "همه حاضر ثبت شدند",
  "پیام پیگیری ارسال شد",
  "مدرس مطلع شد",
  "هنرجو مطلع شد",
  "سرپرست",
  "پیامک",
  "اطلاع‌رسانی شد",
  "در سرور ثبت شد",
  "دادهٔ دمو",
] as const;

function expectSuccessThatClaimsOnlyWhatHappened() {
  expect(successRings(), "an awaited write may report success").toBeGreaterThan(0);
  for (const claim of FORBIDDEN_IN_SUCCESS) {
    expect(toastText(), `the success claims «${claim}»`).not.toContain(claim);
  }
}

/**
 * The register row for one student. A row's accessible name is built from the
 * student's own name button, and a `ListRow`-style button's name is its title plus
 * its end — so the row is found by a pattern anchored on the name the row itself
 * shows, never by an exact string this file invented. Anchored, because the row's
 * mark buttons carry the same name in their own labels («حاضر — …») and must not
 * be mistaken for the row.
 */
function rowOf(name: string): HTMLElement {
  const label = screen.getByRole("button", { name: new RegExp(`^${name}`) });
  const row = label.closest("li");
  expect(row, `no register row for ${name}`).not.toBeNull();
  return row as HTMLElement;
}

/** Clicks one of the four mark buttons on a student's row. */
function mark(row: HTMLElement, studentName: string, status: "حاضر" | "غایب" | "تأخیر" | "موجه") {
  fireEvent.click(within(row).getByRole("button", { name: `${status} — ${studentName}` }));
}

/**
 * Every mark button in scope, by the suffix their accessible names share.
 *
 * Deliberately keyed on the probe students' names: in the real-repository cases
 * the register holds real seeded students, so this helper answering zero there is
 * a statement about the probe, not about the view. Those cases count controls by
 * their own row instead.
 */
function markButtons(scope: HTMLElement) {
  return within(scope).queryAllByRole("button", { name: /— هنرجوی آزمایشی/ });
}

/**
 * The wiring double: a session list the case chooses, and an attendance repository
 * whose register answers from state the case's own writes change — so "the view
 * re-read the repository" is distinguishable from "the view edited itself".
 */
function installWorld(
  options: {
    sessions?: Session[];
    roster?: readonly { studentId: string; studentName: string }[];
    records?: AttendanceRecord[];
    locked?: boolean;
    attendanceStubs?: Stubs<AttendanceRepository>;
  } = {},
) {
  const sessions = options.sessions ?? [probeSession()];
  const roster = options.roster ?? ROSTER;

  const state = {
    records: [...(options.records ?? [])],
    sessionsRead: [] as string[],
    recordCalls: [] as RecordAttendanceInput[],
    bulkCalls: [] as BulkRecordInput[],
    correctCalls: [] as { id: string; input: CorrectionInput }[],
  };

  setSchedulingRepository(
    withStubs(getSchedulingRepository(), {
      list: async () => ({ data: sessions, meta: { page: 1, per_page: 200, total: sessions.length } }),
    }),
  );

  setAttendanceRepository(
    withStubs(getAttendanceRepository(), {
      sessionAttendance: async (sessionId: string) => {
        state.sessionsRead.push(sessionId);
        return registerView(sessionId, roster, state.records, { locked: options.locked ?? false });
      },
      record: async (input: RecordAttendanceInput) => {
        state.recordCalls.push(input);
        const row = probeRecord(input.studentId, input.status, input.recordedByUserId, input.sessionId);
        state.records = [...state.records, row];
        return row;
      },
      bulkRecord: async (input: BulkRecordInput) => {
        state.bulkCalls.push(input);
        const created = input.entries.map((entry) =>
          probeRecord(entry.studentId, entry.status, input.recordedByUserId, input.sessionId),
        );
        state.records = [...state.records, ...created];
        return created;
      },
      correct: async (id: string, input: CorrectionInput) => {
        state.correctCalls.push({ id, input });
        const existing = state.records.find((row) => row.id === id);
        if (!existing) throw new Error(`no such record: ${id}`);
        const updated = { ...existing, status: input.status, updatedAt: STAMP };
        state.records = state.records.map((row) => (row.id === id ? updated : row));
        return updated;
      },
      ...options.attendanceStubs,
    }),
  );

  return state;
}

/**
 * A real session in today's window, with the roster the domain derives for it.
 *
 * Built the way `schedulingWrites.test.tsx` builds its acceptance case: a real
 * session created through the scheduling repository for a real seeded class whose
 * enrollments are already active at this date, and then the roster read back from
 * the attendance domain — so the students on screen are the ones Enrollment put
 * there, not ones this file invented.
 *
 * Only `list` is stubbed afterwards, to make the selection deterministic: the
 * seeded window holds a hundred-odd sessions and the view selects the first one it
 * read. Every other scheduling verb, and every attendance verb, stays the real
 * repository's.
 */
async function realSessionWithRoster(classId = "cl1") {
  const scheduling = getSchedulingRepository();
  const klass = (await getClassRepository().list({ per_page: 200 })).data.find((row) => row.id === classId);
  expect(klass, `the seeded class ${classId} exists`).toBeTruthy();

  const created = await scheduling.create({
    classId,
    date: TODAY,
    // Off the class's own weekly recurrence, which the domain reports as a warning
    // rather than a hard conflict.
    startTime: "09:00",
    endTime: "10:00",
    teacherId: klass!.teacherId,
    roomId: klass!.roomId,
    acknowledgeWarnings: true,
  });

  const view = await getAttendanceRepository().sessionAttendance(created.id);
  expect(view.roster.length, "the session needs a derived roster to take attendance").toBeGreaterThan(0);

  setSchedulingRepository(
    withStubs(getSchedulingRepository(), {
      list: async () => ({ data: [created], meta: { page: 1, per_page: 200, total: 1 } }),
    }),
  );
  return { session: created, roster: view.roster, classTitle: klass!.title };
}

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

/* ------------------------------------------------------------------ */
/* The register read                                                   */
/* ------------------------------------------------------------------ */
describe("the register read", () => {
  it("reads the window's sessions and the selected session's derived roster", async () => {
    await signInAs();
    const state = installWorld();

    renderView();
    await settled();

    // The register that answers is the selected session's, and it was asked for by
    // id: the view never guesses a session, and never builds a roster itself.
    expect(state.sessionsRead).toContain(PROBE_SESSION_ID);
    for (const entry of ROSTER) {
      expect(screen.getByRole("button", { name: new RegExp(`^${entry.studentName}`) })).toBeTruthy();
      expect(markButtons(rowOf(entry.studentName)).length, "an unmarked student can be marked").toBe(4);
    }
    // The counts are the derived register's own — no percentage nobody computed.
    expect(document.body.textContent).toContain(`${faNum(0)} از ${faNum(3)}`);
    expectNoToast();
  });

  it("shows an empty window as an empty window", async () => {
    await signInAs();
    installWorld({ sessions: [] });

    renderView();
    await settled();

    expect(screen.getByText("جلسه‌ای در این بازه نیست")).toBeTruthy();
    // No register, so no write control floating above one.
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expectNoToast();
  });

  it("reports a failed session read with its own message and a retry, never as an empty window", async () => {
    await signInAs();
    const failure = new ApiError({ kind: "network", message: "اتصال به انبار برقرار نشد." });
    installWorld();
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => {
          throw failure;
        },
      }),
    );

    renderView();
    await settled();

    expect(screen.getByText("جلسات این بازه خوانده نشد")).toBeTruthy();
    expect(screen.getByText(failure.message)).toBeTruthy();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
    // A failure is not dressed as an empty schedule.
    expect(screen.queryByText("جلسه‌ای در این بازه نیست")).toBeNull();
  });

  it("says when the window holds more sessions than the page it got", async () => {
    await signInAs();
    const sessions = [probeSession()];
    installWorld({ sessions });
    setSchedulingRepository(
      withStubs(getSchedulingRepository(), {
        list: async () => ({ data: sessions, meta: { page: 1, per_page: 200, total: 7 } }),
      }),
    );

    renderView();
    await settled();

    expect(document.body.textContent ?? "").toContain(
      `این بازه ${faNum(7)} جلسه دارد؛ ${faNum(1)} جلسه نمایش داده شده است. فهرست کامل نیست`,
    );
  });

  it("does not render a register that answers for another session", async () => {
    /*
      THE IDENTITY GUARD — I13, mitigated in the view only.

      `useSessionAttendance` does not retract the register it committed when the
      selected session changes, so there is a frame in which the previous
      session's roster is on screen under the new id: the frame in which marks
      could be taken against the wrong session. Under `act()` that frame is
      flushed before a test can observe it — exactly what Group D records about
      the hook — so this case does not pretend to pin the frame. It pins the
      guard's contract instead, by answering for a session that is not the one
      selected: whatever produced the mismatch, a stale commit, a late response or
      a lying adapter, the view must not render it and must not offer a write
      against it. The hook is unchanged and I13 stays OPEN.
    */
    await signInAs();
    const SESSION_A = "ses_att_alef";
    const SESSION_B = "ses_att_be";
    const asked: string[] = [];

    installWorld({
      sessions: [
        probeSession({ id: SESSION_A, startTime: "11:00", endTime: "12:00" }),
        probeSession({ id: SESSION_B, startTime: "14:00", endTime: "15:00" }),
      ],
      attendanceStubs: {
        // Always answers for A, whichever session was asked for.
        sessionAttendance: async (sessionId: string) => {
          asked.push(sessionId);
          return registerView(SESSION_A, [STUDENT_A], []);
        },
      },
    });

    renderView();
    await settled();

    // A is selected first, and its register is the one on screen.
    expect(screen.getByRole("button", { name: new RegExp(`^${STUDENT_A.studentName}`) })).toBeTruthy();

    // Selecting B asks for B, and A's student must not stay on screen with a write
    // control attached to the wrong session id.
    fireEvent.click(screen.getByRole("button", { name: /۱۴:۰۰/ }));
    await waitFor(() => expect(asked).toContain(SESSION_B));
    expect(screen.queryByRole("button", { name: `حاضر — ${STUDENT_A.studentName}` })).toBeNull();
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(screen.getByText("در حال خواندن فهرست حاضران همین جلسه…")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* What the register may and may not offer                             */
/* ------------------------------------------------------------------ */
describe("what the register may and may not offer", () => {
  it("reports a cancelled session as locked and withdraws every write control", async () => {
    await signInAs();
    installWorld({
      sessions: [probeSession({ id: "ses_att_cancelled", status: "cancelled", cancelReason: "تعطیلی رسمی" })],
      locked: true,
    });

    renderView();
    await settled();

    expect(screen.getByText("این جلسه لغو شده است")).toBeTruthy();
    expect(markButtons(document.body).length, "no mark control on a locked register").toBe(0);
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    // The recovery on offer is a real one: the schedule view writes for real.
    expect(screen.getByRole("button", { name: /رفتن به برنامه‌ریزی/ })).toBeTruthy();
    expectNoToast();
  });

  it("shows an empty roster as an empty roster, not as an unmarked one", async () => {
    await signInAs();
    installWorld({ roster: [] });

    renderView();
    await settled();

    expect(screen.getByText("در این جلسه هنرجویی انتظار نمی‌رود")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(document.body.textContent).toContain(`${faNum(0)} از ${faNum(0)}`);
  });

  it("reports a failed register read with a retry, and offers no write", async () => {
    await signInAs();
    const failure = new ApiError({
      kind: "not_found",
      code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND,
      message: "جلسه یافت نشد.",
    });
    installWorld({
      attendanceStubs: {
        sessionAttendance: async () => {
          throw failure;
        },
      },
    });

    renderView();
    await settled();

    expect(screen.getByText("فهرست حاضران خوانده نشد")).toBeTruthy();
    expect(screen.getByText(failure.message)).toBeTruthy();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expectNoSuccess();
  });

  it("offers no control that deletes, un-records or edits a mark", async () => {
    await signInAs();
    installWorld({ records: [probeRecord(STUDENT_A.studentId)] });

    renderView();
    await settled();

    const row = rowOf(STUDENT_A.studentName);
    // The marked student's only control is a correction, which requires a reason.
    expect(within(row).getByRole("button", { name: /اصلاح/ })).toBeTruthy();
    expect(markButtons(row).length, "a marked student cannot be marked again").toBe(0);

    /*
      Asserted over CONTROLS, not over prose. A sentence that says «رکوردی حذف
      نمی‌شود» is the view telling the truth about a domain that has no delete
      verb; a button named «حذف» would be a control whose operation cannot run.
      Only the second is a defect, so only the second is forbidden here.
    */
    const controls = screen
      .queryAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");
    for (const forbidden of ["حذف", "پاک کردن", "بازگرداندن", "ویرایش رکورد", "ثبت نهایی"]) {
      expect(
        controls.filter((name) => name.includes(forbidden)),
        `a control offers «${forbidden}»`,
      ).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Recording — real repositories                                       */
/* ------------------------------------------------------------------ */
describe("recording through the real repository", () => {
  it("records one mark, and shows the record the repository wrote", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    const first = roster[0];

    renderView();
    await settled();

    const row = rowOf(first.student.studentName);
    expect(within(row).getAllByText(/ثبت‌نشده/).length).toBeGreaterThan(0);
    mark(row, first.student.studentName, "حاضر");

    await expectToast("حاضر ثبت شد");
    expectSuccessThatClaimsOnlyWhatHappened();

    // The persisted truth, read back from the repository rather than from the DOM.
    const persisted = await getAttendanceRepository().list({ sessionId: session.id, per_page: 50 });
    expect(persisted.data).toHaveLength(1);
    expect(persisted.data[0].studentId).toBe(first.student.studentId);
    expect(persisted.data[0].status).toBe("present");
    // Provenance is the authenticated principal, never a name the view invented.
    expect(persisted.data[0].recordedByUserId).toBe("usr_admin");

    // And what the row shows afterwards came from the re-read.
    const after = rowOf(first.student.studentName);
    await waitFor(() => expect(within(after).queryByText(/ثبت‌نشده/)).toBeNull());
    expect(within(after).getByRole("button", { name: /اصلاح/ })).toBeTruthy();
  });

  it("surfaces the repository's own duplicate refusal verbatim, and leaves its truth unchanged", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    const first = roster[0];

    /*
      The race that removing a control cannot prevent: the register was read while
      this student was unmarked, somebody else recorded them, and now this user
      clicks. The stale register is what the view was handed, so the mark button is
      legitimately on screen; the refusal has to come from the repository, in its
      own words, and nothing may be mutated on the way.
    */
    const stale = await getAttendanceRepository().sessionAttendance(session.id);
    setAttendanceRepository(
      withStubs(getAttendanceRepository(), { sessionAttendance: async () => stale }),
    );
    await getAttendanceRepository().record({
      sessionId: session.id,
      studentId: first.student.studentId,
      status: "present",
      recordedByUserId: "usr_manager",
    });

    renderView();
    await settled();
    const row = rowOf(first.student.studentName);
    mark(row, first.student.studentName, "غایب");

    await expectHonestToast("از اصلاح استفاده کنید");
    expect(toastText()).toContain("ثبت حضور انجام نشد");

    const persisted = await getAttendanceRepository().list({ sessionId: session.id, per_page: 50 });
    expect(persisted.data, "still exactly the one record that existed").toHaveLength(1);
    expect(persisted.data[0].status, "and still the status somebody else recorded").toBe("present");
    expect(persisted.data[0].recordedByUserId).toBe("usr_manager");
  });

  it("writes every unmarked student in one bulk act, and nobody who is already marked", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    expect(roster.length, "the bulk case needs more than one student").toBeGreaterThan(1);

    // One student already has a mark, so the payload must be built without them:
    // `bulkRecord` refuses the whole request if any entry duplicates a record.
    const already = roster[0];
    await getAttendanceRepository().record({
      sessionId: session.id,
      studentId: already.student.studentId,
      status: "absent",
      recordedByUserId: "usr_admin",
    });
    const expectedNew = roster.length - 1;

    renderView();
    await settled();

    // The control states how many students it is about to submit.
    const bulk = screen.getByRole("button", { name: /همه حاضر/ });
    expect(bulk.textContent).toContain(faNum(expectedNew));
    fireEvent.click(bulk);

    await expectToast(`${faNum(expectedNew)} حضور ثبت شد`);
    expectSuccessThatClaimsOnlyWhatHappened();

    const persisted = await getAttendanceRepository().list({ sessionId: session.id, per_page: 50 });
    const statuses = new Map(persisted.data.map((row) => [row.studentId, row.status]));
    expect(persisted.data.length, "one record per student, no duplicates").toBe(roster.length);
    expect(statuses.get(already.student.studentId), "the existing mark was not overwritten").toBe("absent");
    for (const entry of roster.slice(1)) {
      expect(statuses.get(entry.student.studentId), `${entry.student.studentId} was marked present`).toBe("present");
    }
    for (const row of persisted.data) {
      expect(row.recordedByUserId).toBe("usr_admin");
    }

    // With everybody marked, the bulk control is gone rather than disabled.
    await waitFor(() => expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull());
  });

  it("leaves the repository unchanged when a bulk save is refused", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    /*
      The domain's own atomic refusal, in its own words. Atomicity is Group D's to
      prove; what is under test here is that the view carries the sentence to the
      user intact, claims no success, and leaves the repository's truth alone.
    */
    const refusal = new ApiError({
      kind: "validation",
      code: ATTENDANCE_ERRORS.INVALID,
      message: "ثبت گروهی انجام نشد؛ هیچ رکوردی ذخیره نشد.",
      fields: { [roster[0].student.studentId]: ["خارج از فهرست جلسه"] },
    });
    setAttendanceRepository(
      withStubs(getAttendanceRepository(), {
        bulkRecord: async () => {
          throw refusal;
        },
      }),
    );

    renderView();
    await settled();
    fireEvent.click(screen.getByRole("button", { name: /همه حاضر/ }));

    await expectHonestToast(refusal.message);
    expect(toastText()).toContain("ثبت گروهی انجام نشد");

    const persisted = await getAttendanceRepository().list({ sessionId: session.id, per_page: 50 });
    expect(persisted.data, "a refused bulk write wrote nothing").toHaveLength(0);
    const row = rowOf(roster[0].student.studentName);
    expect(within(row).getAllByText(/ثبت‌نشده/).length, "the register still shows the read").toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Correcting — real repositories                                      */
/* ------------------------------------------------------------------ */
describe("correcting through the real repository", () => {
  it("refuses an empty reason before any write, then corrects and appends the history", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    const first = roster[0];
    await getAttendanceRepository().record({
      sessionId: session.id,
      studentId: first.student.studentId,
      status: "absent",
      recordedByUserId: "usr_admin",
    });

    renderView();
    await settled();

    fireEvent.click(within(rowOf(first.student.studentName)).getByRole("button", { name: /اصلاح/ }));
    const dialog = await screen.findByRole("dialog", { name: /اصلاح حضور و غیاب/ });

    // A new status and no reason: refused locally, so the repository is never asked.
    fireEvent.click(within(dialog).getByRole("button", { name: "حاضر" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    expect(within(dialog).getByText("دلیل اصلاح الزامی است.")).toBeTruthy();
    expectNoToast();
    let corrections = await getAttendanceRepository().listCorrections({ sessionId: session.id, per_page: 20 });
    expect(corrections.data, "no reason, no write").toHaveLength(0);
    expect(
      (await getAttendanceRepository().list({ sessionId: session.id, per_page: 20 })).data[0].status,
      "and the mark is unchanged",
    ).toBe("absent");

    // With a reason, the write and the trail are the repository's.
    fireEvent.change(within(dialog).getByLabelText(/دلیل اصلاح/), {
      target: { value: "هنرجو حاضر بود و به اشتباه غایب ثبت شد" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));

    await expectToast("وضعیت اصلاح شد");
    expectSuccessThatClaimsOnlyWhatHappened();

    expect(
      (await getAttendanceRepository().list({ sessionId: session.id, per_page: 20 })).data[0].status,
      "the mark really changed",
    ).toBe("present");

    corrections = await getAttendanceRepository().listCorrections({ sessionId: session.id, per_page: 20 });
    expect(corrections.data, "and the trail really grew").toHaveLength(1);
    expect(corrections.data[0].previousStatus).toBe("absent");
    expect(corrections.data[0].newStatus).toBe("present");
    expect(corrections.data[0].reason).toBe("هنرجو حاضر بود و به اشتباه غایب ثبت شد");
    expect(corrections.data[0].changedByUserId, "provenance is the signed-in user").toBe("usr_admin");
  });

  it("reads the correction history back on the history tab", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    const created = await getAttendanceRepository().record({
      sessionId: session.id,
      studentId: roster[0].student.studentId,
      status: "absent",
      recordedByUserId: "usr_admin",
    });
    await getAttendanceRepository().correct(created.id, {
      status: "excused",
      reason: "گواهی پزشکی ارائه شد",
      changedByUserId: "usr_admin",
    });

    renderView();
    await settled();
    fireEvent.click(screen.getByRole("tab", { name: /تاریخچه/ }));

    await waitFor(() => expect(screen.getByText(/دلیل: گواهی پزشکی ارائه شد/)).toBeTruthy());
    // Both the correction count and the trail itself are on this tab.
    expect(screen.getAllByText(/سابقهٔ اصلاحات/).length).toBeGreaterThan(0);
    // The record itself is on the same tab, from the window read.
    expect(document.body.textContent).toContain("رکوردهای ثبت‌شده در این بازه");
    expectNoToast();
  });

  it("shows the repository's REASON_REQUIRED on the reason field", async () => {
    await signInAs();
    installWorld({ records: [probeRecord(STUDENT_A.studentId, "absent")] });
    const refusal = new ApiError({
      kind: "validation",
      code: ATTENDANCE_ERRORS.REASON_REQUIRED,
      message: "دلیل اصلاح الزامی است.",
      fields: { reason: ["دلیل اصلاح را وارد کنید."] },
    });
    setAttendanceRepository(
      withStubs(getAttendanceRepository(), {
        correct: async () => {
          throw refusal;
        },
      }),
    );

    renderView();
    await settled();
    fireEvent.click(within(rowOf(STUDENT_A.studentName)).getByRole("button", { name: /اصلاح/ }));
    const dialog = await screen.findByRole("dialog", { name: /اصلاح حضور و غیاب/ });

    /*
      The form's local presence check and the repository's rule are the same rule,
      so an empty reason never reaches the repository — which is the point of
      refusing before the write. The only way to see the repository's OWN field
      error is a repository that refuses for its own reasons, which is what a
      stricter server does; the field it names is the field that renders it.
    */
    fireEvent.change(within(dialog).getByLabelText(/دلیل اصلاح/), { target: { value: "اشتباه ثبت شد" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));

    await waitFor(() => expect(within(dialog).getByText("دلیل اصلاح را وارد کنید.")).toBeTruthy());
    expectNoSuccess();
    // The dialog survives the refusal so the user can correct it.
    expect(screen.getByRole("dialog", { name: /اصلاح حضور و غیاب/ })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Permission and provenance                                           */
/* ------------------------------------------------------------------ */
describe("permission and provenance", () => {
  it("attributes the mark to whoever is signed in", async () => {
    // A teacher holds `attendance.write` in the RBAC matrix, and is not `usr_admin`.
    await signInAs("teacher1@demo.local");
    const { session, roster } = await realSessionWithRoster();
    const first = roster[0];

    renderView();
    await settled();
    mark(rowOf(first.student.studentName), first.student.studentName, "تأخیر");

    await expectToast("تأخیر ثبت شد");
    const persisted = await getAttendanceRepository().list({ sessionId: session.id, per_page: 50 });
    expect(persisted.data[0].recordedByUserId).toBe("usr_t1");
    expect(persisted.data[0].status).toBe("late");
  });

  it("removes every write control for a user without attendance.write", async () => {
    // `desk@demo.local` is staff: `attendance.read`, but not `attendance.write`.
    await signInAs("desk@demo.local");
    const state = installWorld();

    renderView();
    await settled();

    // Read access is intact — the register this file supplied is on screen.
    expect(screen.getByRole("button", { name: new RegExp(`^${STUDENT_A.studentName}`) })).toBeTruthy();
    expect(document.body.textContent).toContain("این پنل برای شما خواندنی است");

    // The controls are REMOVED, not disabled: a disabled button still advertises a
    // capability this session does not have (M2).
    expect(markButtons(document.body)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(
      within(rowOf(STUDENT_A.studentName))
        .queryAllByRole("button")
        .filter((button) => button.hasAttribute("disabled")),
      "a write control was disabled instead of removed",
    ).toHaveLength(0);
    expect(state.recordCalls).toHaveLength(0);
    expectNoToast();
  });

  it("performs no write when nobody is signed in", async () => {
    // No `signInAs()`: there is no principal to attribute a mark to.
    const state = installWorld();

    renderView();
    await settled();

    expect(screen.getByRole("button", { name: new RegExp(`^${STUDENT_A.studentName}`) })).toBeTruthy();
    expect(markButtons(document.body)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(state.recordCalls).toHaveLength(0);
    expect(state.bulkCalls).toHaveLength(0);
    expect(state.sessionsRead.length, "the register itself is still read").toBeGreaterThan(0);
    expectNoToast();
  });
});

/* ------------------------------------------------------------------ */
/* The boundary this view must not own                                 */
/* ------------------------------------------------------------------ */
describe("the protection a mark creates", () => {
  it("makes the session undeletable in scheduling, by the domain and not by this view", async () => {
    await signInAs();
    const { session, roster } = await realSessionWithRoster();
    const first = roster[0];

    renderView();
    await settled();
    mark(rowOf(first.student.studentName), first.student.studentName, "حاضر");
    await expectToast("حاضر ثبت شد");
    expectSuccessThatClaimsOnlyWhatHappened();

    /*
      THE BOUNDARY, FROM THE SIDE THIS VIEW STANDS ON.

      Recording a mark makes the session undeletable in the SCHEDULING domain,
      which asks the attendance domain through the narrow
      `sessionIdsWithAttendance` presence seam and fails safe when the answer is
      unknown. This view never reads that seam and never decides the outcome: it
      recorded one mark, and protection followed in the domain that owns it. The
      assertion is here because the effect a user feels after pressing a button on
      THIS page lands in ANOTHER domain — and because a view that started writing
      marks somewhere the scheduling domain could not see would silently make
      attended sessions deletable again.

      Cancellation is deliberately not the verb under test: the domain allows
      cancelling a session that has attendance (its own delete refusal says
      «به‌جای حذف آن را لغو کنید»), so protection is asserted on the verb that is
      actually refused.
    */
    const scheduling = getSchedulingRepository();
    const refusal = await scheduling
      .delete(session.id)
      .then(() => null)
      .catch((cause: unknown) => cause as ApiError);
    expect(refusal, "the session is protected once a mark exists").not.toBeNull();
    expect(refusal!.code).toBe(SESSION_ERRORS.HAS_ATTENDANCE);

    // Protection refused the write, so the session is exactly as it was.
    expect((await scheduling.get(session.id)).status).toBe("scheduled");
  });
});

/* ------------------------------------------------------------------ */
/* A customer's own environment                                        */
/* ------------------------------------------------------------------ */
describe("a customer's own EMPTY environment", () => {
  beforeEach(() => {
    resetToEmptyEnvironment();
    resetRegistry();
  });

  it("renders honest empty surfaces and no fabricated figure", async () => {
    await signInAs("admin@academy.local");

    renderView();
    await settled();

    const body = document.body.textContent ?? "";
    expect(body).toContain("جلسه‌ای در این بازه نیست");

    // Every literal that used to stand in for a number nobody had computed.
    for (const fabricated of [
      "نرخ حضور امروز",
      "نبض انضباط",
      "میانگین ماه",
      "بیشترین غیبت",
      "روند حضور",
      "حضور بر حسب روز",
      "الگوی غیبت",
      "آخرین حضور",
      "حضور کلی",
      "۹۲",
    ]) {
      expect(body, `the view still renders «${fabricated}»`).not.toContain(fabricated);
    }

    fireEvent.click(screen.getByRole("tab", { name: /غایبان/ }));
    await waitFor(() => expect(screen.getByText("در این بازه غیبتی ثبت نشده است")).toBeTruthy());

    fireEvent.click(screen.getByRole("tab", { name: /تاریخچه/ }));
    await waitFor(() => expect(screen.getByText("هیچ اصلاحی ثبت نشده است")).toBeTruthy());
    expect(screen.getByText("در این بازه رکوردی ثبت نشده است")).toBeTruthy();

    expectNoToast();
  });

  it("offers no write control there is nothing to write against", async () => {
    await signInAs("admin@academy.local");

    renderView();
    await settled();

    expect(screen.queryByRole("button", { name: /همه حاضر/ })).toBeNull();
    expect(markButtons(document.body)).toHaveLength(0);
    expectNoSuccess();
  });
});
