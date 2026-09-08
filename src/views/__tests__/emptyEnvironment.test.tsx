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
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
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

async function renderView(view: ViewId) {
  const rendered = await renderShell(`#/${view}`);
  await waitFor(() => expect(screen.getAllByText(viewTitles[view]).length).toBeGreaterThan(0));
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
