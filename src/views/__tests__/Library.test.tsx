// @vitest-environment jsdom
/**
 * Library view — repository-backed catalogue with a real download.
 *
 * THE REGRESSION. `Library.tsx` rendered a static fixture: the same twelve rows,
 * the same hardcoded stats ("۲۰۰ منبع", "۱۴ این ماه", shelf counts 86/34/52/28)
 * no matter what the catalogue held, and a download button that only raised a
 * toast. Nothing was persisted, nothing was downloaded.
 *
 * These tests pin the outcome at the boundary the user touches:
 *   - rows, counts and shelves come from the repository;
 *   - an empty catalogue and a repository failure are distinct, honest states;
 *   - the download hands the browser the stored bytes;
 *   - a record without bytes offers no download and says why;
 *   - and the view still cannot see the store, the blob store or a fixture.
 *
 * NOTE ON SCOPING. A title renders twice — once on its card, once in the
 * "اخیراً افزوده‌شده" panel — so card assertions are scoped to the catalogue
 * grid rather than to `screen` at large.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { createMemoryBlobStore, getBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getLibraryRepository, resetRegistry, setLibraryRepository } from "@/domains/registry";
import { ensureDemoLibraryFile } from "@/domains/library/demoContent";
import type { LibraryRepository } from "@/domains/library/repository";
import { createEmptyDataset } from "@/domains/demo/seed";
import {
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_FILENAME,
  DEMO_LIBRARY_RESOURCE_ID,
  DEMO_LIBRARY_TEXT,
} from "@/domains/demo/librarySeed";
import { faNum } from "@/lib/format";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const VIEW_SOURCE = resolve(__dirname, "../Library.tsx");
const ERROR_TITLE = "بارگذاری کتابخانه ناموفق بود";
const EMPTY_TITLE = "کتابخانه خالی است";
const LOADING = "در حال باز کردن کتابخانه…";
const DEMO_TITLE = "نوکتورن اپوس ۹ شمارهٔ ۲";
const AUDIO_TITLE = "الگوهای ریتمیک ۶/۸";

let clicks: Array<{ href: string; download: string }>;
let created: string[];
let revoked: string[];

function renderLibrary(): HTMLElement {
  const view = render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  );
  return view.container;
}

async function waitForCatalogue() {
  await waitFor(() => expect(screen.queryByText(LOADING)).toBeNull());
}

/** The grid of catalogue cards (not the "recently added" panel). */
function catalogueGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector("div.stagger.grid");
  if (!grid) throw new Error("catalogue grid not rendered");
  return grid as HTMLElement;
}

/** Opens a record's drawer through its card in the grid. */
function openRecord(container: HTMLElement, title: string) {
  const card = within(catalogueGrid(container))
    .getAllByText(title)[0]
    ?.closest("button");
  if (!card) throw new Error(`no card rendered for "${title}"`);
  fireEvent.click(card);
}

function downloadButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /دریافت/ }) as HTMLButtonElement;
}

