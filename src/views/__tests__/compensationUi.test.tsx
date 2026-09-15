// @vitest-environment jsdom
/**
 * The compensation surface's write contract (M-compensation UI).
 *
 * WHAT THESE CASES PROVE
 *
 * The half of the contract no domain test can see. The domain's own suites — 121
 * tests in eight files — pin eligibility, the frozen student, the one-live-make-up
 * refusal, the terminal refusal, lifetime uniqueness, the C-1.1 lineage and the C-2
 * disclosure. What is asserted here is that the SCREEN carries those answers to the
 * user intact:
 *
 *   - a cancelled private lesson can be registered from the dialog, and the success
 *     copy claims only the record that was written;
 *   - an attendance mark on the cancelled original is ASKED ABOUT (the domain's own
 *     refusal, in its own words), and acknowledging it changes nothing except the
 *     consent the rule requires;
 *   - booking really creates an ordinary session through the scheduling domain, and
 *     the C-2 roster fact is passed on as INFORMATION, never as a gate;
 *   - a move targets the EFFECTIVE session (`currentAttempt.sessionId`), and the
 *     discharge afterwards proves it: the ledger's own `bookedSessionId` is a
 *     cancelled row by design, and a discharge aimed at it would be refused;
 *   - cancelling the effective make-up returns the obligation to `required` with no
 *     write to the ledger, and the screen offers a new booking rather than a
 *     correction;
 *   - a teacher sees NO write control — the domain would refuse, so the control is
 *     absent rather than present-and-refused;
 *   - a failed ledger read is an error, never an empty ledger (D12);
 *   - the view is reachable exactly by the roles that may already read the schedule,
 *     and not by the accountant.
 *
 * HOW THE PRECONDITIONS ARE BUILT
 *
 * Through the DOMAINS' own repositories — creating and cancelling a real private
 * session, registering a real obligation, booking a real make-up — never through a
 * fixture and never by reaching into the demo store. A precondition is a fact the
 * screen then has to read; driving it through the UI as well would make a failure
 * ambiguous between the two.
 *
 * No case waits on a timer, and none treats "the spinner went away" as settlement:
 * every wait is on data, on a toast, or on a named control.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AppProvider } from "@/context/AppContext";
import { navGroups, viewTitles } from "@/data/academy";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { canAccessView, permissionsForRole, viewPermissions } from "@/domains/auth/permissions";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import type { CompensationActor, SessionCompensation } from "@/domains/compensation/types";
import {
  getAttendanceRepository,
  getCompensationRepository,
  getEnrollmentRepository,
  getSchedulingRepository,
  resetRegistry,
  setAuthRepository,
  setCompensationRepository,
  setUserRepository,
} from "@/domains/registry";
import { addDays, isoToJalaliDisplay, jalaliToIso, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { academyNow } from "@/domains/shared/clock";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { CompensationView } from "@/views/Compensation";

/* ------------------------------------------------------------------ */
/* Identities and dates — all real, all derived                        */
/* ------------------------------------------------------------------ */

/** The seeded PRIVATE class whose derived roster is exactly one student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
const PRIVATE_STUDENT_NAME = "آیدا شریفی";
const PRIVATE_ENROLLMENT = `enr_${PRIVATE_CLASS}_${PRIVATE_STUDENT}`;
const ACTOR_ID = "usr_admin";
const TEACHER_EMAIL = "teacher1@demo.local";

const ADMIN_ACTOR: CompensationActor = {
  userId: ACTOR_ID,
  permissions: permissionsForRole("administrator"),
};

/**
 * cl2 meets on day index 3 (Tuesday) at 14:00 in room r1 with teacher t1. The
 * cases below place their sessions at 20:00 in the same room and with the same
 * teacher: a slot no seeded class occupies, so nothing here depends on the demo
 * schedule's own bookings — while the DATE stays the class's own day, so the
 * scheduling domain reports no off-schedule warning and the forms submit without
 * acknowledging one.
 */
