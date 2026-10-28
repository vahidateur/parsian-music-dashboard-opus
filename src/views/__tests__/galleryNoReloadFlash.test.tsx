// @vitest-environment jsdom
/**
 * No reload flash during a batch upload.
 *
 * Every accepted write anywhere bumps the shared data version, so the gallery
 * lists refetch once per photo of a batch (bytes write + image-row write
 * each). The lists must keep rendering across those background refetches: the
 * full loading state is for the very first load (the view) and for a params
 * change that empties the page (the panel's album switch, pinned by
 * staleQueryGates) — never for a same-params refetch.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/targets/galleryProvisioning", () => ({
  useDemoGalleryBytes: () => ({ settled: true, unavailable: false }),
}));

import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { DEMO_GALLERY_PHOTOS } from "@/domains/demo/gallerySeed";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import { getGalleryRepository, getMediaRepository, resetRegistry, setAuthRepository, setGalleryRepository, setUserRepository } from "@/domains/registry";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { GalleryView } from "@/views/Gallery";
import type { Page } from "@/api/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type Stubs<R> = { [K in keyof R]?: R[K] };

function withStubs<R extends object>(repository: R, stubs: Stubs<R>): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (prop in stubs) return stubs[prop as keyof R];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as R;
}

/** A structurally valid PNG, as the media repository's magic-byte check wants. */
function pngBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes.buffer as ArrayBuffer;
}

async function signInAsManager(): Promise<void> {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "manager@demo.local", password: DEMO_PASSPHRASE });
}

const FULL_VIEW_LOADING = "در حال باز کردن تالار گالری…";
const PANEL_LOADING = "در حال بارگذاری تصاویر این آلبوم…";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("batch-upload refetch storm", () => {
  it("view: the grid stays on screen across a background refetch", async () => {
    await signInAsManager();
    const held = deferred<Page<never>>();
    let holdReads = false;
    const gallery = getGalleryRepository();
    setGalleryRepository(
      withStubs(gallery, {
        listImages: ((params: unknown, signal?: AbortSignal) =>
          holdReads
            ? (held.promise as unknown as ReturnType<typeof gallery.listImages>)
            : gallery.listImages(params as never, signal)) as typeof gallery.listImages,
      }),
    );

    render(
      <AuthProvider>
        <AppProvider>
          <GalleryView />
        </AppProvider>
      </AuthProvider>,
    );

    // First load settled: a seeded photograph is on the grid.
    const caption = DEMO_GALLERY_PHOTOS[0].caption;
    await screen.findByRole("button", { name: `دیدن تصویر: ${caption}` });
    expect(screen.queryByText(FULL_VIEW_LOADING)).toBeNull();

    // A write anywhere refetches the lists; this read never lands.
    holdReads = true;
    bumpDataVersion();
    await new Promise((resolve) => setTimeout(resolve, 400));

    // The grid is still rendered — no full loading flash per photo.
    expect(screen.queryByText(FULL_VIEW_LOADING)).toBeNull();
    expect(screen.getByRole("button", { name: `دیدن تصویر: ${caption}` })).toBeDefined();

    held.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as unknown as Page<never>);
  });

  it("panel: the album grid stays on screen across a background refetch", async () => {
    // One real image in the first album, so the grid has a row to keep.
    const gallery = getGalleryRepository();
    const albums = (await gallery.listAlbums({ per_page: 100 })).data;
    expect(albums.length).toBeGreaterThan(0);
    const asset = await getMediaRepository().create({
      kind: "image",
      filename: "flash.png",
      mimeType: "image/png",
      bytes: pngBytes(),
    });
    await gallery.addImage({ albumId: albums[0].id, mediaId: asset.id, caption: "تست فلش", alt: "متن جایگزین تست" });

    const held = deferred<Page<never>>();
    let holdReads = false;
    setGalleryRepository(
      withStubs(gallery, {
        listImages: ((params: unknown, signal?: AbortSignal) =>
          holdReads
            ? (held.promise as unknown as ReturnType<typeof gallery.listImages>)
            : gallery.listImages(params as never, signal)) as typeof gallery.listImages,
      }),
    );

    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گالری…")).toBeNull());
    await screen.findByText("تست فلش");

    holdReads = true;
    bumpDataVersion();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText(PANEL_LOADING)).toBeNull();
    expect(screen.getByText("تست فلش")).toBeDefined();

    held.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as unknown as Page<never>);
  });
});
