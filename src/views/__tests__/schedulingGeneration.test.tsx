// @vitest-environment jsdom
/**
 * M4 / CP3 — generation is a repository write, and it is reported as one.
 *
 * Generation is the scheduling write that produces many records at once, so the
 * questions worth answering are not "does a toast appear" but:
 *
 *   1. does the plan on screen come from the domain, and does previewing write
 *      nothing?
 *   2. does the window the form proposes come from the calendar's own state?
 *   3. does a real write create the records the domain planned — with the
 *      domain's own content-derived ids, inside the requested range?
 *   4. are those records visible from a re-read rather than from a local guess?
 *   5. can a double click, a repeated Enter or an impatient second submit produce
 *      a second write?
 *   6. does a refusal arrive in the repository's own words, with no success, no
 *      fabricated rows and no reload nobody asked for?
 *   7. do the domain's own gates survive the trip through the UI — updates only on
 *      explicit confirmation, orphans reported and never deleted, a re-run over
 *      the same window writing nothing?
 *   8. can a changed calendar leave the form aiming at a window the user did not
 *      choose?
 *   9. does an environment with no classes offer generation to nobody and invent
 *      no class list?
 *  10. is any of it dressed up as a notification, a server write, a deletion or a
 *      resolved conflict?
 *
 * Everything here runs against the REAL demo repositories (`resetToDemoEnvironment`
 * + `withStubs`), so the plans, the protections and the written rows are the
 * domain's own. Only `generateSessions` is ever held, failed or counted — the verb
 * under test — and when a held write is released it is the real one that runs.
 *
 * Waits are on rendered plan text, control state or repository call counts. There
 * is no sleep and no timer anywhere in this file.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError } from "@/api/errors";
import { Toasts } from "@/components/overlays/ActionSheet";
import { AppProvider } from "@/context/AppContext";
import type { AcademyClass, CreateClassInput } from "@/domains/classes/types";
import {
  getClassRepository,
  getSchedulingRepository,
  resetRegistry,
  setClassRepository,
  setSchedulingRepository,
} from "@/domains/registry";
import { addDays, isoToJalaliDisplay, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { deterministicSessionId } from "@/domains/scheduling/generation";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import {
  SESSION_ERRORS,
  type GenerateInput,
  type GenerationResult,
  type Session,
} from "@/domains/scheduling/types";
import { academyNow } from "@/domains/shared/clock";
import { faNum } from "@/lib/format";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { SchedulingView } from "@/views/Scheduling";

/* ------------------------------------------------------------------ */
/* Dates: the academy's own, never a hardcoded calendar day             */
/* ------------------------------------------------------------------ */

function isoOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = isoOf(academyNow());
const TODAY_WEEKDAY = weekdayIndex(TODAY) ?? 0;
/** The week the calendar opens on: Saturday-first, exactly as the view derives it. */
const WEEK_START = addDays(TODAY, -TODAY_WEEKDAY)!;
const WEEK_END = addDays(WEEK_START, 6)!;
const TWO_WEEKS_END = addDays(WEEK_END, 7)!;
const NEXT_WEEK_START = addDays(WEEK_START, 7)!;
const NEXT_WEEK_END = addDays(NEXT_WEEK_START, 6)!;
/** Another weekday of the same week, for the class that moves its day. */
const OTHER_WEEKDAY = (TODAY_WEEKDAY + 2) % 7;

const DATE_INPUT_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

/** The same Jalali the form's own date fields speak, so a value round-trips. */
function jalaliInput(iso: string): string {
  return isoToJalaliDisplay(iso, DATE_INPUT_OPTIONS);
}