const CLASS_DAY = 3;
const SLOT = { startTime: "20:00", endTime: "21:00" } as const;
const ROOM_ID = "r1";
const TEACHER_ID = "t1";

const DATE_INPUT_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

/**
 * These cases drive whole flows — build a real lesson, render the surface, fill a
 * form, await the write, read the toast — alongside ninety other suites, which is
 * the contention the shared harness documents. The budget is generous and a timeout
 * is still a hard failure, never a hidden one.
 */
const FLOW_TIMEOUT = 20_000;

function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoDay(academyNow());

/** The next date whose weekday index is `index` (0 = Saturday … 3 = Tuesday). */
function nextWeekday(from: string, index: number): string {
  for (let step = 0; step <= 7; step += 1) {
    const candidate = addDays(from, step);
    if (candidate && weekdayIndex(candidate) === index) return candidate;
  }
  throw new Error("no matching weekday");
}

const ORIGINAL_DATE = nextWeekday(TODAY, CLASS_DAY);
const MAKEUP_DATE = addDays(ORIGINAL_DATE, 7)!;
const MOVED_DATE = addDays(ORIGINAL_DATE, 14)!;

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  window.location.hash = "";
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

/** Signs in, because the ledger records WHO decided. */
async function signInAs(email = "admin@demo.local") {
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
}

function renderView() {
  window.location.hash = "#/compensation";
  return render(
    <AuthProvider>
      <AppProvider>
        <CompensationView />
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

/** Waits for every read to answer before anything is clicked. */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
}

/** ZWNJ-insensitive comparison: the product's Persian joins words with it. */
const flat = (text: string) => text.replace(/\u200c/g, " ");

function shown(): string {
  return flat(document.body.textContent ?? "");
}

function has(text: string) {
  expect(shown(), `expected to see: ${text}`).toContain(flat(text));
}

function hasNot(text: string) {
  expect(shown(), `expected NOT to see: ${text}`).not.toContain(flat(text));
}

function toastText(): string {
  return flat(document.querySelector('[aria-live="polite"]')?.textContent ?? "");
}

/**
 * A success toast is recognisable in the DOM by its two resonance rings around the
 * gold check; no other tone renders them. That is the difference between "a
 * success toast fired" and "some toast fired".
 */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

async function expectToast(contains: string) {
  await waitFor(() => expect(toastText()).toContain(flat(contains)), { timeout: 8000 });
}

/* ------------------------------------------------------------------ */
/* Preconditions — real domains, real rows                             */
/* ------------------------------------------------------------------ */

/** One real private lesson of the seeded class, at a slot no seeded class occupies. */
async function privateLesson(date: string) {
  return getSchedulingRepository().create({
    classId: PRIVATE_CLASS,
    date,
    startTime: SLOT.startTime,
    endTime: SLOT.endTime,
    teacherId: TEACHER_ID,
    roomId: ROOM_ID,
    acknowledgeWarnings: true,
  });
}

/** A cancelled private lesson: the only thing compensation may ever start from. */
async function cancelledPrivateLesson(date: string): Promise<string> {
  const created = await privateLesson(date);
  await getSchedulingRepository().cancelSession(created.id, "لغو آزمایشی");
  return created.id;
}

async function registered(date = ORIGINAL_DATE): Promise<SessionCompensation> {
  return getCompensationRepository().register({
    originalSessionId: await cancelledPrivateLesson(date),
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسهٔ هنرجو",
    actor: ADMIN_ACTOR,
  });
}

async function booked(compensation: SessionCompensation, date = MAKEUP_DATE): Promise<SessionCompensation> {
  return getCompensationRepository().schedule(compensation.id, {
    date,
    startTime: SLOT.startTime,
    endTime: SLOT.endTime,
    roomId: ROOM_ID,
    teacherId: TEACHER_ID,
    acknowledgeWarnings: true,
    actor: ADMIN_ACTOR,
  });
}

/** Opens the selected obligation's drawer by clicking its row. */
async function openDrawer(studentName = PRIVATE_STUDENT_NAME) {
  fireEvent.click(await screen.findByText(studentName));
  await waitFor(() => expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0));
  return screen.getAllByRole("dialog")[0];
}

