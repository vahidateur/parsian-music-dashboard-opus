// @vitest-environment jsdom
/**
 * THE GALLERY VIEW — the showcase the dashboard was missing.
 *
 * What this file pins is the product behaviour an operator can see:
 *   • the seeded albums and their photographs render from the real repositories,
 *     with the seed's captions and alternative text (no invented imagery);
 *   • the album filter really filters, and says so in the header;
 *   • a tile opens the lightbox, the lightbox travels with the arrow keys —
 *     mirrored for right-to-left, where "next" is ArrowLeft — and Escape closes it;
 *   • a photograph whose bytes cannot be read is a framed note plus a banner,
 *     never a broken thumbnail: in jsdom there is no blob store and no fetch of
 *     the bundled assets, which is exactly the degraded browser this view
 *     promises to survive honestly.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryView } from "../Gallery";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DEMO_GALLERY_PHOTOS } from "@/domains/demo/gallerySeed";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
});

function renderView() {
  return render(
    <AppProvider>
      <GalleryView />
    </AppProvider>,
  );
}

describe("the showcase", () => {
  it("renders the seeded photographs with their captions and alt text", async () => {
    renderView();

    for (const photo of DEMO_GALLERY_PHOTOS) {
      // Captions live in the hover overlay AND in the tile's accessible name.
      expect(await screen.findAllByText(photo.caption)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: `دیدن تصویر: ${photo.caption}` }).length).toBeGreaterThan(0);
    }
    // The header counts what the repositories hold, in Persian digits.
    expect(screen.getByText("۶ تصویر در ۲ آلبوم")).toBeDefined();
  });

  it("filters by album, and the header wears the album's own title", async () => {
    renderView();
    await screen.findAllByText("تالار اصلی، دقیقه‌های پیش از شروع اجرا");

    fireEvent.click(screen.getByRole("button", { name: /فضای آموزشگاه/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("فضای آموزشگاه");
    });
    // The recital album's photographs are gone from the mosaic…
    expect(screen.queryByRole("button", { name: "دیدن تصویر: تشویق پایان اجرا" })).toBeNull();
    // …and the rooms album's are here.
    expect(screen.getByRole("button", { name: "دیدن تصویر: اتاق تمرین شمارهٔ دو، عصر" })).toBeDefined();
  });

  it("opens a lightbox that travels with the arrows and closes with Escape", async () => {
    renderView();
    const first = await screen.findByRole("button", { name: "دیدن تصویر: تالار اصلی، دقیقه‌های پیش از شروع اجرا" });
    fireEvent.click(first);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toContain("۱ از ۶");

    // Right-to-left travel: ArrowLeft is NEXT.
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByRole("dialog").getAttribute("aria-label")).toContain("۲ از ۶"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("dialog").getAttribute("aria-label")).toContain("۱ از "));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("reports unreadable bytes as a framed note and a banner, not a broken thumbnail", async () => {
    renderView();

    /*
      jsdom has neither IndexedDB nor a fetchable bundle, so provisioning ends
      `unavailable` — the exact degraded browser the view promises to survive.
    */
    expect(await screen.findByText(/فضای ذخیره‌سازی تصویر در این مرورگر در دسترس نیست/)).toBeDefined();
    expect((await screen.findAllByText("فایل تصویر در این مرورگر موجود نیست")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
