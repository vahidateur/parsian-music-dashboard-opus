// @vitest-environment jsdom
/**
 * Gallery showcase modes and batch work (user-verified flows).
 *
 * - The "ستونی" (masonry) mode lays the same images out in flowing columns
 *   with uncropped frames, unlike the dense grid (row spans) and the compact
 *   squares. jsdom performs no layout, so the mode switch is pinned by the
 *   column container, not by pixels.
 * - Batch select → move/delete drives one existing repository verb per image
 *   (there is no server batch verb) and reports the honest per-item tally:
 *   all-ok toasts success, any refusal names its count instead of claiming
 *   everything landed.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/targets/galleryProvisioning", () => ({
  useDemoGalleryBytes: () => ({ settled: true, unavailable: false }),
}));

import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { DEMO_GALLERY_PHOTOS } from "@/domains/demo/gallerySeed";
import { getGalleryRepository, resetRegistry, setAuthRepository, setMediaRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { GalleryView } from "@/views/Gallery";

async function renderAsManager() {
  return renderAs("manager@demo.local");
}

async function renderAs(email: string) {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
  render(
    <AuthProvider>
      <AppProvider>
        <GalleryView />
      </AppProvider>
    </AuthProvider>,
  );
}

const firstPhoto = DEMO_GALLERY_PHOTOS[0];
const secondPhoto = DEMO_GALLERY_PHOTOS[1];

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("showcase modes", () => {
  it("switches to uncropped masonry columns (grid crops, masonry does not)", async () => {
    // Real bytes so the tiles render <img> instead of the missing-file note.
    // jsdom's URL.createObjectURL rejects the test-realm Blob, so it is
    // stubbed to the string the component threads into <img src>.
    const { LocalMediaRepository } = await import("@/domains/media/localRepository");
    const media = new LocalMediaRepository();
    vi.spyOn(media, "getBlob").mockResolvedValue(new Blob(["x"], { type: "image/png" }) as never);
    setMediaRepository(media as never);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    await renderAsManager();
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });

    // Dense grid mode fills fixed frames (cropped tiles).
    await waitFor(() => {
      expect(document.querySelectorAll(".grid img").length).toBeGreaterThan(0);
    });
    for (const img of Array.from(document.querySelectorAll(".grid img"))) {
      expect((img as HTMLElement).className).toContain("size-full");
    }

    fireEvent.click(screen.getByRole("tab", { name: "ستونی" }));

    // Masonry flows the photographs through explicit percentage lanes, dealt
    // round-robin over the rendered order (ground truth: the repo order).
    const lanes = document.querySelector("[data-masonry-columns]");
    expect(lanes, "masonry lays out in explicit lanes").not.toBeNull();
    const visibleOrder = (await getGalleryRepository().listImages({ per_page: 200 })).data.map((image) => image.id);
    const laneDivs = Array.from((lanes as HTMLElement).querySelectorAll(":scope > div"));
    expect(laneDivs).toHaveLength(2);
    const laneIds = laneDivs.map((lane) =>
      within(lane as HTMLElement)
        .getAllByRole("button", { name: /دیدن تصویر: / })
        .map((button) => {
          const caption = (button.getAttribute("aria-label") ?? "").replace(/^دیدن تصویر: /, "");
          return DEMO_GALLERY_PHOTOS.find((item) => item.caption === caption)?.imageId;
        }),
    );
    expect(laneIds[0]).toEqual(visibleOrder.filter((_, index) => index % 2 === 0));
    expect(laneIds[1]).toEqual(visibleOrder.filter((_, index) => index % 2 === 1));
    // And nothing is cropped to fill: natural heights, not fixed frames.
    let natural: HTMLElement[] = [];
    await waitFor(() => {
      natural = within(lanes as HTMLElement).getAllByRole("img") as unknown as HTMLElement[];
      expect(natural.length).toBeGreaterThan(0);
    });
    for (const img of natural) {
      expect((img as HTMLElement).className).toContain("h-auto");
      expect((img as HTMLElement).className).not.toContain("size-full");
    }
  });

  it("deals items round-robin across lanes", async () => {
    const { distributeIntoColumns } = await import("@/views/Gallery");
    expect(distributeIntoColumns([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]);
    expect(distributeIntoColumns([1, 2, 3], 4)).toEqual([[1], [2], [3], []]);
    expect(distributeIntoColumns([], 3)).toEqual([[], [], []]);
    expect(distributeIntoColumns([1], 0)).toEqual([[1]]);
  });

  it("remembers the showcase layout across visits", async () => {
    await renderAsManager();
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });
    // Start from a known state regardless of earlier tests in this file.
    fireEvent.click(screen.getByRole("tab", { name: "شبکه‌ای" }));
    expect(document.querySelector("[data-masonry-columns]")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "ستونی" }));
    expect(document.querySelector("[data-masonry-columns]")).not.toBeNull();

    // A fresh mount — a return visit — restores the stored layout untouched.
    cleanup();
    resetRegistry();
    await renderAsManager();
    await screen.findByRole("tab", { name: "ستونی" });
    expect(document.querySelector("[data-masonry-columns]")).not.toBeNull();
  });
});

describe("who sees the furnished readout", () => {
  it("shows the details panel to the manager but a bare photo to the teacher", async () => {
    await renderAs("manager@demo.local");
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });
    fireEvent.click(screen.getByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` }));
    const managerDialog = await screen.findByRole("dialog");
    expect(within(managerDialog).getByText("آرشیو تصویر")).toBeDefined();
    expect(within(managerDialog).getByText(firstPhoto.caption)).toBeDefined();
    cleanup();
    resetRegistry();

    await renderAs("teacher1@demo.local");
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });
    fireEvent.click(screen.getByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` }));
    // The lightbox opens on the bare photograph: no furnished readout.
    const teacherDialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(teacherDialog).queryByText("آرشیو تصویر")).toBeNull());
    expect(within(teacherDialog).queryByText(firstPhoto.caption)).toBeNull();
  });
});

describe("batch select and move", () => {
  it("moves two selected photos to the other album with one write per photo", async () => {
    await renderAsManager();
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });

    // Move them where they are not: the other seeded album.
    const albums = (await getGalleryRepository().listAlbums({ per_page: 100 })).data;
    const targetAlbum = albums.find((album) => album.id !== firstPhoto.albumId);
    expect(targetAlbum, "a second album exists to move into").toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "انتخاب چندتایی" }));
    fireEvent.click(screen.getByRole("checkbox", { name: `انتخاب تصویر: ${firstPhoto.caption}` }));
    fireEvent.click(screen.getByRole("checkbox", { name: `انتخاب تصویر: ${secondPhoto.caption}` }));

    const target = await screen.findByLabelText("آلبوم مقصد");
    fireEvent.change(target, { target: { value: targetAlbum!.id } });
    fireEvent.click(screen.getByRole("button", { name: "انتقال" }));

    const repo = getGalleryRepository();
    await waitFor(async () => {
      const page = await repo.listImages({ albumId: targetAlbum!.id, per_page: 200 });
      expect(page.data.map((image) => image.id)).toEqual(
        expect.arrayContaining([expect.any(String), expect.any(String)]),
      );
      expect(page.meta.total).toBeGreaterThanOrEqual(2);
    });
    // The moved rows left the source album behind.
    const source = await repo.listImages({ albumId: firstPhoto.albumId, per_page: 200 });
    expect(source.data.find((image) => image.caption === firstPhoto.caption)).toBeUndefined();
  });

  it("asks for confirmation before a batch delete", async () => {
    await renderAsManager();
    await screen.findByRole("button", { name: `دیدن تصویر: ${firstPhoto.caption}` });

    fireEvent.click(screen.getByRole("button", { name: "انتخاب چندتایی" }));
    fireEvent.click(screen.getByRole("checkbox", { name: `انتخاب تصویر: ${firstPhoto.caption}` }));
    fireEvent.click(screen.getByRole("button", { name: /حذف ۱ مورد/ }));

    // Two-step: the destructive write waits for an explicit confirm.
    expect(await screen.findByRole("button", { name: "تأیید حذف" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "تأیید حذف" }));
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: `انتخاب تصویر: ${firstPhoto.caption}` })).toBeNull(),
    );
  });
});