/* ------------------------------------------------------------------ */
/* Access and navigation shape                                         */
/* ------------------------------------------------------------------ */

describe("where the view sits in the product", () => {
  it("is reachable by the roles that may already read the schedule, and not by the accountant", () => {
    expect(viewPermissions.compensation).toBe("schedule.read");
    expect(viewTitles.compensation).toBe("جبرانی");
    expect(navGroups.flatMap((group) => group.items).find((item) => item.id === "compensation")?.label).toBe(
      "جبرانی",
    );

    expect(canAccessView({ permissions: permissionsForRole("teacher") }, "compensation")).toBe(true);
    expect(canAccessView({ permissions: permissionsForRole("staff") }, "compensation")).toBe(true);
    expect(canAccessView({ permissions: permissionsForRole("manager") }, "compensation")).toBe(true);
    // The accountant holds no schedule.read, so the surface is not theirs at all.
    expect(canAccessView({ permissions: permissionsForRole("accountant") }, "compensation")).toBe(false);
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* Permission                                                          */
/* ------------------------------------------------------------------ */

describe("a teacher may read, and may not write", () => {
  it("shows the state, offers no write control, and says why", async () => {
    // A real obligation exists, so the absence below is about the role and not
    // about an empty ledger.
    await registered();
    await signInAs(TEACHER_EMAIL);
    renderView();
    await settled();

    has("ثبت و تغییر جبرانی به این حساب داده نشده است.");
    expect(screen.queryByRole("button", { name: /ثبت جبرانی/ })).toBeNull();

    const drawer = await openDrawer();
    // The state is readable, and every decision control is absent.
    has("هنوز جلسهٔ جبرانی برای این تعهد ثبت نشده است؛");
    expect(screen.queryByRole("button", { name: /ثبت جلسهٔ جبرانی/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /ثبت انجام جبرانی/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /جابه‌جایی جلسه/ })).toBeNull();
    expect(drawer).toBeTruthy();
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

describe("registering an obligation", () => {
  it("writes the decision, claims only the record, and creates no session", async () => {
    await signInAs();
    const originalId = await cancelledPrivateLesson(ORIGINAL_DATE);
    renderView();
    await settled();

    has("جبرانی‌ای ثبت نشده است");

    fireEvent.click(screen.getByRole("button", { name: /ثبت جبرانی/ }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت جبرانی" });

    const select = await screen.findByRole("combobox", { name: /جلسهٔ لغوشده/ });
    await waitFor(() =>
      expect(
        Array.from(select.querySelectorAll("option")).filter((option) => option.value === originalId),
      ).toHaveLength(1),
    );
    fireEvent.change(select, { target: { value: originalId } });

    // The frozen student is the scheduling domain's own derived roster answer.
    await waitFor(() => expect(flat(dialog.textContent ?? "")).toContain(PRIVATE_STUDENT_NAME));

    fireEvent.change(screen.getByLabelText(/دلیل نیاز به جبرانی/), {
      target: { value: "لغو از سوی مدرس؛ هنرجو جلسه‌ای طلبکار است." },
    });
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت جبرانی")!);

    await expectToast("جبرانی ثبت شد");
    expect(successRings()).toBeGreaterThan(0);
    // The copy is explicit about what did NOT happen: no session, no notification.
    has("هنوز جلسه‌ای ساخته نشده و اطلاع‌رسانی‌ای انجام نشده است.");

    const rows = await getCompensationRepository().list({ per_page: 25 });
    expect(rows.data).toHaveLength(1);
    expect(rows.data[0].originalSessionId).toBe(originalId);
    expect(rows.data[0].studentId).toBe(PRIVATE_STUDENT);
    expect(rows.data[0].status).toBe("required");
    expect(rows.data[0].attempts).toHaveLength(0);

    // The table shows the obligation, and the calendar gained nothing.
    expect(await screen.findByText(PRIVATE_STUDENT_NAME)).toBeTruthy();
    const sessions = await getSchedulingRepository().list({ classId: PRIVATE_CLASS, per_page: 50 });
    const thatDay = sessions.data.filter(
      (session) => session.date === ORIGINAL_DATE && session.startTime === SLOT.startTime,
    );
    expect(thatDay.map((session) => session.id)).toEqual([originalId]);
  }, FLOW_TIMEOUT);

  it("asks about an attendance mark on the cancelled original, and refuses without the acknowledgement", async () => {
    await signInAs();
    /*
     * The mark has to exist BEFORE the cancellation: a cancelled row accepts no new
     * register. A session that was marked and then cancelled is exactly the case the
     * domain refuses to assume away, so the operator has to say they saw it.
     */
    const created = await privateLesson(ORIGINAL_DATE);
    await getAttendanceRepository().record({
      sessionId: created.id,
      studentId: PRIVATE_STUDENT,
      status: "present",
      recordedByUserId: ACTOR_ID,
    });
    await getSchedulingRepository().cancelSession(created.id, "لغو آزمایشی");
    const originalId = created.id;
    renderView();
    await settled();

    fireEvent.click(screen.getByRole("button", { name: /ثبت جبرانی/ }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت جبرانی" });
    const select = await screen.findByRole("combobox", { name: /جلسهٔ لغوشده/ });
    await waitFor(() =>
      expect(
        Array.from(select.querySelectorAll("option")).filter((option) => option.value === originalId),
      ).toHaveLength(1),
    );
    fireEvent.change(select, { target: { value: originalId } });
    await waitFor(() => expect(flat(dialog.textContent ?? "")).toContain(PRIVATE_STUDENT_NAME));
    fireEvent.change(screen.getByLabelText(/دلیل نیاز به جبرانی/), { target: { value: "لغو شد" } });

    const submit = () =>
      fireEvent.click(
        Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت جبرانی")!,
      );

    submit();
    // The repository's own sentence, verbatim, and nothing written.
    await expectToast("برای این هنرجو در جلسهٔ لغوشده حضور و غیاب ثبت شده است؛ ثبت جبرانی را تأیید کنید.");
    expect(successRings()).toBe(0);
    expect((await getCompensationRepository().list({ per_page: 25 })).data).toHaveLength(0);

    // Consent turns the same submission into the write the rule allows.
    fireEvent.click(screen.getByRole("switch", { name: /حضور و غیاب ثبت شده است/ }));
    submit();
    await expectToast("جبرانی ثبت شد");

    const rows = await getCompensationRepository().list({ per_page: 25 });
    expect(rows.data).toHaveLength(1);
    expect(rows.data[0].originalAttendanceAcknowledgedAt).toBeDefined();
    expect(rows.data[0].originalStudentAttendance).toBe("present");
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* Book                                                                */
/* ------------------------------------------------------------------ */

describe("booking the make-up", () => {
  it("creates a real session through scheduling and reports the C-2 fact as information", async () => {
    await signInAs();
    const compensation = await registered();
    renderView();
    await settled();

    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: /ثبت جلسهٔ جبرانی/ }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت جلسهٔ جبرانی" });

    // The domain's own prefill is the original's slot; the make-up is deliberately
    // moved to another day, which is what the dialog is for.
    fireEvent.change(screen.getByLabelText(/تاریخ \(شمسی\)/), {
      target: { value: isoToJalaliDisplay(MAKEUP_DATE, DATE_INPUT_OPTIONS) },
    });
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت جلسه")!);

    await expectToast("جلسهٔ جبرانی ثبت شد");
    expect(successRings()).toBeGreaterThan(0);

    const after = await getCompensationRepository().get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attemptBroken).toBe(false);
    expect(after.currentAttempt?.sessionStatus).toBe("scheduled");
    expect(after.currentAttempt?.rescheduleCount).toBe(0);
    expect(after.currentAttempt?.bookedSessionId).toBe(after.currentAttempt?.sessionId);
    // The ordinary case: the frozen student is still expected at the make-up.
    expect(after.currentAttempt?.studentOnRoster).toBe(true);

    // The session is the CALENDAR's: an ordinary, manually created session of the class.
    const makeUp = await getSchedulingRepository().get(after.currentAttempt!.sessionId);
    expect(makeUp.date).toBe(MAKEUP_DATE);
    expect(makeUp.startTime).toBe(SLOT.startTime);
    expect(makeUp.origin).toBe("manual");
    expect(makeUp.status).toBe("scheduled");
  }, FLOW_TIMEOUT);

  it("still books when the enrollment ended before the make-up, and says so without gating anything", async () => {
    await signInAs();
    const compensation = await registered();
    renderView();
    await settled();

    /*
     * End the enrollment ON the cancelled original's own day — the C-2 condition —
     * and prove the condition is real before any assertion about the screen: the
     * make-up's own derived roster no longer expects the frozen student.
     */
    const endDate = isoToJalaliDisplay(ORIGINAL_DATE, DATE_INPUT_OPTIONS);
    expect(jalaliToIso(endDate)).toBe(ORIGINAL_DATE);
    await getEnrollmentRepository().update(PRIVATE_ENROLLMENT, { endDate });

    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: /ثبت جلسهٔ جبرانی/ }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت جلسهٔ جبرانی" });
    fireEvent.change(screen.getByLabelText(/تاریخ \(شمسی\)/), {
      target: { value: isoToJalaliDisplay(MAKEUP_DATE, DATE_INPUT_OPTIONS) },
    });
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت جلسه")!);

    await expectToast("جلسهٔ جبرانی ثبت شد");
    // The disclosure reaches the operator as INFORMATION, in the same breath as the
    // success — and the write was not refused.
    has("هنرجو در فهرست این روز نیست");

    const after = await getCompensationRepository().get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.currentAttempt?.studentOnRoster).toBe(false);
    expect(after.currentAttempt?.sessionStatus).toBe("scheduled");

    // Off the roster is not a broken obligation: the discharge is still offered.
    expect(await screen.findByRole("button", { name: /ثبت انجام جبرانی/ })).toBeTruthy();
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* Move and discharge                                                  */
/* ------------------------------------------------------------------ */

describe("moving the make-up and discharging it", () => {
  it("moves the EFFECTIVE session, keeps one booking, and discharges the new row", async () => {
    await signInAs();
    const compensation = await booked(await registered());
    const bookedSessionId = compensation.currentAttempt!.sessionId;
    renderView();
    await settled();

    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: /جابه‌جایی جلسه/ }));
    const move = await screen.findByRole("dialog", { name: "جابه‌جایی جلسه" });

    fireEvent.change(screen.getByLabelText(/روز/), {
      target: { value: isoToJalaliDisplay(MOVED_DATE, DATE_INPUT_OPTIONS) },
    });
    fireEvent.change(screen.getByLabelText(/دلیل جابه‌جایی/), { target: { value: "درخواست هنرجو" } });

    // The dialog's own preview has to settle (and report no conflict) before the
    // submit is enabled; the test waits for the control, never for a timer.
    const moveButton = () =>
      Array.from(move.querySelectorAll("button")).find((button) => button.textContent?.trim() === "جابه‌جایی جلسه")!;
    await waitFor(() => expect(moveButton().disabled).toBe(false), { timeout: 8000 });
    fireEvent.click(moveButton());

    await expectToast("جلسهٔ جبرانی جابه‌جا شد");
    expect(successRings()).toBeGreaterThan(0);

    const moved = await getCompensationRepository().get(compensation.id);
    // ONE booking, moved: the ledger line is untouched and the effective session
    // is the end of the chain.
    expect(moved.attempts).toHaveLength(1);
    expect(moved.status).toBe("scheduled");
    expect(moved.attemptBroken).toBe(false);
    expect(moved.currentAttempt?.rescheduleCount).toBe(1);
    expect(moved.currentAttempt?.bookedSessionId).toBe(bookedSessionId);
    expect(moved.currentAttempt?.sessionId).not.toBe(bookedSessionId);
    expect(moved.currentAttempt?.sessionStatus).toBe("scheduled");

    // The row the ledger recorded is cancelled BY DESIGN — which is exactly why no
    // action may target it.
    const movedFrom = await getSchedulingRepository().get(bookedSessionId);
    expect(movedFrom.status).toBe("cancelled");
    const makeUp = await getSchedulingRepository().get(moved.currentAttempt!.sessionId);
    expect(makeUp.date).toBe(MOVED_DATE);

    // The discharge goes to the effective session, so it succeeds. Aimed at
    // `bookedSessionId` it would have been refused as NOT_SCHEDULED.
    fireEvent.click(screen.getByRole("button", { name: /ثبت انجام جبرانی/ }));
    const confirm = await screen.findByRole("dialog", { name: "ثبت انجام جبرانی" });
    fireEvent.click(
      Array.from(confirm.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت انجام")!,
    );

    await expectToast("جبرانی انجام‌شده ثبت شد");
    const done = await getCompensationRepository().get(compensation.id);
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeDefined();
    expect(done.attempts).toHaveLength(1);
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* The attention state                                                 */
/* ------------------------------------------------------------------ */

describe("a make-up that was cancelled", () => {
  it("returns the obligation to required, and offers a new booking", async () => {
    await signInAs();
    const compensation = await booked(await registered());
    const effectiveId = compensation.currentAttempt!.sessionId;
    // Cancelling the EFFECTIVE session — the end of the chain — is what reopens the
    // obligation; cancelling a moved-from row would not (C-1.1).
    await getSchedulingRepository().cancelSession(effectiveId, "لغو جلسهٔ جبرانی");

    renderView();
    await settled();

    const reopened = await getCompensationRepository().get(compensation.id);
    expect(reopened.status).toBe("required");
    expect(reopened.attemptBroken).toBe(true);
    expect(
      (await getCompensationRepository().list({ needsAttention: true, per_page: 25 })).data.map((row) => row.id),
    ).toEqual([compensation.id]);

    // The screen reports it as needing attention, in the domain's own terms.
    has("جلسهٔ پیشین از دست رفت");
    const drawer = await openDrawer();
    has("به «نیازمند جبرانی» بازگشته و ثبت جلسهٔ تازه مجاز است.");
    expect(flat(drawer.textContent ?? "")).toContain(flat("نیازمند توجه"));

    // And the next decision is offered: booking a new make-up, not editing the old.
    fireEvent.click(screen.getByRole("button", { name: /ثبت جلسهٔ جبرانی/ }));
    const dialog = await screen.findByRole("dialog", { name: "ثبت جلسهٔ جبرانی" });
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.trim() === "ثبت جلسه")!,
    );

    await expectToast("جلسهٔ جبرانی ثبت شد");
    const rebooked = await getCompensationRepository().get(compensation.id);
    expect(rebooked.status).toBe("scheduled");
    expect(rebooked.attempts).toHaveLength(2);
    // Still at most one LIVE make-up: the second line is the current attempt.
    expect(rebooked.currentAttempt?.sessionId).not.toBe(effectiveId);
  }, FLOW_TIMEOUT);
});

/* ------------------------------------------------------------------ */
/* Failure is not emptiness                                            */
/* ------------------------------------------------------------------ */

describe("a failed read", () => {
  it("is reported as an error, never as an empty ledger", async () => {
    await signInAs();
    setCompensationRepository(
      withStubs(getCompensationRepository(), {
        list: async () => {
          throw new ApiError({
            kind: "network",
            code: "OFFLINE",
            message: "اتصال به سرویس برقرار نشد.",
          });
        },
      }),
    );
    renderView();

    expect(await screen.findByRole("alert")).toBeTruthy();
    has("اتصال به سرویس برقرار نشد.");
    hasNot("جبرانی‌ای ثبت نشده است");
    expect(successRings()).toBe(0);
  }, FLOW_TIMEOUT);
});
