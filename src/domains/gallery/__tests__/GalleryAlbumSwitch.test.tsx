// @vitest-environment jsdom
/**
 * I13 regression, at the site where the defect was demonstrated destructively.
 *
 * Before the fix, `GalleryPanel` read only `{ items: images }` and never
 * `loading`, so switching albums left the previous album's thumbnails — each
 * with its own «حذف …» button closing over its own `image` — on screen under the
 * new selection for the whole refetch. A measured probe clicked one and captured
 * `removeImage` being called with an image belonging to the album the user had
 * navigated *away* from, while `aria-current` already marked the new one.
 *
 * The assertion here is data-derived rather than "wait until loading is false":
 * every delete control on screen must target an image of the album the panel
 * says is selected. That is checked while the new album's read is deliberately
 * held open, so the window is wide and nothing depends on winning a race.
 *
 * HONEST LIMIT OF THIS FILE — do not over-claim it later. The one-frame
 * exposure (a params change committed before the effect that sets `loading`)
 * is NOT observable from here: `fireEvent` is act-wrapped, so the effect has
 * already flushed by the time the sampling loop starts. Reverted against the
 * pre-fix code this case still passed. What pins the frame itself is the
 * render-phase log in `src/domains/shared/__tests__/useResource.test.tsx`, and
 * what pins this panel's half is the GalleryPanel case in
 * `src/domains/shared/__tests__/staleQueryGates.test.tsx` — both of which do
 * fail against the code they guard. This file is the product-level regression
 * for the demonstrated scenario: no delete control may be armed against an
 * album other than the selected one, however the window is entered.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryPanel } from "../GalleryPanel";
import { getGalleryRepository, getMediaRepository, resetRegistry, setGalleryRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { Page } from "@/api/types";
import type { GalleryImage } from "../types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** A structurally valid PNG, as the media repository's magic-byte check wants. */
function pngBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes.buffer as ArrayBuffer;
}

/** The album the panel marks as selected, read from the DOM. */
function selectedAlbumTitle(): string | null {
  const current = screen
    .queryAllByRole("button")
    .find((button) => button.getAttribute("aria-current") === "true");
  return current?.textContent?.trim() ?? null;
}

/** Every delete control's target caption, as rendered. */
function deleteCaptions(): string[] {
  return screen
    .queryAllByRole("button", { name: /^حذف / })
    .map((button) => (button.getAttribute("aria-label") ?? "").replace(/^حذف /, ""));
}

describe("switching albums never arms a delete against the previous album", () => {
  it("every «حذف» on screen belongs to the album the panel says is selected", async () => {
    const gallery = getGalleryRepository();
    const media = getMediaRepository();
    const albums = (await gallery.listAlbums({ per_page: 100 })).data;
    expect(albums.length).toBeGreaterThan(1);
    const [albumA, albumB] = albums;

    // The seeded gallery holds albums but no images, so give each album one.
    const captionA = `تصویر آلبوم ${albumA.title}`;
    const captionB = `تصویر آلبوم ${albumB.title}`;
    const imageIds: Record<string, string> = {};
    for (const [album, caption] of [
      [albumA, captionA],
      [albumB, captionB],
    ] as const) {
      const asset = await media.create({
        kind: "image",
        filename: `${album.id}.png`,
        mimeType: "image/png",
        bytes: pngBytes(),
      });
      const added = await gallery.addImage({ albumId: album.id, mediaId: asset.id, caption, alt: caption });
      imageIds[album.id] = added.id;
    }

    // Hold album B's read open so the switch window is as wide as needed.
    const held = deferred<Page<GalleryImage>>();
    setGalleryRepository(
      new Proxy(getGalleryRepository(), {
        get(target, prop, receiver) {
          if (prop === "listImages") {
            return (params: { albumId?: string }, signal?: AbortSignal) =>
              params.albumId === albumB.id
                ? held.promise
                : (target as typeof gallery).listImages(params, signal);
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      }) as typeof gallery,
    );

    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گالری…")).toBeNull());
    // Settled on album A, showing A's image and nothing else.
    await waitFor(() => expect(deleteCaptions()).toEqual([captionA]));
    expect(selectedAlbumTitle()).toBe(albumA.title);

    // The switch, sampled while the new album's read is still in flight.
    fireEvent.click(screen.getByRole("button", { name: albumB.title }));
    expect(selectedAlbumTitle()).toBe(albumB.title);

    for (let sample = 0; sample < 25; sample += 1) {
      // THE INVARIANT. Under the old code this loop found «حذف تصویر آلبوم A»
      // while album B was already the selected one.
      const captions = deleteCaptions();
      expect(captions, `sample ${sample}: a delete from the previous album is armed`).not.toContain(captionA);
      expect(screen.queryByLabelText(`حذف ${captionA}`), `sample ${sample}`).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    // Album B's own image arrives, and only its own delete is armed.
    held.resolve({
      data: [
        {
          id: imageIds[albumB.id],
          albumId: albumB.id,
          mediaId: "md_probe",
          caption: captionB,
          alt: captionB,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
        } as GalleryImage,
      ],
      meta: { page: 1, per_page: 200, total: 1 },
    });
    await waitFor(() => expect(deleteCaptions()).toEqual([captionB]));

    // And the click that is now available really does target album B's image.
    const attempted: string[] = [];
    const realGallery = getGalleryRepository();
    setGalleryRepository(
      new Proxy(realGallery, {
        get(target, prop, receiver) {
          if (prop === "removeImage") {
            return async (id: string) => {
              attempted.push(id);
              throw new Error("PROBE-INTERCEPTED: the test asserts the target, it does not delete");
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      }) as typeof realGallery,
    );
    fireEvent.click(screen.getByLabelText(`حذف ${captionB}`));
    await waitFor(() => expect(attempted.length).toBe(1));

    const allImages = (await gallery.listImages({ per_page: 500 })).data;
    const target = allImages.find((image) => image.id === attempted[0]);
    expect(target, "the armed delete must target a real image").toBeDefined();
    expect(target!.albumId).toBe(albumB.id);
    expect(target!.albumId).not.toBe(albumA.id);

    // Nothing was destroyed: album A still holds its image.
    const albumAImages = (await gallery.listImages({ albumId: albumA.id, per_page: 200 })).data;
    expect(albumAImages.map((image) => image.id)).toContain(imageIds[albumA.id]);
  });
});
