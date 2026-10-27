// @vitest-environment jsdom
/**
 * Lightbox scroll escape (user-reported, with screenshot).
 *
 * The dialog locks `document.body` scroll while open, so the ONLY scroll
 * path for content taller than the viewport is the backdrop itself. The
 * backdrop used to center with `items-center` and no overflow while the
 * panel capped itself at `max-h-full` + `overflow-hidden` — a tall photo
 * (or a narrow viewport stacking frame over details) was cut with no way
 * to reach the cut part: no scroll, no gesture, nothing.
 *
 * Fixed shape, pinned here: the backdrop scrolls (`overflow-y-auto`,
 * horizontal centering only), and the panel centers itself with `my-auto`
 * (centered when it fits, top-aligned and scrollable when it does not)
 * without a viewport-height cap. jsdom performs no layout, so this pins the
 * mechanism classes; the visual proof is a real-viewport check.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import type { GalleryImage } from "@/domains/gallery/types";

afterEach(cleanup);

const image: GalleryImage = {
  id: "gi_probe",
  albumId: "al_1",
  mediaId: "md_missing",
  caption: "قاب آزمایشی",
  alt: "متن جایگزین آزمایشی",
  sortOrder: 0,
  createdAt: "2026-10-26T00:00:00.000Z",
};

function renderLightbox(): void {
  render(
    <AppProvider>
      <GalleryLightbox
        images={[image]}
        index={0}
        albumTitle={() => "آلبوم آزمایشی"}
        canWrite={false}
        canSeeDetails
        onIndex={vi.fn()}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    </AppProvider>,
  );
}

describe("lightbox scroll escape", () => {
  it("lets an overflowing panel scroll on the backdrop instead of clipping it", () => {
    renderLightbox();
    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("overflow-y-auto")).toBe(true);
    expect(dialog.classList.contains("items-center")).toBe(false);
  });

  it("centers a fitting panel without capping it at the viewport height", () => {
    renderLightbox();
    const panel = screen.getByText("قاب آزمایشی").closest("div.overflow-hidden");
    expect(panel).not.toBeNull();
    expect(panel!.classList.contains("my-auto")).toBe(true);
    expect(panel!.classList.contains("max-h-full")).toBe(false);
  });
});
