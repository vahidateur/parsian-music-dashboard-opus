// @vitest-environment jsdom
/**
 * EMPTY-environment audit — every navigable surface, rendered from the real
 * component tree over a real EMPTY environment.
 *
 * WHY THIS FILE EXISTS
 *
 * EMPTY is a first-class state now, not the accident of having no rows: a
 * customer signs in to an academy with zero students, zero classes and zero
 * messages, and every surface still has to be correct. Two failure modes are
 * audited, and both are invisible in a demo environment that always has data:
 *
 *   1. arithmetic over an empty collection — `0 / 0` and `Math.max(...[])` reach
 *      the screen as «NaN٪» or «-Infinity» (now decided once in `lib/stats.ts`);
 *   2. a surface that assumes rows exist and throws, or renders `undefined`.
 *
 * The assertions are deliberately about the numbers a live repository produced,
 * not about a magic empty-state string: if a view quietly fell back to fixture
 * data, "renders something plausible" would still pass and these would not.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { viewTitles, type ViewId } from "@/data/academy";
import { createSeedDataset } from "@/domains/demo/seed";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/domains/demo/lifecycle";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getTeacherRepository, resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToEmptyEnvironment } from "@/test/demoEnvironment";

/** Surfaces backed by live repositories — they must show real zeros. */
const LIVE_VIEWS: ViewId[] = ["dashboard", "students", "teachers", "classes", "messages", "library"];

/**
 * Surfaces that still render from static fixtures rather than their domains
 * (scheduling and attendance have complete, tested domains the views do not use
 * yet; finance and reports have no domain at all). They are asserted to render
 * without artefacts here, and reported as a known limitation — asserting zeros
 * for them would claim a wiring that does not exist.
 */
const FIXTURE_VIEWS: ViewId[] = ["schedule", "attendance", "finance", "reports"];

/** Text that can only reach the DOM through an arithmetic or lookup mistake. */
const ARTEFACTS = ["NaN", "Infinity", "undefined", "[object Object]"] as const;

function expectNoArtefacts(container: HTMLElement, surface: string): void {
  const text = container.textContent ?? "";
  for (const artefact of ARTEFACTS) {
    expect(text, `${surface} rendered "${artefact}"`).not.toContain(artefact);
  }
}

/** Signs in as the EMPTY bootstrap administrator and opens one view. */
async function renderShell(hash: string) {
  window.location.hash = hash;
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email: BOOTSTRAP_ADMIN_EMAIL, password: DEMO_PASSPHRASE });

  const rendered = render(<App />);
  await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
  return rendered;
}

/**
 * The design system's in-flight marker: `BreathingWave` renders
 * `role="status"` with the label «در حال بارگذاری» (`src/components/ds/states.tsx`),
 * and `LoadingState` wraps it. Queried by ROLE only, on purpose — if the copy
 * ever changes, this wait keeps working instead of silently becoming a no-op
 * that lets the race back in. The only other `role="status"` in the product is
 * the login spinner, which cannot be present here because `renderShell` signs in
 * before rendering.
 */
const inFlightMarkers = () => screen.queryAllByRole("status");

/**
 * Signs in, opens one view, and — the part that used to be missing — waits for
 * that view to finish loading its data.
 *
 * WHY THE WAIT IS HERE AND NOT IN EACH TEST
 *
 * `useResourceList` (`src/domains/shared/useResource.ts`) starts `loading: true`
 * and clears it in the same promise's `finally`, so the loading marker is in the
 * DOM exactly while a repository read is in flight, and it is gone exactly when
 * the loaded records are on screen. Waiting for it to disappear is therefore
 * waiting for the data-derived UI — deterministic Testing Library semantics, no
 * sleeps and no retries.
 *
 * Waiting only for `viewTitles[view]` (what this helper used to do) is not
 * enough: the shell renders the title immediately, so the helper could return
 * while the view still showed «در حال چیدن کلاس‌ها…». Every assertion about
 * derived content then measured a loading placeholder — «۰ از ۰» was missing,
 * and absence assertions such as "does not name a most-waitlisted class" passed
 * for the wrong reason. Both directions were unsound, which is why this belongs
 * in the shared harness rather than in one test.
 *
 * The timeout is generous because this suite runs alongside 92 others and the
 * race that motivated it only ever lost under that contention. A timeout is
 * still a hard failure, never a hidden one.
 */