/** The day named the way the dialog names its planned slots. */
function jalaliDayOf(iso: string): string {
  return isoToJalaliDisplay(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** The probe class's slot: 07:00 is earlier than anything the seed schedules. */
const PROBE_START = "07:00";
const PROBE_END = "07:45";
const PROBE_SLOT = /۰۷:۰۰–۰۷:۴۵/;
const PROBE_TITLE = "کلاس آزمایشی تولید";

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

type Outcome = { kind: "real" } | { kind: "hold" } | { kind: "fail"; cause: unknown };

/**
 * Real demo repositories throughout, with the generation verb — and only it —
 * under the case's control. `list` and `previewGeneration` are wrapped so a case
 * can count reads and prove the plan came from the domain, but both still run the
 * real implementation.
 */
function installGeneration(outcome: Outcome = { kind: "real" }) {
  const real = getSchedulingRepository();
  const held: (() => Promise<void>)[] = [];

  const list: Mock = vi.fn(real.list.bind(real));
  const previewGeneration: Mock = vi.fn(real.previewGeneration.bind(real));
  const generateSessions: Mock = vi.fn(async (input: GenerateInput): Promise<GenerationResult> => {
    if (outcome.kind === "hold") {
      return new Promise<GenerationResult>((resolve, reject) => {
        held.push(async () => {
          try {
            resolve(await real.generateSessions(input));
          } catch (cause) {
            reject(cause);
          }
        });
      });
    }
    if (outcome.kind === "fail") throw outcome.cause;
    return real.generateSessions(input);
  });

  const stubs: Stubs<SchedulingRepository> = { list, previewGeneration, generateSessions };
  setSchedulingRepository(withStubs(real, stubs));

  return {
    list,
    previewGeneration,
    generateSessions,
    /** Every held write really runs, so the store really changes. */
    release: async () => {
      const waiting = held.splice(0, held.length);
      expect(waiting.length, "a generation was expected to be in flight").toBeGreaterThan(0);
      await act(async () => {
        for (const run of waiting) await run();
      });
    },
  };
}

/** A class the demo store really holds, meeting once inside the visible week. */
async function createProbeClass(over: Partial<CreateClassInput> = {}): Promise<AcademyClass> {
  return getClassRepository().create({
    title: PROBE_TITLE,
    instrument: "theory",
    teacherId: "t1",
    roomId: "r1",
    kind: "group",
    level: "سطح ۱",
    days: [TODAY_WEEKDAY],
    time: PROBE_START,
    duration: 45,
    capacity: 4,
    tuition: 1_000_000,
    ...over,
  });
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

/** The calendar has answered when a session block is on screen. */
async function calendarSettled() {
  const blocks = await screen.findAllByTitle(/·/);
  expect(blocks.length, "the seeded week has sessions to render").toBeGreaterThan(0);
}

async function openGeneration(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "تولید جلسات" }));
  return screen.findByRole("dialog", { name: "تولید جلسات" });
}

function classSelect(dialog: HTMLElement) {
  return within(dialog).getByLabelText(/^کلاس/, { selector: "select" }) as HTMLSelectElement;
}

function dateField(dialog: HTMLElement, label: RegExp) {
  return within(dialog).getByLabelText(label) as HTMLInputElement;
}

function submitButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "تولید جلسات" }) as HTMLButtonElement;
}

function pickClass(dialog: HTMLElement, klass: AcademyClass) {
  fireEvent.change(classSelect(dialog), { target: { value: klass.id } });
}

/** The domain's plan is on screen when its own summary line is. */
async function planShown(dialog: HTMLElement) {
  await within(dialog).findByText(/ایجاد ·/);
}

/** Waits for the plan to answer and for nothing to be blocking the write. */
async function submitReady(dialog: HTMLElement) {
  await waitFor(() => expect(submitButton(dialog).disabled).toBe(false));
}

function submitGenerate(dialog: HTMLElement) {
  fireEvent.click(submitButton(dialog));
}

/** Opens the dialog, aims it at a class, waits for the plan, writes. */
async function generateFor(klass: AcademyClass) {
  const dialog = await openGeneration();
  pickClass(dialog, klass);
  await planShown(dialog);
  await submitReady(dialog);
  submitGenerate(dialog);
  return dialog;
}

/** The toast region: `Toasts` marks it `aria-live="polite"`. */
function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/**
 * A success toast is recognisable by its two resonance rings around the gold
 * check; no other tone renders them. That is the difference between "a success
 * fired" and "something fired" — and an idempotent re-run earns `info`, not this.
 */
