// @vitest-environment jsdom
/**
 * Two promises this panel makes to the operator, pinned here.
 *
 * 1. IT SPEAKS THE OPERATOR'S LANGUAGE, NOT THE AUDIT'S. The panel used to
 *    render its own verification notes into the UI — «seed VERIFIED 2 albums
 *    0 images», «sortOrder ASC then createdAt», the seed module's file path.
 *    Those strings are build-time commentary; an academy owner reading the
 *    gallery should never meet them. The first case asserts their absence from
 *    the RENDERED text (not from the module, whose internal notes stay), and
 *    the second asserts the opposite direction — that the surface still says
 *    the things an operator needs (title, storage disclosure, empty copy).
 *
 * 2. IT DOES NOT ASK A QUESTION IT CANNOT PHRASE. `paginate` reads
 *    `per_page: 0` as "one row" (`src/domains/shared/demoCollection.ts:22`), so
 *    the panel's old "no album selected" read was answered with a row belonging
 *    to some other album (OPEN_ITEMS I14). The fix is at this call site only:
 *    the images read lives behind a component that is mounted when — and only
 *    when — there is an album to ask about. No album, no read.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryPanel } from "../GalleryPanel";
import { getGalleryRepository, resetRegistry, setGalleryRepository } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import type { GalleryImageListParams } from "../types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/**
 * Settles both reads: the panel's own album read, then the selected album's
 * image read (which mounts only once an album exists). The images area is where
 * the storage disclosure lives, so a case that asserts on the rendered surface
 * has to wait for it rather than reading a frame of it.
 */
async function waitForPanel() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گالری…")).toBeNull());
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری تصاویر این آلبوم…")).toBeNull());
}

/**
 * A gallery repository whose image reads are counted, delegating everything else
 * — including `listImages` itself — to the real one.
 */
function countedGallery() {
  const real = getGalleryRepository();
  const listImages = vi.fn((params: GalleryImageListParams, signal?: AbortSignal) =>
    real.listImages(params, signal),
  );
  setGalleryRepository(withStubs(real, { listImages }));
  return listImages;
}

describe("the gallery panel speaks to the operator, not to the audit", () => {
  it("renders no seed, verification or sorting-implementation wording", async () => {
    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitForPanel();

    const rendered = document.body.textContent ?? "";
    for (const leak of ["VERIFIED", "sortOrder", "seed:", "learningSeed", "INFERRED", "per_page"]) {
      expect(rendered, `the rendered gallery must not name "${leak}"`).not.toContain(leak);
    }
  });

  it("keeps the copy the operator actually needs", async () => {
    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitForPanel();

    // The panel, its album column, the disclosure about where photographs live.
    expect(screen.getByText("گالری تصاویر")).toBeDefined();
    expect(screen.getByText(/^آلبوم‌ها —/)).toBeDefined();
    expect(document.body.textContent).toContain("تصاویر فقط در حافظهٔ همین مرورگر ذخیره می‌شوند");
  });
});

describe("no album selected means no image read", () => {
  it("issues no image read at all when the gallery has no albums", async () => {
    for (const album of demoStore.galleryAlbums.all()) demoStore.galleryAlbums.remove(album.id);
    const listImages = countedGallery();

    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitForPanel();

    // The honest empty states are up…
    expect(screen.getByText("آلبومی وجود ندارد")).toBeDefined();
    expect(screen.getByText("آلبومی انتخاب نشده")).toBeDefined();
    // …and the read that used to answer them with a stray row never happened.
    expect(listImages).not.toHaveBeenCalled();
  });

  it("still reads the selected album's images once an album exists", async () => {
    const first = (await getGalleryRepository().listAlbums({ per_page: 100 })).data[0];
    expect(first, "the seeded gallery must ship at least one album").toBeDefined();
    const listImages = countedGallery();

    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitForPanel();

    await waitFor(() => expect(listImages).toHaveBeenCalled());
    expect(listImages).toHaveBeenCalledWith(
      expect.objectContaining({ albumId: first.id, per_page: 200 }),
      expect.anything(),
    );
  });
});
