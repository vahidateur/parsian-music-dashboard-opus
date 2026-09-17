// @vitest-environment jsdom
/**
 * Gallery uploads through the UI.
 *
 * The valuable assertions are that a real file round-trips into the blob store
 * and that a rejected file leaves nothing behind — a partially written album
 * entry pointing at missing bytes would be worse than a failed upload.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { GalleryPanel } from "../GalleryPanel";
import { getGalleryRepository, getMediaRepository, resetRegistry } from "@/domains/registry";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);

/** Assets the canonical seed ships on its own (the library's demo file). */
let seededMediaCount: number;

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  seededMediaCount = demoStore.media.all().length;

  // jsdom implements neither of these.
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  }
});

function renderPanel() {
  return render(
    <AppProvider>
      <GalleryPanel />
    </AppProvider>,
  );
}

async function waitForPanel() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گالری…")).toBeNull());
}

/** A structurally valid PNG file. */
function pngFile(name = "photo.png", size = 128): File {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const file = new File([bytes], name, { type: "image/png" });
  // jsdom's File lacks arrayBuffer() in some versions.
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  }
  return file;
}

/** Creates an album and returns its title. */
async function createAlbum(title = "کنسرت بهار"): Promise<string> {
  fireEvent.change(screen.getByLabelText("آلبوم جدید"), { target: { value: title } });
  fireEvent.click(screen.getAllByRole("button", { name: "افزودن" })[0]);
  await waitFor(async () => {
    const albums = await getGalleryRepository().listAlbums({ per_page: 100 });
    expect(albums.data.some((a) => a.title === title)).toBe(true);
  });
  return title;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("albums", () => {
  it("creates an album and selects it", async () => {
    renderPanel();
    await waitForPanel();
    const title = await createAlbum();
    expect(await screen.findByText(title)).toBeDefined();
  });

  it("seeds albums but no fake photos", async () => {
    renderPanel();
    await waitForPanel();

    /*
      Albums give the demo structure; the seed ships zero IMAGES, so every album
      starts genuinely empty rather than showing placeholder imagery that does
      not exist. The one seeded media asset is the library's text file, not a
      photo, and no gallery row points at it.
    */
    const albums = await getGalleryRepository().listAlbums({ per_page: 100 });
    expect(albums.data.length).toBeGreaterThan(0);
    expect(demoStore.galleryImages.all()).toHaveLength(0);
    expect(demoStore.media.all().filter((asset) => asset.kind === "image")).toHaveLength(0);
    expect(await screen.findByText("این آلبوم خالی است")).toBeDefined();
  });
});

describe("uploading", () => {
  it("stores a valid image and shows it in the album", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    fireEvent.change(screen.getByLabelText(/توضیح تصویر/), { target: { value: "اجرای گروه سنتور" } });
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    await waitFor(async () => {
      const images = await getGalleryRepository().listImages({ per_page: 100 });
      expect(images.data).toHaveLength(1);
      expect(images.data[0].alt).toBe("اجرای گروه سنتور");
    });

    // The bytes really landed in the blob store.
    const images = await getGalleryRepository().listImages({ per_page: 100 });
    expect(await getMediaRepository().getBlob(images.data[0].mediaId)).toBeInstanceOf(Blob);
  });

  it("renders the image with its alt text", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    fireEvent.change(screen.getByLabelText(/توضیح تصویر/), { target: { value: "تمرین ارکستر" } });
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    await waitFor(() => expect(screen.getByAltText("تمرین ارکستر")).toBeDefined());
  });

  it("rejects a disallowed type and writes nothing", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    Object.defineProperty(svg, "arrayBuffer", { value: async () => new TextEncoder().encode("<svg/>").buffer });
    fireEvent.change(fileInput(), { target: { files: [svg] } });

    await waitFor(async () => {
      expect((await getGalleryRepository().listImages({ per_page: 100 })).data).toHaveLength(0);
    });
    // No orphan media metadata either: the rejected upload added no asset.
    expect(demoStore.media.all()).toHaveLength(seededMediaCount);
  });

  it("rejects a file whose bytes contradict its declared type", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]); // JPEG magic
    const liar = new File([bytes], "liar.png", { type: "image/png" });
    Object.defineProperty(liar, "arrayBuffer", { value: async () => bytes.buffer });
    fireEvent.change(fileInput(), { target: { files: [liar] } });

    await waitFor(async () => {
      expect((await getGalleryRepository().listImages({ per_page: 100 })).data).toHaveLength(0);
    });
  });

  it("falls back to the filename when no caption is given", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    fireEvent.change(fileInput(), { target: { files: [pngFile("recital.png")] } });

    await waitFor(async () => {
      const images = await getGalleryRepository().listImages({ per_page: 100 });
      expect(images.data[0]?.alt).toBe("recital.png");
    });
  });
});

describe("removing", () => {
  it("removes an image and frees its bytes", async () => {
    renderPanel();
    await waitForPanel();
    await createAlbum();

    fireEvent.change(screen.getByLabelText(/توضیح تصویر/), { target: { value: "حذف‌شدنی" } });
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    await waitFor(async () => {
      expect((await getGalleryRepository().listImages({ per_page: 100 })).data).toHaveLength(1);
    });
    const mediaId = (await getGalleryRepository().listImages({ per_page: 100 })).data[0].mediaId;

    fireEvent.click(await screen.findByRole("button", { name: "حذف حذف‌شدنی" }));

    await waitFor(async () => {
      expect((await getGalleryRepository().listImages({ per_page: 100 })).data).toHaveLength(0);
    });
    expect(await getMediaRepository().getBlob(mediaId)).toBeUndefined();
  });
});