function successRings(): number {
  return document.querySelectorAll('[aria-live="polite"] .animate-resonance').length;
}

async function expectToast(contains: string) {
  await waitFor(() => expect(toastText(), `toasts so far: ${toastText()}`).toContain(contains), {
    timeout: 8000,
  });
}

function expectNoSuccess() {
  expect(successRings(), `a success toast fired for: ${toastText()}`).toBe(0);
  expect(toastText()).not.toContain("تعارض برطرف شد");
}

/**
 * The most recent toast. Toasts stack for a few seconds, so a case that writes
 * twice has to ask about the second announcement rather than about the region —
 * the first one's success rings would otherwise answer for it.
 */
function lastToast(): HTMLElement {
  const region = document.querySelector('[aria-live="polite"]');
  const toasts = region?.querySelectorAll(":scope > div") ?? [];
  expect(toasts.length, `no toast was announced: ${toastText()}`).toBeGreaterThan(0);
  return toasts[toasts.length - 1] as HTMLElement;
}

/** What generation may never claim, because none of it exists (E-3, §5). */
const FORBIDDEN_CLAIMS = [
  "تعارض برطرف شد",
  "مدرس مطلع شد",
  "هنرجو مطلع شد",
  "پیامک",
  "ارسال شد",
  "در سرور ثبت شد",
  "حذف شد",
] as const;

/** The probe class's sessions, read back from the repository. */
async function probeSessions(classId: string, from = WEEK_START, to = WEEK_END): Promise<Session[]> {
  const page = await getSchedulingRepository().list({ from, to, per_page: 200 });
  return page.data.filter((session) => session.classId === classId);
}

beforeEach(() => {
  window.location.hash = "";
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  setSchedulingRepository(undefined);
  setClassRepository(undefined);
  resetRegistry();
  window.location.hash = "";
});

/* ------------------------------------------------------------------ */
/* The plan is the domain's, and previewing writes nothing              */
/* ------------------------------------------------------------------ */

