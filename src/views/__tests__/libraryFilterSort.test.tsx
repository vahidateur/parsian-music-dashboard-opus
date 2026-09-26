// @vitest-environment jsdom
/**
 * Library view — sort, level filter and visibility filter (F1 audit G-1…G-3).
 *
 * WHY THIS FILE EXISTS. The F1 audit of `main@4edd0bc` found that `Library.tsx`
 * already implements three sort orders (جدیدترین / پراستفاده / عنوان), a level
 * filter built from live data, and a visibility filter (هنرجویان / مدرسین) — but
 * no test clicked any of those controls. They could break silently. These
 * cases pin the behaviour at the boundary the user touches: the order and
 * membership of cards in the catalogue grid.
 *
 * ISOLATION. Each case removes the seeded catalogue rows first and creates its
 * own rows through the repository, so the assertions depend only on data the
 * case controls. Values the create input does not carry (`uses`, `createdAt`)
 * are written onto the persisted record before the view mounts.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getLibraryRepository, resetRegistry } from "@/domains/registry";
import type { CreateLibraryItemInput } from "@/domains/library/types";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const LOADING = "در حال باز کردن کتابخانه…";
/** Every title this file creates starts with this marker. */
const MARK = "آزمون‌فیلتر";

function renderLibrary(): HTMLElement {
  return render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  ).container;
}

async function waitForCatalogue() {
  await waitFor(() => expect(screen.queryByText(LOADING)).toBeNull());
}

function catalogueGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector("div.stagger.grid");
  if (!grid) throw new Error("catalogue grid not rendered");
  return grid as HTMLElement;
}

/** Titles of this file's rows, in the order the grid renders them. */
function gridTitles(container: HTMLElement): string[] {
  const grid = catalogueGrid(container);
  // The title node is the card's first line (`div.font-semibold`); reading it
  // alone avoids the adjacent kind/instrument labels, which textContent would
  // run straight into the title with no separator.
  return Array.from(grid.querySelectorAll(":scope > button"))
    .map((card) => card.querySelector("div.font-semibold")?.textContent?.trim())
    .filter((t): t is string => t !== undefined && t.startsWith(MARK));
}

function removeSeededCatalogue() {
  for (const row of demoStore.resources.all()) demoStore.resources.remove(row.id);
}

interface Seed extends Partial<CreateLibraryItemInput> {
  suffix: string;
  uses?: number;
  createdAt?: string;
  /**
   * Persist the row WITHOUT a visibility field, as the seeded catalogue rows
   * are stored. `create` always stamps `visibility: "students"`, so a row made
   * through the repository never reaches the view's `?? "students"` fallback.
   */
  noVisibility?: boolean;
}

/** Creates rows through the repository, then sets the fields create does not accept. */
async function seed(rows: Seed[]) {
  for (const { suffix, uses, createdAt, noVisibility, ...input } of rows) {
    const created = await getLibraryRepository().create({
      title: `${MARK} ${suffix}`,
      kind: "sheet",
      instrument: "guitar",
      ...input,
    });
    const patch: Record<string, unknown> = {};
    if (uses !== undefined) patch.uses = uses;
    if (createdAt !== undefined) patch.createdAt = createdAt;
    if (noVisibility) patch.visibility = undefined;
    if (Object.keys(patch).length > 0) {
      demoStore.resources.update(created.id, patch as Parameters<typeof demoStore.resources.update>[1]);
    }
  }
}

/*
  `FilterBar` renders its `trailing` slot twice — a desktop copy (`hidden md:flex`)
  and a mobile copy (`md:hidden`) — and jsdom applies no CSS, so both copies of
  the sort control are in the DOM. Both are driven by the same `sort` state:
  clicks go to the first copy, and selection is asserted on EVERY copy so the
  two can never drift apart unnoticed.
*/
function sortTab(label: string): HTMLElement {
  return screen.getAllByRole("tab", { name: label })[0]!;
}

async function selectSort(label: string) {
  fireEvent.click(sortTab(label));
  await waitFor(() => expectSelected(label));
}

function expectSelected(label: string) {
  const copies = screen.getAllByRole("tab", { name: label });
  expect(copies.length).toBeGreaterThan(0);
  for (const tab of copies) expect(tab.getAttribute("aria-selected")).toBe("true");
}

