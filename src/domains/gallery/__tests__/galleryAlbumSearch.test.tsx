// @vitest-environment jsdom
/**
 * Gallery album search (F1 audit G-4).
 *
 * WHY THIS FILE EXISTS. The F1 audit of `main@4edd0bc` found that the gallery
 * panel's album search (`جستجوی آلبوم…`) is wired end to end — the panel passes
 * `search` to `useAlbums`, and `DemoGalleryRepository.listAlbums` matches it
 * against title and description — yet no test typed into it. These cases pin
 * that the list the user sees follows the query, on both fields, and recovers
 * when the query is cleared.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryPanel } from "../GalleryPanel";
import { getGalleryRepository, resetRegistry } from "@/domains/registry";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const LOADING = "در حال بارگذاری گالری…";
const PLACEHOLDER = "جستجوی آلبوم…";

const SPRING = { title: "کنسرت بهاره", description: "اجرای پایانی هنرجویان پیانو" };
const WORKSHOP = { title: "کارگاه سه‌تار", description: "جلسهٔ گروهی مقام‌خوانی" };

function renderPanel() {
  return render(
    <AppProvider>
      <GalleryPanel />
    </AppProvider>,
  );
}

async function waitForPanel() {
  await waitFor(() => expect(screen.queryByText(LOADING)).toBeNull());
}

/** The album button in the list, by its accessible name (the album title). */
function albumButton(title: string): HTMLElement | null {
  return screen.queryByRole("button", { name: title });
}

async function search(value: string) {
  fireEvent.change(await screen.findByPlaceholderText(PLACEHOLDER), { target: { value } });
}

beforeEach(async () => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  }
  await getGalleryRepository().createAlbum(SPRING);
  await getGalleryRepository().createAlbum(WORKSHOP);
});

afterEach(cleanup);

describe("album search (G-4)", () => {
  it("lists every album before a query is typed", async () => {
    renderPanel();
    await waitForPanel();
    expect(albumButton(SPRING.title)).not.toBeNull();
    expect(albumButton(WORKSHOP.title)).not.toBeNull();
  });

  it("narrows the album list by title", async () => {
    renderPanel();
    await waitForPanel();
    await search("بهاره");
    await waitFor(() => expect(albumButton(WORKSHOP.title)).toBeNull());
    expect(albumButton(SPRING.title)).not.toBeNull();
  });

  it("matches the description as well as the title", async () => {
    renderPanel();
    await waitForPanel();
    await search("مقام‌خوانی");
    await waitFor(() => expect(albumButton(SPRING.title)).toBeNull());
    expect(albumButton(WORKSHOP.title)).not.toBeNull();
  });

  it("drops seeded albums that do not match", async () => {
    const seeded = (await getGalleryRepository().listAlbums({ per_page: 100 })).data.filter(
      (a) => a.title !== SPRING.title && a.title !== WORKSHOP.title,
    );
    expect(seeded.length).toBeGreaterThan(0);
    renderPanel();
    await waitForPanel();
    await search("بهاره");
    await waitFor(() => expect(albumButton(WORKSHOP.title)).toBeNull());
    for (const album of seeded) expect(albumButton(album.title)).toBeNull();
  });

  it("restores the full list when the query is cleared", async () => {
    renderPanel();
    await waitForPanel();
    await search("بهاره");
    await waitFor(() => expect(albumButton(WORKSHOP.title)).toBeNull());
    await search("");
    await waitFor(() => expect(albumButton(WORKSHOP.title)).not.toBeNull());
    expect(albumButton(SPRING.title)).not.toBeNull();
  });

  it("a query matching nothing shows no album buttons", async () => {
    renderPanel();
    await waitForPanel();
    await search("عبارتی‌که‌هیچ‌آلبومی‌ندارد");
    await waitFor(() => expect(albumButton(SPRING.title)).toBeNull());
    expect(albumButton(WORKSHOP.title)).toBeNull();
  });
});