describe("generation preview", () => {
  it("shows the domain's own plan for the calendar's own window, and writes nothing", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();

    // The window is the calendar's, not a date the form invented (§3): the same
    // week the grid is showing, in the Jalali the rest of the view speaks.
    expect(dateField(dialog, /^از تاریخ/).value).toBe(jalaliInput(WEEK_START));
    expect(dateField(dialog, /^تا تاریخ/).value).toBe(jalaliInput(WEEK_END));
    // And nothing is aimed until the user aims it.
    expect(classSelect(dialog).value).toBe("");
    expect(submitButton(dialog).disabled, "no class, no write").toBe(true);

    pickClass(dialog, probe);
    await planShown(dialog);

    // The preview asked the repository, with exactly the window on screen.
    await waitFor(() => expect(generation.previewGeneration).toHaveBeenCalled());
    expect(generation.previewGeneration.mock.calls.at(-1)?.[0]).toEqual({
      classId: probe.id,
      from: WEEK_START,
      to: WEEK_END,
      confirmUpdates: false,
    });

    // The recurrence is stated from the class read, not narrated.
    expect(dialog.textContent).toContain("ساعت ۰۷:۰۰");
    expect(dialog.textContent).toContain(`${faNum(45)} دقیقه`);
    // One weekly occurrence in a one-week window, on the day the class meets.
    expect(dialog.textContent).toContain(`${faNum(1)} ایجاد · ${faNum(0)} به‌روزرسانی`);
    expect(dialog.textContent).toContain(jalaliDayOf(TODAY));
    expect(dialog.textContent).toContain("۰۷:۰۰–۰۷:۴۵");
    // Labelled as what it is.
    expect(dialog.textContent).toContain("این یک پیش‌نمایش است");

    // Previewing is not writing.
    expect(generation.generateSessions).not.toHaveBeenCalled();
    expect(await probeSessions(probe.id)).toEqual([]);
    expect(toastText()).toBe("");
  });

  it("re-plans when the window changes, and writes only the window on screen", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);
    expect(dialog.textContent).toContain(`${faNum(1)} ایجاد`);

    // Two weeks of a weekly class is two slots: the numbers on screen are the
    // domain's answer to the new question, not a stale plan.
    fireEvent.change(dateField(dialog, /^تا تاریخ/), { target: { value: jalaliInput(TWO_WEEKS_END) } });
    await within(dialog).findByText(new RegExp(`${faNum(2)} ایجاد`));

    await submitReady(dialog);
    submitGenerate(dialog);

    await waitFor(() => expect(generation.generateSessions).toHaveBeenCalledTimes(1));
    expect(generation.generateSessions.mock.calls[0][0]).toEqual({
      classId: probe.id,
      from: WEEK_START,
      to: TWO_WEEKS_END,
      confirmUpdates: false,
    });
    await expectToast("جلسات تولید شد");

    // Both records exist, both inside the window that was asked for (§8.6).
    const written = await probeSessions(probe.id, WEEK_START, TWO_WEEKS_END);
    expect(written).toHaveLength(2);
    for (const session of written) {
      expect(session.date >= WEEK_START).toBe(true);
      expect(session.date <= TWO_WEEKS_END).toBe(true);
      expect(weekdayIndex(session.date)).toBe(TODAY_WEEKDAY);
      expect(session).toMatchObject({ startTime: PROBE_START, endTime: PROBE_END, origin: "generated" });
    }
  });

  it("refuses an impossible window in the domain's own words, before any write", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);

    // An end before the start: the planner's own sentence, and the write blocked.
    fireEvent.change(dateField(dialog, /^تا تاریخ/), {
      target: { value: jalaliInput(addDays(WEEK_START, -1)!) },
    });
    expect(await within(dialog).findByText("تاریخ پایان باید پس از تاریخ شروع باشد.")).toBeTruthy();
    expect(dialog.textContent).toContain("تولید برای این بازه ممکن نیست");
    expect(submitButton(dialog).disabled, "a hard conflict blocks the write").toBe(true);
    submitGenerate(dialog);
    expect(generation.generateSessions).not.toHaveBeenCalled();

    // And the window cap is the domain's, stated in its own number.
    fireEvent.change(dateField(dialog, /^تا تاریخ/), {
      target: { value: jalaliInput(addDays(WEEK_START, 400)!) },
    });
    expect(await within(dialog).findByText(/بازهٔ تولید نمی‌تواند بیش از/)).toBeTruthy();
    expect(generation.generateSessions).not.toHaveBeenCalled();
    expectNoSuccess();
  });
});

/* ------------------------------------------------------------------ */
/* The write                                                           */
/* ------------------------------------------------------------------ */