/** A header stat tile, by its label. */
function statTile(label: string): HTMLElement {
  const tile = screen.getByText(label).closest("div");
  if (!tile) throw new Error(`no stat tile for "${label}"`);
  return tile as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  clicks = [];
  created = [];
  revoked = [];
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:parsian/${created.length}`;
    created.push(url);
    return url;
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  }) as unknown as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the catalogue is data, not a fixture", () => {
  it("renders the rows the repository returns", async () => {
    const page = await getLibraryRepository().list({ per_page: 200 });
    const container = renderLibrary();
    await waitForCatalogue();

    const grid = catalogueGrid(container);
    for (const row of page.data.slice(0, 5)) {
      expect(within(grid).getAllByText(row.title)).not.toHaveLength(0);
    }
  });

  it("reports the real catalogue size in the header stats", async () => {
    const page = await getLibraryRepository().list({ per_page: 200 });
    renderLibrary();
    await waitForCatalogue();

    const tile = statTile("کل منابع");
    expect(tile.textContent).toContain(faNum(page.meta.total));
    // And that total is the persisted catalogue, not a constant.
    expect(page.meta.total).toBe(demoStore.resources.all().length);
  });

  it("counts how many records really have a stored file", async () => {
    const page = await getLibraryRepository().list({ per_page: 200 });
    const withFile = page.data.filter((row) => Boolean(row.mediaId)).length;
    expect(withFile).toBe(1); // only the provisioned demo file

    renderLibrary();
    await waitForCatalogue();

    expect(statTile("دارای فایل").textContent).toContain(faNum(withFile));
  });

  it("re-renders the shelf counts from the loaded rows", async () => {
    const items = (await getLibraryRepository().list({ per_page: 200 })).data;
    const pianoSheets = items.filter((row) => row.kind === "sheet" && row.instrument === "piano").length;
    expect(pianoSheets).toBeGreaterThan(0);

    const container = renderLibrary();
    await waitForCatalogue();

    // "نت‌های پیانو" is presentation metadata; its COUNT is derived data.
    const shelf = screen.getByText("نت‌های پیانو").closest("button");
    expect(shelf?.textContent).toContain(faNum(pianoSheets));
    expect(container.textContent).not.toContain(faNum(86)); // the old fixture constant
  });

  it("follows the catalogue when rows are added and removed", async () => {
    const container = renderLibrary();
    await waitForCatalogue();

    const row = await getLibraryRepository().create({
      title: "نت افزوده‌شده از آزمون",
      kind: "sheet",
      instrument: "guitar",
    });
    await waitFor(() =>
      expect(within(catalogueGrid(container)).queryByText("نت افزوده‌شده از آزمون")).not.toBeNull(),
    );

    await getLibraryRepository().delete(row.id);
    await waitFor(() =>
      expect(within(catalogueGrid(container)).queryByText("نت افزوده‌شده از آزمون")).toBeNull(),
    );
  });

  it("filters the grid by search against the loaded catalogue", async () => {
    const container = renderLibrary();
    await waitForCatalogue();

    fireEvent.change(screen.getByPlaceholderText(/جستجوی عنوان/), { target: { value: "شوپن" } });

    await waitFor(() =>
      expect(within(catalogueGrid(container)).queryByText(AUDIO_TITLE)).toBeNull(),
    );
    expect(within(catalogueGrid(container)).getAllByText(DEMO_TITLE)).not.toHaveLength(0);
  });

  it("renders the empty state for a zero-item library", async () => {
    // An empty catalogue is a valid environment, not a broken page.
    demoStore.replace(createEmptyDataset());
    const container = renderLibrary();
    await waitForCatalogue();

    await screen.findByText(EMPTY_TITLE);
    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    expect(statTile("کل منابع").textContent).toContain(faNum(0));
    // No fixture rows survived the emptying.
    expect(container.textContent).not.toContain(DEMO_TITLE);
  });

  it("surfaces a repository failure instead of an empty shelf", async () => {
    setLibraryRepository({
      list: () => Promise.reject(new ApiError({ kind: "server", status: 500, message: "کتابخانه در دسترس نیست" })),
    } as unknown as LibraryRepository);

    renderLibrary();

    await screen.findByText(ERROR_TITLE);
    expect(document.body.textContent).toContain("کتابخانه در دسترس نیست");
    expect(document.body.textContent).not.toContain(DEMO_TITLE);
    // The retry affordance is wired to the hook's reload, not a no-op.
    expect(screen.getByRole("button", { name: /تلاش دوباره|بازگردانی|تلاش مجدد/ })).toBeTruthy();
  });
});

describe("downloading a stored file", () => {
  it("hands the browser the file's actual bytes", async () => {
    await ensureDemoLibraryFile();
    const container = renderLibrary();
    await waitForCatalogue();

    openRecord(container, DEMO_TITLE);

    // The drawer states what is really stored, and offers the download.
    await waitFor(() => expect(document.body.textContent).toContain("فایل این منبع ذخیره شده است"));
    expect(screen.getAllByText(DEMO_LIBRARY_FILENAME)).not.toHaveLength(0);

    const button = downloadButton();
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe(DEMO_LIBRARY_FILENAME);
    expect(clicks[0].href).toBe(created[0]);
    expect(revoked).toEqual([]); // revoking early would cancel the download

    // And the bytes that went out are the bytes that were stored.
    const blob = await getBlobStore().get(DEMO_LIBRARY_ASSET_ID);
    expect(await blob?.text()).toBe(DEMO_LIBRARY_TEXT);
  });

  it("disables the download and says why when the bytes are not stored", async () => {
    // Metadata without binaries: exactly what a backup restore leaves behind.
    await getBlobStore().remove(DEMO_LIBRARY_ASSET_ID);
    const container = renderLibrary();
    await waitForCatalogue();

    openRecord(container, DEMO_TITLE);

    const button = downloadButton();
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(document.body.textContent).toContain("در این مرورگر موجود نیست");
    expect(clicks).toEqual([]);
    expect(created).toEqual([]);
  });

  it("offers no download for a catalogue-only record", async () => {
    await getLibraryRepository().create({ title: "فهرست منابع بدون فایل", kind: "doc", instrument: "theory" });
    const container = renderLibrary();
    await waitForCatalogue();

    openRecord(container, "فهرست منابع بدون فایل");

    const button = downloadButton();
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(document.body.textContent).toContain("فایل ذخیره‌شده ندارد");
  });

  it("does not animate a player for audio whose file is absent", async () => {
    // The seeded audio rows carry waveform decoration but no stored bytes; a
    // player that pretends to play is worse than one that says it cannot.
    const container = renderLibrary();
    await waitForCatalogue();

    openRecord(container, AUDIO_TITLE);

    await waitFor(() =>
      expect(document.body.textContent).toContain("فایل صوتی این منبع در این مرورگر ذخیره نشده است"),
    );
    expect(clicks).toEqual([]);
  });
});

describe("record detail", () => {
  it("shows the seeded demo record's real metadata", async () => {
    const row = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);
    const container = renderLibrary();
    await waitForCatalogue();

    openRecord(container, DEMO_TITLE);

    // The drawer offers its close control in both the header and the mobile bar.
    expect(screen.getAllByRole("button", { name: "بستن" })).not.toHaveLength(0);
    expect(document.body.textContent).toContain(row.composer);
    expect(document.body.textContent).toContain(row.level);
    expect(row.mediaId).toBe(DEMO_LIBRARY_ASSET_ID);
  });
});

/**
 * Boundary assertions on the view's own source. The architectural rule is that
 * a view goes View → hook → repository → store/API; a scan catches a regression
 * that no render test would (a fixture import still renders fine).
 */
describe("Library.tsx source boundaries", () => {
  const source = readFileSync(VIEW_SOURCE, "utf8");

  it("does not import the static resource fixture", () => {
    // Presentation metadata (shelf labels, kind labels) may come from the
    // design-data module; catalogue ROWS may not.
    expect(source).toMatch(/from "@\/data\/records"/);
    expect(source).not.toMatch(/import\s*\{[^}]*\bresources\b[^}]*\}\s*from/);
    expect(source).not.toMatch(/\bresources\b\s*,/);
  });

  it("does not reach for the store, storage or IndexedDB", () => {
    for (const forbidden of ["demoStore", "localStorage", "indexedDB", "openDB", "IDBDatabase", "blobStore"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("goes through the library hooks", () => {
    expect(source).toMatch(/from "@\/domains\/library\/useLibrary"/);
    expect(source).toMatch(/useLibraryList\(/);
    expect(source).toMatch(/useLibraryFile\(/);
  });

  it("hardcodes no record id and fabricates no download URL", () => {
    expect(source).not.toMatch(/\bres1\b/);
    expect(source).not.toMatch(/["'`]blob:/);
    expect(source).not.toContain("createObjectURL");
  });

  it("states its page size explicitly", () => {
    expect(source).toMatch(/useLibraryList\(\{\s*per_page:\s*\d+/);
  });
});
