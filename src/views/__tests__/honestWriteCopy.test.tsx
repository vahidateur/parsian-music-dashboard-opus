// @vitest-environment jsdom
/**
 * H3 + H7 — a real write must not be announced as demo data in a customer's own
 * environment.
 *
 * All eight confirmations below sit after a genuine, awaited repository write, so
 * their titles were always true and only the `detail` lied: it read «تغییرات در
 * دادهٔ دمو ذخیره شد» in *every* environment, including EMPTY, where the record
 * belongs to the academy that just signed in. The copy is now derived from the
 * sanctioned environment seam (`useIsDemoEnvironment`, the one `DemoDataPanel`
 * already used for backups and `DemoNote` uses for demo labels), so no surface
 * branches on where data lives — it asks.
 *
 * Five of the eight are the domain surfaces H3 audited in M2 (students, teachers,
 * classes, branding, and the student detail branch). The other three are the
 * Settings panels H7 found afterwards — instruments, repertoire, rooms — which
 * the M2 audit missed because it enumerated views rather than the domain
 * components `Settings.tsx` renders; they landed in M2.1 through the same seam.
 *
 * WHY BOTH DIRECTIONS ARE ASSERTED
 *
 * "EMPTY must not say demo" on its own would also pass if someone deleted the
 * demo label outright. In a demo environment that label is exactly right: the
 * showcase must keep telling visitors that what they are editing is demo data.
 * Each case therefore pins the copy for the environment it runs in.
 *
 * The views are rendered next to the real `<Toasts/>` region rather than inside
 * the whole app shell: the toast is the thing under test, `App.tsx` mounts the
 * region at the shell level, and keeping these cases at view level is what puts
 * the assertion next to the copy it constrains.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import { ClassesView } from "@/views/Classes";
import { StudentsView } from "@/views/Students";
import { TeachersView } from "@/views/Teachers";
// H7: the three Settings panels that carried the identical hardcoded label.
import { InstrumentsPanel } from "@/domains/instruments/InstrumentsPanel";
import { RepertoirePanel } from "@/domains/progress/RepertoirePanel";
import { RoomsPanel } from "@/domains/rooms/RoomsPanel";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import {
  getInstrumentRepository,
  getProgressRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
} from "@/domains/registry";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";

/** The confirmation for a saved record, per environment. */
const DEMO_DETAIL = "تغییرات در دادهٔ دمو ذخیره شد.";
const OWN_DETAIL = "تغییرات در داده‌ها ذخیره شد.";
/** Branding's save uses its own verb, so its two shapes are separate literals. */
const DEMO_BRANDING_DETAIL = "تغییرات در دادهٔ دمو ثبت شد.";
const OWN_BRANDING_DETAIL = "تغییرات در داده‌ها ثبت شد.";

/**
 * These cases drive a whole flow — seed, render a data-backed view, fill a form,
 * await the write, read the toast — and this suite runs alongside ninety-odd
 * others, which is exactly the contention the shared harness in
 * `emptyEnvironment.test.tsx` documents. The budget is generous and a timeout is
 * still a hard failure, never a hidden one.
 */
const FLOW_TIMEOUT = 20_000;

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