describe("generation write", () => {
  it("creates the planned sessions, and they are visible from a re-read", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();
    const readsBefore = generation.list.mock.calls.length;

    await generateFor(probe);

    await waitFor(() => expect(generation.generateSessions).toHaveBeenCalledTimes(1));
    expect(generation.generateSessions.mock.calls[0][0]).toEqual({
      classId: probe.id,
      from: WEEK_START,
      to: WEEK_END,
      confirmUpdates: false,
    });

    // Success, after the promise resolved, describing only what happened.
    await expectToast("جلسات تولید شد");
    expect(successRings(), "an awaited write may report success").toBeGreaterThan(0);
    expect(toastText()).toContain(`${faNum(1)} جلسه برای ${PROBE_TITLE}`);
    for (const claim of FORBIDDEN_CLAIMS) expect(toastText(), claim).not.toContain(claim);

    // The dialog closed only because the write succeeded, and the calendar re-read.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "تولید جلسات" })).toBeNull());
    await waitFor(() => expect(generation.list.mock.calls.length).toBeGreaterThan(readsBefore));

    // The block on the grid is the repository's row, not a locally manufactured one.
    const block = await screen.findByTitle(PROBE_SLOT);
    expect(block.getAttribute("title")).toContain(PROBE_TITLE);

    const written = await probeSessions(probe.id);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      id: deterministicSessionId(probe.id, TODAY, PROBE_START),
      date: TODAY,
      startTime: PROBE_START,
      endTime: PROBE_END,
      status: "scheduled",
      origin: "generated",
    });
  });

  it("claims nothing while the write is in flight, and cannot be asked twice", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration({ kind: "hold" });
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);
    await submitReady(dialog);

    submitGenerate(dialog);
    await within(dialog).findByText("در حال تولید…");

    // A second click and a second Enter find nothing to press: the control is
    // busy, and `useEntityForm` refuses a submit that is already in flight.
    fireEvent.click(within(dialog).getByRole("button", { name: "در حال تولید…" }));
    fireEvent.submit(dialog.querySelector("form")!);
    expect(generation.generateSessions, "one submit, one write").toHaveBeenCalledTimes(1);

    // Pending: no claim of any kind, no fabricated row, and no way out mid-write.
    expect(toastText()).toBe("");
    expectNoSuccess();
    expect(screen.queryByTitle(PROBE_SLOT)).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "تولید جلسات" }), "the form survives the write").toBeTruthy();

    await generation.release();

    await expectToast("جلسات تولید شد");
    expect(successRings()).toBeGreaterThan(0);
    expect(await probeSessions(probe.id)).toHaveLength(1);
    expect(await screen.findByTitle(PROBE_SLOT)).toBeTruthy();
    // Still one write: releasing did not ask again.
    expect(generation.generateSessions).toHaveBeenCalledTimes(1);
  });

  it("reports a refusal verbatim, fabricates nothing and reloads nothing", async () => {
    const probe = await createProbeClass();
    const refusal = new ApiError({
      kind: "conflict",
      code: SESSION_ERRORS.CONFLICT,
      message: "تولید جلسات به دلیل تعارض انجام نشد.",
      payload: { conflicts: ["اتاق «اتاق ۱» در این ساعت جلسهٔ دیگری دارد."] },
    });
    const generation = installGeneration({ kind: "fail", cause: refusal });
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);
    await submitReady(dialog);
    const readsBefore = generation.list.mock.calls.length;

    submitGenerate(dialog);

    await expectToast(refusal.message);
    expect(toastText()).toContain("تولید جلسات انجام نشد");
    expectNoSuccess();

    // The form stays open, so the window can be corrected rather than retyped.
    expect(screen.getByRole("dialog", { name: "تولید جلسات" })).toBeTruthy();
    expect(within(dialog).getByText(refusal.message)).toBeTruthy();

    // No reload the user did not ask for: a failure changed nothing, so nothing is
    // read again. (Counted before the read-back below, which uses the same verb.)
    expect(generation.list.mock.calls.length, "a refusal re-reads nothing").toBe(readsBefore);
    // No optimistic rows on the grid, and none in the store.
    expect(screen.queryByTitle(PROBE_SLOT)).toBeNull();
    expect(await probeSessions(probe.id)).toEqual([]);
  });

  it("keeps the repository's field message on the field it named", async () => {
    const probe = await createProbeClass();
    const fieldMessage = "بازهٔ کوچک‌تری انتخاب کنید.";
    const generation = installGeneration({
      kind: "fail",
      cause: new ApiError({
        kind: "validation",
        code: SESSION_ERRORS.GENERATION_WINDOW_INVALID,
        message: "تعداد جلسات این بازه بیش از حد مجاز است.",
        fields: { to: [fieldMessage] },
      }),
    });
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);
    await submitReady(dialog);
    submitGenerate(dialog);

    await expectToast("تعداد جلسات این بازه بیش از حد مجاز است.");
    expect(await within(dialog).findByText(fieldMessage)).toBeTruthy();
    expect(dateField(dialog, /^تا تاریخ/).getAttribute("aria-invalid")).toBe("true");
    expectNoSuccess();
    expect(generation.generateSessions).toHaveBeenCalledTimes(1);
  });

  it("writes nothing the second time: an unchanged window is the domain's no-op", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();

    await generateFor(probe);
    await expectToast("جلسات تولید شد");
    expect(await probeSessions(probe.id)).toHaveLength(1);

    // The same window again. Slot ids are content-derived, so the domain finds its
    // own work and reports a plan that writes nothing.
    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);
    expect(dialog.textContent).toContain(`${faNum(0)} ایجاد`);
    expect(dialog.textContent).toContain("بدون تغییر");
    expect(dialog.textContent).toContain("این بازه نوشتنی ندارد");
    await submitReady(dialog);
    submitGenerate(dialog);

    await expectToast("تولید اجرا شد؛ جلسه‌ای نوشته نشد");
    const announced = lastToast();
    expect(announced.textContent).toContain("تولید اجرا شد؛ جلسه‌ای نوشته نشد");
    expect(
      announced.querySelectorAll(".animate-resonance").length,
      "a run that wrote nothing earns no success",
    ).toBe(0);
    expect(announced.textContent).toContain("پیش‌تر تولید شده");
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(announced.textContent ?? "", claim).not.toContain(claim);
    }

    expect(generation.generateSessions).toHaveBeenCalledTimes(2);
    expect(await probeSessions(probe.id), "idempotent by construction").toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* The domain's own gates, through the UI                               */