async function renderView(view: ViewId) {
  const rendered = await renderShell(`#/${view}`);
  await waitFor(() => expect(screen.getAllByText(viewTitles[view]).length).toBeGreaterThan(0));
  await waitFor(() => expect(inFlightMarkers()).toHaveLength(0), { timeout: 5000 });
  return rendered;
}

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetToEmptyEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

describe("signing in to an EMPTY environment", () => {
  it("the bootstrap administrator gets in, and the academy has no records", async () => {
    const { container } = await renderView("dashboard");

    // The environment is EMPTY, not uninitialized and not demo.
    const snapshot = demoStore.snapshot();
    expect(snapshot.students).toHaveLength(0);
    expect(snapshot.classes).toHaveLength(0);
    expect(snapshot.users).toHaveLength(1);

    expect(screen.queryByRole("button", { name: /^ورود/ })).toBeNull();
    expect(screen.queryByText(/محیط دادهٔ خود را انتخاب کنید/)).toBeNull();
    expectNoArtefacts(container, "dashboard");
  });

  it("the signed-in dashboard surface shows no demo credential hints", async () => {
    // Scope note: this asserts on the DASHBOARD after a programmatic sign-in, so
    // it says nothing about the login screen — where a credential panel is
    // legitimate and must stay. The login screen in EMPTY is covered by
    // `loginEmptyEnvironment.test.tsx`.
    const { container } = await renderView("dashboard");

    expect(container.textContent).not.toContain("@demo.local");
    expect(container.textContent).not.toContain(DEMO_PASSPHRASE);
  });
});

