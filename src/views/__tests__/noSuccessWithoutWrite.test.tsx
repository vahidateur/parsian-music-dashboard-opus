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
 *     the sanctioned "requires a server" shape (both finance reminders, and the
 *     attendance mark-all, which is a real on-screen convenience but records
 *     nothing);
 *   - a control that can do something true does that instead (the class waitlist
 *     now opens the schedule).
 *
 * These cases are the behavioural half of the guarantee; the structural half —
 * no success toast literal can exist in a view that cannot write — lives in
 * `src/__tests__/writeFeedbackHonesty.test.ts`, and together they are what makes
 * "no success notification without a write" enforceable rather than aspirational.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AttendanceView } from "@/views/Attendance";
import { ClassesView } from "@/views/Classes";
import { FinanceView } from "@/views/Finance";
import { SchedulingView } from "@/views/Scheduling";
import { classById, weekSessions } from "@/data/records";
import { faTime } from "@/lib/format";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import {
  getClassRepository,
  getEnrollmentRepository,
  getStudentRepository,
  resetRegistry,
} from "@/domains/registry";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";

/** Every claim the seven controls used to make. None may appear anywhere. */
const RETRACTED_CLAIMS = [
  "تعارض برطرف شد",
  "همه حاضر ثبت شدند",
  "پیام پیگیری ارسال شد",
  "یادآوری ارسال شد",
  "یادآوری گروهی ارسال شد",
  "پیشنهاد بازهٔ جدید ثبت شد",
] as const;

/** Views that read static fixtures and therefore cannot write anything. */
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

/* ------------------------------------------------------------------ */
/* Sites 1 and 2 — scheduling conflict card and session drawer          */
/* ------------------------------------------------------------------ */
describe("scheduling conflicts", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  it("keeps the warning on screen and offers only the action that does something true", async () => {
    renderView("#/schedule", SchedulingView);
    await settled();

    // The evidence survives: an unresolved conflict is still reported.
    expect(screen.getByText("تعارض اتاق ۱ در سه‌شنبه ساعت ۱۴:۰۰")).toBeTruthy();
    // The control that claimed to fix it is gone, not disabled.
    expect(screen.queryByRole("button", { name: /انتقال به اتاق ۴/ })).toBeNull();
    for (const claim of RETRACTED_CLAIMS) {
      expect(document.body.textContent, claim).not.toContain(claim);
    }

    // What remains really moves the calendar, and announces nothing.
    fireEvent.click(screen.getByRole("button", { name: "مشاهده در تقویم" }));
    expectNoToast();
  });

  it("opens the conflicted session and keeps the drawer open, with nothing claiming a transfer", async () => {
    renderView("#/schedule", SchedulingView);
    await settled();

    // Derived from the fixture rather than hardcoded, so the case follows the
    // data if the seeded conflict moves.
    const conflicted = weekSessions.find((s) => s.conflictWith);
    expect(conflicted, "the schedule fixture carries a conflict").toBeDefined();
    const blockTitle = `${classById(conflicted!.classId)?.title} · ${faTime(conflicted!.start)}`;
    const block = document.querySelector<HTMLButtonElement>(`button[title^="${blockTitle}"]`);
    expect(block, `no session block titled ${blockTitle}`).not.toBeNull();

    fireEvent.click(block!);
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/هم‌پوشانی دارد/)).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: /انتقال به اتاق ۴/ })).toBeNull();

    // Closing is still the user's own explicit act, not a side effect of a
    // write that was claimed but never performed.
    fireEvent.click(within(drawer).getAllByRole("button", { name: "بستن" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expectNoToast();
  });
});

/* ------------------------------------------------------------------ */
/* Sites 3 and 4 — attendance roster and absentee follow-up             */
/* ------------------------------------------------------------------ */
describe("attendance", () => {
  beforeEach(() => {
    resetToDemoEnvironment();
    resetRegistry();
  });

  /** Roster mark buttons carry `aria-pressed`, so the local effect is visible. */
  const presentButtons = () => screen.queryAllByRole("button", { name: /^حاضر$/ });
  const pressedPresent = () =>
    presentButtons().filter((b) => b.getAttribute("aria-pressed") === "true").length;

  it("marks the roster on screen and says plainly that nothing was recorded", async () => {
    renderView("#/attendance", AttendanceView);
    await settled();

    const before = pressedPresent();
    fireEvent.click(screen.getByRole("button", { name: /همه حاضر/ }));

    // The convenience still works — this is why the control was kept at all.
    await waitFor(() => expect(pressedPresent()).toBe(presentButtons().length));
    expect(pressedPresent()).toBeGreaterThan(before);

    // …and the confirmation no longer claims a record was written.
    await expectHonestToast("هیچ حضوری ثبت نشده است");
    expect(toastText()).toContain("همه در همین صفحه حاضر شدند");
    expect(toastText()).not.toContain("ثبت شدند");
  });

  it("drops the fake follow-up message and keeps the row's real navigation", async () => {
    renderView("#/attendance", AttendanceView);
    await settled();
    fireEvent.click(screen.getByRole("tab", { name: /غایبان و پیگیری/ }));

    // The tab is still named «غایبان و پیگیری»; what is gone is the control that
    // claimed a student and their guardian had been notified.
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "پیگیری" })).toHaveLength(0));
    expect(document.body.textContent).not.toContain("پیام پیگیری ارسال شد");

    const rows = screen
      .getAllByRole("button")
      .filter((b) => (b.textContent ?? "").includes("حضور کلی"));
    expect(rows.length, "the absentee list is populated").toBeGreaterThan(0);

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

  it("says a payment reminder needs an SMS service instead of announcing one", async () => {
    renderView("#/finance?filter=overdue", FinanceView);
    await settled();

    const table = await screen.findByRole("table", { name: "فهرست فاکتورها" });
    // The reminder is an icon-only button, so it is the row control with no text.
    const reminders = within(table)
      .getAllByRole("button")
      .filter((b) => (b.textContent ?? "").trim() === "");
    expect(reminders.length, "unpaid invoices offer a reminder").toBeGreaterThan(0);

    fireEvent.click(reminders[0]);
    await expectHonestToast("نیازمند سرویس پیامک است");
    expect(toastText()).toContain("ارسال نشد");
    for (const claim of RETRACTED_CLAIMS) expect(toastText()).not.toContain(claim);
  });

  it("says the same for the group reminder, and invents no queue", async () => {
    renderView("#/finance?filter=overdue", FinanceView);
    await settled();

    fireEvent.click(await screen.findByRole("button", { name: /یادآوری گروهی/ }));
    await expectHonestToast("هیچ پیامی ارسال یا در صف قرار نگرفت");
    expect(toastText()).not.toContain("در صف ارسال قرار گرفت");
    expect(toastText()).not.toContain("یادآوری گروهی ارسال شد");
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