/* ------------------------------------------------------------------ */

describe("generation protections", () => {
  it("updates an existing session only on explicit confirmation", async () => {
    const probe = await createProbeClass();
    // One real generation, then the class's duration moves: the slot id is
    // unchanged, so the domain offers an UPDATE rather than rewriting it quietly.
    await getSchedulingRepository().generateSessions({ classId: probe.id, from: WEEK_START, to: WEEK_END });
    await getClassRepository().update(probe.id, { duration: 60 });

    const generation = installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);

    expect(dialog.textContent).toContain(`${faNum(0)} ایجاد · ${faNum(1)} به‌روزرسانی`);
    expect(dialog.textContent).toContain("۰۷:۰۰–۰۷:۴۵");
    expect(dialog.textContent).toContain("۰۷:۰۰–۰۸:۰۰");
    expect(dialog.textContent).toContain("بدون این تأیید، جلسات موجود دست‌نخورده می‌مانند");
    const confirm = within(dialog).getByRole("switch", { name: "به‌روزرسانی جلسات موجود" });
    expect(confirm.getAttribute("aria-checked")).toBe("false");

    await submitReady(dialog);
    submitGenerate(dialog);

    // Without consent the run writes nothing at all, and says so in `info`.
    await expectToast("تولید اجرا شد؛ جلسه‌ای نوشته نشد");
    expectNoSuccess();
    expect(generation.generateSessions.mock.calls[0][0]).toMatchObject({ confirmUpdates: false });
    expect(await probeSessions(probe.id)).toEqual([
      expect.objectContaining({ startTime: PROBE_START, endTime: PROBE_END }),
    ]);

    // Consent is the user's own act, and the domain then applies the update.
    const second = await openGeneration();
    pickClass(second, probe);
    await planShown(second);
    fireEvent.click(within(second).getByRole("switch", { name: "به‌روزرسانی جلسات موجود" }));
    await waitFor(() =>
      expect(generation.previewGeneration.mock.calls.at(-1)?.[0]).toMatchObject({ confirmUpdates: true }),
    );
    await submitReady(second);
    submitGenerate(second);

    await expectToast("جلسات تولید شد");
    expect(toastText()).toContain(`${faNum(1)} جلسهٔ موجود به‌روزرسانی شد`);
    expect(successRings()).toBeGreaterThan(0);
    expect(generation.generateSessions.mock.calls.at(-1)?.[0]).toMatchObject({ confirmUpdates: true });
    expect(await probeSessions(probe.id)).toEqual([
      expect.objectContaining({ startTime: PROBE_START, endTime: "08:00" }),
    ]);
  });

  it("reports an orphaned session and never deletes it", async () => {
    const probe = await createProbeClass();
    await getSchedulingRepository().generateSessions({ classId: probe.id, from: WEEK_START, to: WEEK_END });
    expect(await probeSessions(probe.id)).toHaveLength(1);
    // The class moves to another weekday: today's session is still a real session,
    // and the recurrence no longer produces it.
    await getClassRepository().update(probe.id, { days: [OTHER_WEEKDAY] });

    const generation = installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    pickClass(dialog, probe);
    await planShown(dialog);

    expect(dialog.textContent).toContain(`${faNum(1)} ایجاد · ${faNum(0)} به‌روزرسانی`);
    expect(dialog.textContent).toContain("جلسهٔ آینده با تکرار کنونی کلاس نمی‌خواند");
    expect(dialog.textContent).toContain("این جلسات حذف نمی‌شوند؛ تنها گزارش شده‌اند");
    // Reported, not offered for removal: this checkpoint exposes no delete at all.
    expect(within(dialog).queryByRole("button", { name: /حذف/ })).toBeNull();

    await submitReady(dialog);
    submitGenerate(dialog);
    await expectToast("جلسات تولید شد");
    expect(generation.generateSessions).toHaveBeenCalledTimes(1);

    // The new slot was written and the orphan survived it, unchanged.
    const written = await probeSessions(probe.id);
    expect(written).toHaveLength(2);
    expect(written.find((session) => session.date === TODAY)).toMatchObject({
      startTime: PROBE_START,
      status: "scheduled",
    });
    expect(written.find((session) => session.date !== TODAY)).toMatchObject({
      origin: "generated",
      status: "scheduled",
    });
    expect(
      written.every((session) => session.date >= WEEK_START && session.date <= WEEK_END),
      "both rows belong to the requested window",
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Context, and environments with nothing to generate from              */
/* ------------------------------------------------------------------ */

describe("generation context", () => {
  it("follows the calendar's window and never inherits a previous aim", async () => {
    const probe = await createProbeClass();
    const generation = installGeneration();
    renderView();
    await calendarSettled();

    // Day mode: the proposal is the day on screen, not the week.
    fireEvent.click(screen.getByRole("tab", { name: "روز" }));
    await waitFor(() =>
      expect(generation.list.mock.calls.at(-1)?.[0]).toMatchObject({ from: TODAY, to: TODAY }),
    );
    let dialog = await openGeneration();
    expect(dateField(dialog, /^از تاریخ/).value).toBe(jalaliInput(TODAY));
    expect(dateField(dialog, /^تا تاریخ/).value).toBe(jalaliInput(TODAY));

    // A window typed for one opening does not follow into the next.
    fireEvent.change(dateField(dialog, /^تا تاریخ/), { target: { value: jalaliInput(NEXT_WEEK_END) } });
    fireEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "تولید جلسات" })).toBeNull());

    fireEvent.click(screen.getByRole("tab", { name: "هفته" }));
    fireEvent.click(screen.getByRole("button", { name: "هفتهٔ بعد" }));
    await waitFor(() =>
      expect(generation.list.mock.calls.at(-1)?.[0]).toMatchObject({
        from: NEXT_WEEK_START,
        to: NEXT_WEEK_END,
      }),
    );

    dialog = await openGeneration();
    expect(dateField(dialog, /^از تاریخ/).value).toBe(jalaliInput(NEXT_WEEK_START));
    expect(dateField(dialog, /^تا تاریخ/).value).toBe(jalaliInput(NEXT_WEEK_END));
    expect(classSelect(dialog).value, "no class carried over").toBe("");
    expect(submitButton(dialog).disabled, "nothing aimed, nothing written").toBe(true);
    submitGenerate(dialog);
    expect(generation.generateSessions).not.toHaveBeenCalled();

    // And generating from here really writes next week, not the week before it.
    pickClass(dialog, probe);
    await planShown(dialog);
    await submitReady(dialog);
    submitGenerate(dialog);
    await waitFor(() => expect(generation.generateSessions).toHaveBeenCalledTimes(1));
    expect(generation.generateSessions.mock.calls[0][0]).toMatchObject({
      from: NEXT_WEEK_START,
      to: NEXT_WEEK_END,
    });
    await expectToast("جلسات تولید شد");
    const written = await probeSessions(probe.id, NEXT_WEEK_START, NEXT_WEEK_END);
    expect(written).toHaveLength(1);
    expect(written[0].date >= NEXT_WEEK_START && written[0].date <= NEXT_WEEK_END).toBe(true);
    expect(await probeSessions(probe.id, WEEK_START, WEEK_END), "the old window is untouched").toEqual([]);
  });

  it("offers nothing to an environment with no classes, and invents no class list", async () => {
    resetToEmptyEnvironment();
    resetRegistry();
    const generation = installGeneration();
    renderView();

    await waitFor(() => expect(generation.list).toHaveBeenCalled());
    const dialog = await openGeneration();

    expect(await within(dialog).findByText(/کلاسی در این محیط خوانده نشد/)).toBeTruthy();
    expect(within(dialog).queryByLabelText(/^کلاس/, { selector: "select" })).toBeNull();
    expect(dialog.textContent).not.toContain(PROBE_TITLE);
    expect(submitButton(dialog).disabled, "no class, no write").toBe(true);
    submitGenerate(dialog);
    expect(generation.generateSessions).not.toHaveBeenCalled();
    expect(generation.previewGeneration).not.toHaveBeenCalled();
    expect(toastText()).toBe("");
    expectNoSuccess();
  });

  it("offers no generation when the class read failed", async () => {
    const failure = new ApiError({ kind: "network", code: "NETWORK", message: "خواندن کلاس‌ها ناموفق بود." });
    const classes = getClassRepository();
    setClassRepository(
      withStubs(classes, {
        list: async () => {
          throw failure;
        },
      }),
    );
    const generation = installGeneration();
    renderView();

    const dialog = await openGeneration();

    // A failed read is not an empty list: the dialog says the classes could not be
    // read and offers no picker, rather than letting a write aim at nothing (D12).
    expect(await within(dialog).findByText(/فهرست کلاس‌ها خوانده نشد/)).toBeTruthy();
    expect(within(dialog).queryByLabelText(/^کلاس/, { selector: "select" })).toBeNull();
    expect(submitButton(dialog).disabled, "an unread class list cannot be written against").toBe(true);
    submitGenerate(dialog);
    expect(generation.generateSessions).not.toHaveBeenCalled();
    expect(generation.previewGeneration).not.toHaveBeenCalled();
    expectNoSuccess();
  });
});