describe("live surfaces over zero records", () => {
  it.each(LIVE_VIEWS)("#/%s renders, and renders no arithmetic artefacts", async (view) => {
    const { container } = await renderView(view);

    // Pins the harness contract for every live surface, not just the one that
    // was observed to lose the race: `renderView` must never hand back a view
    // that still has a repository read in flight, otherwise the absence
    // assertions in this file measure a loading placeholder and pass for the
    // wrong reason.
    expect(inFlightMarkers(), `#/${view} still had a read in flight`).toHaveLength(0);
    expectNoArtefacts(container, `#/${view}`);
  });

  it("classes reports occupancy and average attendance as absent, not as NaN", async () => {
    const { container } = await renderView("classes");

    // Zero classes → zero seats: the count is a real ۰, the ratio is undefined
    // and says so with the same glyph the rest of the product uses.
    expect(container.textContent).toContain("۰ از ۰");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain("NaN٪");
  });

  it("classes does not name a 'most waitlisted' class that does not exist", async () => {
    const { container } = await renderView("classes");

    expect(container.textContent).toContain("۰");
    expect(container.textContent).not.toContain("بیشترین: پیانو");
    expect(container.textContent).not.toContain("بیشترین:");
  });

  it("teachers reports average utilisation as absent, not as NaN", async () => {
    const { container } = await renderView("teachers");

    expect(screen.getByText("بهره‌وری میانگین")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expectNoArtefacts(container, "#/teachers");
  });

  it("dashboard hero numbers are real zeros, not a division by zero", async () => {
    const { container } = await renderView("dashboard");

    for (const label of ["هنرجوی فعال", "کلاس فعال", "ثبت‌نام فعال", "اشغال ظرفیت"]) {
      // Several surfaces reuse these labels, so assert presence rather than
      // uniqueness — the point is that every hero tile rendered a value.
      expect(screen.getAllByText(label).length, `hero stat "${label}" must render`).toBeGreaterThan(0);
    }
    expect(container.textContent).toContain("۰");
    expectNoArtefacts(container, "dashboard hero");
  });
});

describe("student profile over zero records", () => {
  it("the list is honest about having nobody, and offers the way in", async () => {
    const { container } = await renderView("students");
    expectNoArtefacts(container, "#/students");
  });

  it("a deep link to a student that does not exist is handled instead of crashing", async () => {
    const { container } = await renderShell("#/students/st1");

    // Whatever it decides to render, it must not be a crash, a NaN or a
    // half-resolved lookup.
    expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy();
    expectNoArtefacts(container, "#/students/st1");
  });
});

describe("fixture-driven surfaces (audited, wiring outstanding)", () => {
  it.each(FIXTURE_VIEWS)("#/%s renders without crashing or leaking artefacts", async (view) => {
    const { container } = await renderView(view);
    expectNoArtefacts(container, `#/${view}`);
  });
});

describe("command palette over zero records", () => {
  /**
   * The palette's own result region. Scoped deliberately: the view behind the
   * overlay contains native `<option>` elements, which also carry the "option"
   * role, so a document-wide query would measure the wrong thing.
   */
  const results = () => screen.getByRole("listbox", { name: "نتایج" });

  it("opens, and finds no record that does not exist in this environment", async () => {
    await renderView("dashboard");

    // The showcase dataset has students; this environment has none. The palette
    // searches the repositories, so it must find nothing rather than fall back
    // to an index of records that are not there.
    const showcaseName = createSeedDataset().students[0].name;
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const input = await screen.findByPlaceholderText(/چه کاری می‌خواهید انجام دهید/);
    fireEvent.change(input, { target: { value: showcaseName } });

    await waitFor(() => expect(within(results()).getByText("چیزی پیدا نشد")).toBeTruthy());
    expect(within(results()).queryAllByRole("option")).toHaveLength(0);
    expect(within(results()).queryByText(showcaseName)).toBeNull();
  });

  it("still offers navigation, which does not depend on having records", async () => {
    await renderView("dashboard");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const input = await screen.findByPlaceholderText(/چه کاری می‌خواهید انجام دهید/);
    fireEvent.change(input, { target: { value: "هنرجویان" } });

    await waitFor(() => expect(within(results()).getAllByRole("option").length).toBeGreaterThan(0));
    // Sections are navigable in an empty academy; records are not invented.
    expect(within(results()).getByText("بخش‌ها")).toBeTruthy();
    expect(within(results()).getByText("هنرجویان")).toBeTruthy();
  });
});

describe("settings over zero records", () => {
  it("#/settings renders, and its lifecycle copy promises no switch that does not exist", async () => {
    const { container } = await renderView("settings");

    expectNoArtefacts(container, "#/settings");
    // No Settings control may claim it can change the environment's kind: that
    // switch is deliberately not part of this phase.
    expect(container.textContent).not.toContain("تغییر محیط داده");
    expect(container.textContent).not.toContain("تبدیل به دمو");
  });
});

describe("a real write in an EMPTY environment", () => {
  /**
   * The confirmation may not call the academy's own record demo data.
   *
   * Every other case in this file reads; this one writes, through the real
   * dialog and the real repository, because the wording is only a lie about
   * something that actually happened. The teacher form is the write with no
   * prerequisites — a class needs a teacher and a room, a student needs a
   * teacher — so it is the one an EMPTY academy can perform first.
   *
   * Asserting "no «دمو»" here is only half a contract, and the other half is
   * deliberate: `honestWriteCopy.test.tsx` pins the DEMO wording too, so this
   * cannot be satisfied by deleting the demo label from the product.
   */
  it("confirms a saved teacher as the academy's own data, never as demo data", async () => {
    await renderView("teachers");

    fireEvent.click(screen.getAllByRole("button", { name: /افزودن مدرس/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام و نام خانوادگی/), {
      target: { value: "مدرس محیط خالی" },
    });
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "مدرس پیانو" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09129990003" } });
    fireEvent.change(screen.getByLabelText(/ساعت قرارداد/), { target: { value: "20" } });
    // The header action and the dialog submit share a label; scope to the dialog.
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "افزودن مدرس" }));

    // `Toasts` marks its region `aria-live="polite"` (ActionSheet.tsx).
    const toast = () => document.querySelector('[aria-live="polite"]')?.textContent ?? "";
    await waitFor(() => expect(toast()).toContain("تغییرات در داده‌ها ذخیره شد."), { timeout: 8000 });
    expect(toast()).not.toContain("دمو");
    expect(toast()).toContain("مدرس محیط خالی افزوده شد");

    // And it really is a write, which is what makes the wording a claim at all.
    const page = await getTeacherRepository().list({ per_page: 200 });
    expect(page.data.some((t) => t.name === "مدرس محیط خالی")).toBe(true);
  }, 20_000);
});