function chip(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  removeSeededCatalogue();
  URL.createObjectURL = vi.fn(() => "blob:parsian/test") as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* G-1 — sort                                                           */
/* ------------------------------------------------------------------ */
describe("sorting the catalogue (G-1)", () => {
  beforeEach(async () => {
    await seed([
      { suffix: "ب", uses: 1, createdAt: "2026-03-01T10:00:00.000Z" },
      { suffix: "ج", uses: 9, createdAt: "2026-01-01T10:00:00.000Z" },
      { suffix: "الف", uses: 5, createdAt: "2026-02-01T10:00:00.000Z" },
    ]);
  });

  it("offers exactly the three sort orders, with جدیدترین selected by default", async () => {
    renderLibrary();
    await waitForCatalogue();
    const lists = screen.getAllByRole("tablist");
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(within(list).getAllByRole("tab").map((t) => t.textContent)).toEqual(["جدیدترین", "پراستفاده", "عنوان"]);
    }
    expectSelected("جدیدترین");
  });

  it("جدیدترین orders by createdAt, newest first", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    expect(gridTitles(container)).toEqual([`${MARK} ب`, `${MARK} الف`, `${MARK} ج`]);
  });

  it("پراستفاده orders by uses, most used first", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    await selectSort("پراستفاده");
    expect(gridTitles(container)).toEqual([`${MARK} ج`, `${MARK} الف`, `${MARK} ب`]);
  });

  it("عنوان orders by title in Persian collation", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    await selectSort("عنوان");
    expect(gridTitles(container)).toEqual([`${MARK} الف`, `${MARK} ب`, `${MARK} ج`]);
  });

  it("returning to جدیدترین restores the createdAt order", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    await selectSort("عنوان");
    await selectSort("جدیدترین");
    expect(gridTitles(container)).toEqual([`${MARK} ب`, `${MARK} الف`, `${MARK} ج`]);
  });

  it("sorting reorders cards without dropping or duplicating any", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    for (const label of ["پراستفاده", "عنوان", "جدیدترین"]) {
      await selectSort(label);
      expect([...gridTitles(container)].sort()).toEqual([`${MARK} ب`, `${MARK} ج`, `${MARK} الف`].sort());
    }
  });
});

/* ------------------------------------------------------------------ */
/* G-2 — level filter                                                   */
/* ------------------------------------------------------------------ */
describe("filtering by level (G-2)", () => {
  const LEVEL_A = "مقدماتی";
  const LEVEL_B = "پیشرفته";

  beforeEach(async () => {
    await seed([
      { suffix: "یک", level: LEVEL_A },
      { suffix: "دو", level: LEVEL_B },
      { suffix: "سه", level: LEVEL_A },
    ]);
  });

  it("builds one level chip per distinct level in the loaded rows", async () => {
    renderLibrary();
    await waitForCatalogue();
    expect(chip(LEVEL_A)).toBeDefined();
    expect(chip(LEVEL_B)).toBeDefined();
    expect(screen.getAllByRole("button", { name: LEVEL_A })).toHaveLength(1);
  });

  it("narrows the grid to the chosen level", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip(LEVEL_A));
    await waitFor(() => expect(chip(LEVEL_A).getAttribute("aria-pressed")).toBe("true"));
    expect([...gridTitles(container)].sort()).toEqual([`${MARK} سه`, `${MARK} یک`].sort());
  });

  it("switching level replaces the filter instead of stacking it", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip(LEVEL_A));
    fireEvent.click(chip(LEVEL_B));
    await waitFor(() => expect(gridTitles(container)).toEqual([`${MARK} دو`]));
    expect(chip(LEVEL_A).getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the active level chip again clears the filter", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip(LEVEL_B));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(1));
    fireEvent.click(chip(LEVEL_B));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(3));
  });
});

/* ------------------------------------------------------------------ */
/* G-3 — visibility filter                                              */
/* ------------------------------------------------------------------ */
describe("filtering by visibility (G-3)", () => {
  beforeEach(async () => {
    await seed([
      { suffix: "هنرجو", visibility: "students" },
      { suffix: "مدرس", visibility: "teachers" },
      // Stored with no visibility field (like seeded rows): the view treats it as students-visible.
      { suffix: "پیش‌فرض", noVisibility: true },
    ]);
  });

  it("مدرسین shows only teacher-facing rows", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip("مدرسین"));
    await waitFor(() => expect(gridTitles(container)).toEqual([`${MARK} مدرس`]));
    expect(chip("مدرسین").getAttribute("aria-pressed")).toBe("true");
  });

  it("هنرجویان shows student rows, including rows with no explicit visibility", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip("هنرجویان"));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(2));
    expect([...gridTitles(container)].sort()).toEqual([`${MARK} هنرجو`, `${MARK} پیش‌فرض`].sort());
  });

  it("clicking the active visibility chip again clears the filter", async () => {
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip("مدرسین"));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(1));
    fireEvent.click(chip("مدرسین"));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(3));
  });

  it("the همه chip clears level and visibility filters together", async () => {
    await seed([{ suffix: "سطح‌دار", level: "میانی", visibility: "teachers" }]);
    const container = renderLibrary();
    await waitForCatalogue();
    fireEvent.click(chip("مدرسین"));
    fireEvent.click(chip("میانی"));
    await waitFor(() => expect(gridTitles(container)).toEqual([`${MARK} سطح‌دار`]));
    fireEvent.click(screen.getByRole("button", { name: /^همه/ }));
    await waitFor(() => expect(gridTitles(container)).toHaveLength(4));
    expect(chip("مدرسین").getAttribute("aria-pressed")).toBe("false");
    expect(chip("میانی").getAttribute("aria-pressed")).toBe("false");
  });
});
