// @vitest-environment jsdom
/**
 * Library document preview.
 *
 * What is genuinely under test here is honesty, not markup:
 *  - a preview appears only when the bytes are actually resolved;
 *  - a PDF is opened through the object URL the media seam created, never a
 *    synthesized or fabricated href;
 *  - nothing is ever embedded. The production CSP ships `object-src 'none'` and
 *    `default-src 'self'`, so an `<iframe>`/`<embed>` over a `blob:` URL would
 *    render an empty box that merely looks like a preview;
 *  - a kind that cannot have stored bytes says so instead of showing dead controls;
 *  - a text read that fails stays a failure, and the clipped text block is a tab stop,
 *    because inside a focus-trapped drawer a region you cannot scroll is a region you
 *    cannot read.
 *
 * jsdom runs no PDF viewer and has no `URL.createObjectURL` semantics to assert
 * against, so the URL is supplied as a prop — which is exactly how the view wires
 * it (`useMediaObjectUrl` owns creation and revocation).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcePreview, isPreviewableMimeType, needsPreviewObjectUrl } from "../ResourcePreview";
import type { LibraryFileState } from "../types";
import type { MediaAsset } from "@/domains/media/types";

function asset(over: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "md_preview_test_1",
    kind: "document",
    filename: "sonata-k198.pdf",
    mimeType: "application/pdf",
    sizeBytes: 240_000,
    createdAt: "2026-09-24T09:00:00.000Z",
    ...over,
  };
}

function fileState(over: Partial<LibraryFileState> = {}): LibraryFileState {
  return {
    status: "ready",
    asset: asset(),
    downloading: false,
    error: null,
    download: () => {},
    ...over,
  };
}

afterEach(cleanup);

describe("document preview", () => {
  it("opens the stored PDF through the object URL the media seam created", () => {
    render(<ResourcePreview file={fileState()} previewUrl="blob:existing/2f" kind="sheet" />);

    const link = screen.getByRole("link", { name: /باز کردن پیش‌نمایش/ });
    // The href is the URL handed down, byte for byte — not one built here.
    expect(link.getAttribute("href")).toBe("blob:existing/2f");
    // A blob URL must not be navigated in the current document.
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("embeds nothing, because the production CSP would block an embedded blob", () => {
    const { container } = render(<ResourcePreview file={fileState()} previewUrl="blob:existing/2f" kind="sheet" />);
    expect(container.querySelector("iframe, embed, object")).toBeNull();
    expect(container.querySelector("video, audio")).toBeNull();
  });

  it("waits instead of inventing a URL when the object URL has not landed", () => {
    const { container } = render(<ResourcePreview file={fileState()} kind="sheet" />);
    expect(screen.getByText(/در حال آماده‌سازی پیش‌نمایش/)).toBeDefined();
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders a plain-text note from the real bytes", async () => {
    const note = new Blob(["فینگرینگ آهنگ چهارم، measures 12-18"], { type: "text/plain" });
    render(
      <ResourcePreview
        file={fileState({ asset: asset({ mimeType: "text/plain", filename: "note.txt" }), blob: note })}
        kind="doc"
      />,
    );
    expect(await screen.findByText(/فینگرینگ آهنگ چهارم/)).toBeDefined();
  });

  it("keeps newlines, because a fingering note is not a paragraph", async () => {
    const note = new Blob(["خط اول\nخط دوم"], { type: "text/plain" });
    render(
      <ResourcePreview file={fileState({ asset: asset({ mimeType: "text/plain" }), blob: note })} kind="doc" />,
    );
    const pre = await screen.findByText(/خط اول/);
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toContain("\n");
  });

  it("says a text file is empty instead of rendering a blank box", async () => {
    render(
      <ResourcePreview file={fileState({ asset: asset({ mimeType: "text/plain" }), blob: new Blob([""]) })} kind="doc" />,
    );
    expect(await screen.findByText("متن فایل خالی است.")).toBeDefined();
  });

  it("reports a text file it could not decode as a failure, not as a read in progress", async () => {
    const unreadable = new Blob(["هر چیزی"], { type: "text/plain" });
    const spy = vi.spyOn(Blob.prototype, "text").mockRejectedValue(new Error("decode failed"));
    try {
      render(
        <ResourcePreview
          file={fileState({ asset: asset({ mimeType: "text/plain" }), blob: unreadable })}
          kind="doc"
        />,
      );
      expect(await screen.findByText(/متن این فایل خوانده نشد/)).toBeDefined();
      // A promise of progress that can never arrive is worse than the error itself.
      expect(screen.queryByText(/در حال خواندن متن فایل/)).toBeNull();
      // And a failed read is never reported as an empty document.
      expect(screen.queryByText(/متن فایل خالی است/)).toBeNull();
      expect(document.querySelector("pre")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("does not call a file empty while its text is still being read", () => {
    const slow = new Blob(["متن طولانی"], { type: "text/plain" });
    const spy = vi.spyOn(slow, "text").mockReturnValue(new Promise<string>(() => {}));
    try {
      render(<ResourcePreview file={fileState({ asset: asset({ mimeType: "text/plain" }), blob: slow })} kind="doc" />);
      expect(screen.getByText(/در حال خواندن متن فایل/)).toBeDefined();
      expect(screen.queryByText(/متن فایل خالی است/)).toBeNull();
      expect(document.querySelector("pre")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps the clipped text reachable by keyboard, because the drawer holds focus", async () => {
    const note = new Blob(["خط اول\nخط دوم"], { type: "text/plain" });
    render(
      <ResourcePreview
        file={fileState({ asset: asset({ mimeType: "text/plain", filename: "fingering.txt" }), blob: note })}
        kind="doc"
      />,
    );
    const pre = await screen.findByText(/خط اول/);
    expect(pre.getAttribute("tabindex")).toBe("0");
    // A name is only announced on a role that can carry one, so the scrollable
    // region is labelled as a region rather than left as an unnamed block.
    expect(pre.getAttribute("role")).toBe("region");
    expect(pre.getAttribute("aria-label")).toContain("fingering.txt");
    // The behaviour the attributes exist for: focus actually lands here.
    pre.focus();
    expect(document.activeElement).toBe(pre);
  });

  it("renders no preview at all when the bytes are not there", () => {
    const { container } = render(
      <ResourcePreview
        file={fileState({ status: "missing", asset: undefined, blob: undefined, reason: "فایل در این مرورگر ذخیره نشده است." })}
        kind="sheet"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders no preview while the file is still being resolved", () => {
    const { container } = render(<ResourcePreview file={fileState({ status: "loading", asset: undefined })} kind="doc" />);
    expect(container.firstChild).toBeNull();
  });

  it("states that video cannot be previewed rather than showing dead controls", () => {
    const { container } = render(<ResourcePreview file={fileState()} kind="video" />);
    expect(screen.getByText(/پیش‌نمایش ویدیو در این معماری وجود ندارد/)).toBeDefined();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("preview availability follows the media allow-list", () => {
  it("offers a preview only for document types storage can actually hold", () => {
    expect(isPreviewableMimeType("application/pdf")).toBe(true);
    expect(isPreviewableMimeType("text/plain")).toBe(true);
    expect(isPreviewableMimeType("image/png")).toBe(false);
    expect(isPreviewableMimeType("video/mp4")).toBe(false);
    expect(isPreviewableMimeType(undefined)).toBe(false);
  });

  it("stays silent for an allowed-but-unrenderable type instead of failing", () => {
    const { container } = render(
      <ResourcePreview file={fileState({ asset: asset({ mimeType: "image/png" }) })} kind="doc" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("asks for an object URL only where one is used", () => {
    expect(needsPreviewObjectUrl("application/pdf")).toBe(true);
    expect(needsPreviewObjectUrl("text/plain")).toBe(false);
    expect(needsPreviewObjectUrl(undefined)).toBe(false);
  });
});
