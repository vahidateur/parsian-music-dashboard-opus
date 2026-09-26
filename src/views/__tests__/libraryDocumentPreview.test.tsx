// @vitest-environment jsdom
/**
 * The Library drawer mounts the document preview.
 *
 * `ResourcePreview`'s own cases cover the rendering rules; this file covers the
 * one thing a component test cannot: that the view actually wires it up, and that
 * the preview is built from the same bytes the download uses. The seeded demo
 * score carries a real plain-text study sheet, so the text asserted here is read
 * out of the blob store — this file never writes the content it expects.
 *
 * The second case matters as much as the first. A catalogue row can legitimately
 * exist while its bytes do not (a backup restore returns metadata only, and the
 * demo provisions its file at bootstrap). In that state the drawer must offer
 * nothing to preview and must still explain itself, exactly as it already does
 * for download. A preview area that renders an empty box would be the dishonest
 * version of this screen.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { ensureDemoLibraryFile } from "@/domains/library/demoContent";
import { getMediaRepository, resetRegistry, setMediaRepository } from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

/** The seeded row the demo ships real bytes for. */
const DEMO_TITLE = "نوکتورن اپوس ۹ شمارهٔ ۲";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

async function renderLibrary() {
  render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.queryByText("در حال باز کردن کتابخانه…")).toBeNull());
}

async function openDrawerForDemoRow() {
  const card = screen
    .getAllByRole("button")
    .find((button) => (button.textContent ?? "").includes(DEMO_TITLE));
  expect(card, `a resource card for ${DEMO_TITLE} must be on screen`).toBeDefined();
  fireEvent.click(card!);
  await screen.findByRole("dialog");
}

/**
 * Writes the demo file's bytes into the blob store.
 *
 * The application does this at bootstrap (see `ensureDemoLibraryFile` in the
 * library domain); a test that mounts the view alone skips that step, so the
 * positive cases perform it explicitly rather than pretending the bytes are
 * always there.
 */
async function provisionDemoFile() {
  await ensureDemoLibraryFile();
}

/** Metadata resolves, bytes do not — the state a restore leaves behind. */
function hideStoredBytes() {
  setMediaRepository(
    withStubs(getMediaRepository(), {
      getBlob: () => Promise.resolve<Blob | undefined>(undefined),
    }),
  );
}

describe("document preview in the detail drawer", () => {
  it("shows the stored note's real bytes", async () => {
    await provisionDemoFile();
    await renderLibrary();
    await openDrawerForDemoRow();

    // A line that exists only inside the stored file, proving the preview read the
    // blob rather than repeating anything this test writes.
    const preview = await screen.findByText(/راهنمای مطالعه برای مدرس و هنرجوی پیشرفتهٔ پیانو/);
    expect(preview.tagName).toBe("PRE");
    // Newlines survive, so a fingering sheet stays readable rather than flattening.
    expect(preview.textContent).toContain("\n");
  });

  it("offers no preview area when the row has no bytes, and says why", async () => {
    hideStoredBytes();
    await renderLibrary();
    await openDrawerForDemoRow();

    // The drawer's existing honest explanation still carries the state…
    expect(await screen.findByText(/فایل این منبع در این مرورگر موجود نیست/)).toBeDefined();
    // …and no preview is invented beside it.
    expect(document.querySelector("pre")).toBeNull();
    expect(document.querySelector("a[href^='blob:']")).toBeNull();
  });

  it("does not trade the preview away for the download, or the reverse", async () => {
    await provisionDemoFile();
    await renderLibrary();
    await openDrawerForDemoRow();

    await screen.findByText(/راهنمای مطالعه برای مدرس/);
    // The download affordance is still offered and still enabled: a preview must
    // not quietly replace the action that actually hands over the file.
    const download = screen.getByRole("button", { name: /دریافت/ });
    expect(download.hasAttribute("disabled")).toBe(false);
  });
});