/* ------------------------------------------------------------------ */
/* The copy claims nothing that did not happen                          */
/* ------------------------------------------------------------------ */

describe("generation copy", () => {
  it("says what the repository did, and nothing it did not", async () => {
    const probe = await createProbeClass();
    installGeneration();
    renderView();
    await calendarSettled();

    const dialog = await openGeneration();
    const surface = dialog.textContent ?? "";
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(surface, `the form promises ${claim}`).not.toContain(claim);
    }
    // What the form does say is the domain's own rule, stated plainly.
    expect(surface).toContain("حضور و غیاب تغییر نمی‌کنند");
    expect(surface).toContain("هیچ جلسه‌ای حذف");
    expect(surface).toContain("اطلاع‌رسانی به مدرس یا هنرجو انجام نمی‌شود");

    pickClass(dialog, probe);
    await planShown(dialog);
    await submitReady(dialog);
    submitGenerate(dialog);
    await expectToast("جلسات تولید شد");

    const announced = toastText();
    expect(announced).toContain(`${faNum(1)} جلسه برای ${PROBE_TITLE}`);
    expect(announced).toContain("چیزی حذف نشد و اطلاع‌رسانی انجام نشد");
    for (const claim of FORBIDDEN_CLAIMS) expect(announced, claim).not.toContain(claim);
    expect(document.body.textContent).not.toContain("تعارض برطرف شد");

    // CP1 and CP2 are still here beside it: the drawer's own writes did not move,
    // and no delete control arrived with generation.
    fireEvent.click(await screen.findByTitle(PROBE_SLOT));
    const drawer = await screen.findByRole("dialog", { name: new RegExp(PROBE_TITLE) });
    expect(within(drawer).getByRole("button", { name: "جابه‌جایی" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "لغو جلسه" })).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: /حذف/ })).toBeNull();
  });
});