function renderWithToasts(node: React.ReactNode) {
  return render(
    <AuthProvider>
      <AppProvider>
        {node}
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

/**
 * Waits for the view's own data to arrive before anything is clicked.
 *
 * Queried by ROLE only, on the design system's in-flight marker (`BreathingWave`
 * inside `LoadingState`), for the reason the shared harness gives: waiting for a
 * view title passes while the body still shows «در حال بارگذاری», and every
 * interaction after that measures a placeholder.
 */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
}

/** The toast region: `Toasts` marks it `aria-live="polite"` (ActionSheet.tsx). */
function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/** Waits for the confirmation and asserts the environment-correct detail. */
async function expectSavedDetail(detail: string) {
  await waitFor(() => expect(toastText()).toContain(detail), { timeout: 8000 });
  // The complementary shape must not appear alongside it: a toast that hedged
  // both ways would satisfy `toContain` while still mislabelling the record.
  const other = detail === DEMO_DETAIL || detail === DEMO_BRANDING_DETAIL ? OWN_DETAIL : DEMO_DETAIL;
  expect(toastText()).not.toContain(other);
}

/** The dialog's own submit button — the view behind it can carry the same label. */
function dialogButton(name: string | RegExp) {
  return within(screen.getByRole("dialog")).getByRole("button", { name });
}

/** Waits for an async-populated <select> to hold a real option, then picks it. */
async function pickOption(label: RegExp) {
  // `selector` disambiguates from the required-marker text and the dialog title.
  const select = await screen.findByLabelText(label, { selector: "select" });
  await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
  const option = (within(select).getAllByRole("option") as HTMLOptionElement[]).find((o) => o.value !== "");
  expect(option, `no usable option under ${String(label)}`).toBeDefined();
  fireEvent.change(select, { target: { value: option!.value } });
}

/**
 * The records an EMPTY academy needs before these forms can save at all: a
 * student needs a teacher, and a class needs a teacher and a room. Seeded
 * through the real repositories — a write, not a fixture import — so the
 * environment stays honestly EMPTY apart from what the case itself creates.
 */
async function seedEmptyPrerequisites({ room = false } = {}) {
  await getInstrumentRepository().create({
    slug: "piano",
    name: "پیانو",
    description: "ساز کلاویه‌دار",
    active: true,
  });
  const teacher = await getTeacherRepository().create({
    name: "مدرس اولیه",
    instrument: "piano",
    title: "مدرس پیانو",
    phone: "09121110000",
    status: "active",
    contractHours: 20,
    bio: "",
    students: 0,
    utilization: 0,
    weeklyHours: 0,
    attendanceRate: 100,
    retention: 100,
    since: "امسال",
  });
  if (room) await getRoomRepository().create({ name: "اتاق ۱", kind: "تمرین", capacity: 6 });
  return teacher;
}

/* ------------------------------------------------------------------ */
/* Branding — its save handler is already the model pattern (§37)      */
/* ------------------------------------------------------------------ */
describe("branding save copy", () => {
  async function saveBranding() {
    renderWithToasts(<BrandingPanel />);
    await settled();
    const name = (await screen.findByLabelText(/نام آموزشگاه/)) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "آموزشگاه موسیقی پارس" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
  }

  it(
    "in EMPTY names the academy's own data, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await saveBranding();
      await expectSavedDetail(OWN_BRANDING_DETAIL);
      expect(toastText()).not.toContain("دمو");
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await saveBranding();
      await expectSavedDetail(DEMO_BRANDING_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

/* ------------------------------------------------------------------ */
/* Teachers                                                            */
/* ------------------------------------------------------------------ */
describe("teacher save copy", () => {
  async function createTeacher() {
    renderWithToasts(<TeachersView />);
    await settled();
    // The header action and the dialog submit share a label; the header opens.
    fireEvent.click(screen.getAllByRole("button", { name: /افزودن مدرس/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام و نام خانوادگی/), {
      target: { value: "مدرس تأیید شده" },
    });
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "مدرس پیانو" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09129990001" } });
    fireEvent.change(screen.getByLabelText(/ساعت قرارداد/), { target: { value: "20" } });
    fireEvent.click(dialogButton("افزودن مدرس"));
  }

  it(
    "in EMPTY names the academy's own data, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await seedEmptyPrerequisites();
      await createTeacher();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
      // The write is real, which is what makes the copy a claim worth testing.
      const page = await getTeacherRepository().list({ per_page: 200 });
      expect(page.data.some((t) => t.name === "مدرس تأیید شده")).toBe(true);
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createTeacher();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */
describe("class save copy", () => {
  async function createClass() {
    renderWithToasts(<ClassesView />);
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /کلاس جدید/ })[0]);
    fireEvent.change(await screen.findByLabelText(/عنوان کلاس/), { target: { value: "کلاس تأیید شده" } });
    await pickOption(/مدرس/);
    await pickOption(/اتاق/);
    fireEvent.click(dialogButton("شنبه"));
    fireEvent.click(dialogButton("افزودن کلاس"));
  }

  it(
    "in EMPTY names the academy's own data, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await seedEmptyPrerequisites({ room: true });
      await createClass();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createClass();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

/* ------------------------------------------------------------------ */
/* Students — one confirmation shared by both places the dialog mounts  */
/* ------------------------------------------------------------------ */
describe("student save copy", () => {
  /** The list branch: create from `#/students`. */
  async function createStudent() {
    renderWithToasts(<StudentsView />);
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /افزودن هنرجو/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام و نام خانوادگی/), {
      target: { value: "هنرجوی تأیید شده" },
    });
    fireEvent.change(screen.getByLabelText(/کد ملی/), { target: { value: "2000535658" } });
    fireEvent.change(screen.getByLabelText(/سن/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09120000000" } });
    await pickOption(/مدرس/);
    fireEvent.click(dialogButton("افزودن هنرجو"));
  }

  it(
    "in EMPTY names the academy's own data, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await seedEmptyPrerequisites();
      await createStudent();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
      const page = await getStudentRepository().list({ per_page: 200 });
      expect(page.data.some((s) => s.name === "هنرجوی تأیید شده")).toBe(true);
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createStudent();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );

  /**
   * The detail branch mounts a second copy of the same dialog. Both now share
   * one confirmation, and this is the case that would fail if the duplication
   * came back and only one of the two was updated.
   */
  /**
   * Opens a student's profile and saves an edit from the dialog mounted there.
   *
   * The form is filled in full. That was a *workaround* while the edit dialog
   * opened with an empty draft (H6): each value simply overwrote a blank one. H6
   * is fixed — the draft is rebuilt from the record whenever the dialog opens —
   * so these fields now overwrite prefilled ones with the same values, and the
   * case reads as what it always should have: an edit that changes the national
   * ID and touches nothing else.
   *
   * The national ID differs per case and is checksum-valid, so the update cannot
   * collide with the record the create cases make.
   */
  async function editStudentFromDetail(nationalId: string) {
    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    expect(student, "the case needs one student to open").toBeDefined();
    window.location.hash = `#/students/${student.id}`;
    renderWithToasts(<StudentsView />);
    await settled();
    fireEvent.click(await screen.findByRole("button", { name: /ویرایش/ }));
    fireEvent.change(await screen.findByLabelText(/نام و نام خانوادگی/), {
      target: { value: student.name },
    });
    fireEvent.change(screen.getByLabelText(/کد ملی/), { target: { value: nationalId } });
    fireEvent.change(screen.getByLabelText(/سن/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09129990002" } });
    await pickOption(/مدرس/);
    fireEvent.click(dialogButton("ذخیرهٔ تغییرات"));
  }

  it(
    "in EMPTY the detail branch agrees with the list branch",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      const teacher = await seedEmptyPrerequisites();
      await getStudentRepository().create({
        nationalId: "2000535658",
        name: "هنرجوی پرونده",
        instrument: "piano",
        teacherId: teacher.id,
        level: "سطح ۱",
        levelStep: 1,
        status: "active",
        payment: "paid",
        sessionsUsed: 0,
        sessionsTotal: 12,
        attendance: 100,
        progress: 0,
        since: "امروز",
        age: 22,
        phone: "۰۹۱۲۰۰۰۱۱۱۱",
        lastSeen: "امروز",
        balance: 0,
      });
      await editStudentFromDetail("2000535666");
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO the detail branch keeps the demo label",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await editStudentFromDetail("2000535674");
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

/* ------------------------------------------------------------------ */
/* H7 — the three Settings panels M2's audit missed                    */
/* ------------------------------------------------------------------ */
/*
  Same defect, same seam, same two-directional proof as above. These are domain
  components rendered by `Settings.tsx` rather than views with a route of their
  own, which is why the M2 audit — which enumerated the domain views plus
  branding — did not reach them. Each is rendered on its own here, which is also
  how `emptyEnvironmentPanels.test.tsx` renders them; that file carries the EMPTY
  "no demo artefacts at all" sweep, and this one carries the copy.

  All three create rather than edit, because the confirmation is shared by both
  modes and a create needs no pre-existing record: in EMPTY there is nothing to
  open. Each case also reads the record back, so the wording is asserted about a
  write that demonstrably happened.
*/
describe("instrument panel save copy", () => {
  async function createInstrument() {
    renderWithToasts(<InstrumentsPanel />);
    await settled();
    // The panel action and the dialog submit share a label; the panel's comes
    // first, and in EMPTY it is the empty state's action.
    fireEvent.click(screen.getAllByRole("button", { name: /افزودن ساز/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "سه‌تار" } });
    fireEvent.change(screen.getByLabelText(/شناسه/, { selector: "input" }), { target: { value: "setar" } });
    fireEvent.click(dialogButton("افزودن ساز"));
  }

  it(
    "in EMPTY names the academy's own catalogue, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await createInstrument();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
      const page = await getInstrumentRepository().list({ per_page: 200 });
      expect(page.data.some((instrument) => instrument.slug === "setar")).toBe(true);
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createInstrument();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

describe("room panel save copy", () => {
  async function createRoom() {
    renderWithToasts(<RoomsPanel />);
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /افزودن اتاق/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام اتاق/), { target: { value: "اتاق تمرین ۲" } });
    fireEvent.click(dialogButton("افزودن اتاق"));
  }

  it(
    "in EMPTY names the academy's own rooms, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      await createRoom();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
      const page = await getRoomRepository().list({ per_page: 200 });
      expect(page.data.some((room) => room.name === "اتاق تمرین ۲")).toBe(true);
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createRoom();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});

describe("repertoire panel save copy", () => {
  async function createPiece() {
    renderWithToasts(<RepertoirePanel />);
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /افزودن قطعه/ })[0]);
    fireEvent.change(await screen.findByLabelText(/عنوان/), { target: { value: "قطعهٔ تأیید شده" } });
    // A piece must belong to an instrument, and the picker starts on its
    // «— انتخاب کنید —» placeholder. Anchored: «آهنگساز» also contains «ساز».
    await pickOption(/^ساز/);
    fireEvent.click(dialogButton("افزودن قطعه"));
  }

  it(
    "in EMPTY names the academy's own repertoire, never demo data",
    async () => {
      resetToEmptyEnvironment();
      resetRegistry();
      // EMPTY holds no instruments, so the piece form would have nothing to
      // select: seeded through the real repository, as the other cases do.
      await seedEmptyPrerequisites();
      await createPiece();
      await expectSavedDetail(OWN_DETAIL);
      expect(toastText()).not.toContain("دمو");
      const page = await getProgressRepository().listPieces({ per_page: 200 });
      expect(page.data.some((piece) => piece.title === "قطعهٔ تأیید شده")).toBe(true);
    },
    FLOW_TIMEOUT,
  );

  it(
    "in DEMO still says plainly that the data is demo data",
    async () => {
      resetToDemoEnvironment();
      resetRegistry();
      await createPiece();
      await expectSavedDetail(DEMO_DETAIL);
    },
    FLOW_TIMEOUT,
  );
});
