// @vitest-environment jsdom
/**
 * Library hooks — the seam `Library.tsx` is allowed to use.
 *
 * Asserted here rather than in the view so the view test can stay about
 * rendering: rows come from `LibraryRepository`, bytes come from
 * `MediaRepository`, and every state the UI can be in (ready / no file /
 * missing bytes / unavailable store / repository failure) is explicit.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { createMemoryBlobStore, getBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { getLibraryRepository, resetRegistry, setLibraryRepository } from "@/domains/registry";
import { createEmptyDataset } from "@/domains/demo/seed";
import {
  DEMO_LIBRARY_ASSET,
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_FILENAME,
  DEMO_LIBRARY_RESOURCE_ID,
  DEMO_LIBRARY_TEXT,
} from "@/domains/demo/librarySeed";
import { demoStore } from "@/services/demoStore";
import { ensureDemoLibraryFile } from "../demoContent";
import type { LibraryRepository } from "../repository";
import type { LibraryListParams } from "../types";
import { useDemoLibraryFile, useLibraryFile, useLibraryList } from "../useLibrary";

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

/** Anchor clicks and object-URL lifecycle, the two halves of a real download. */
let clicks: Array<{ href: string; download: string }>;
let created: string[];
let revoked: string[];

beforeEach(() => {
  localStorage.clear();
  demoStore.reset();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  clicks = [];
  created = [];
  revoked = [];
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:parsian/${created.length}`;
    created.push(url);
    return url;
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  }) as unknown as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useLibraryList", () => {
  it("loads catalogue rows through the registry repository", async () => {
    const { result } = renderHook(() => useLibraryList({ per_page: 200 }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.total).toBeGreaterThan(0);
    expect(result.current.items[0].title.length).toBeGreaterThan(0);
  });

  it("asks the repository for an explicit page size", async () => {
    // `Paged<>` makes omitting per_page a compile error; this pins the runtime
    // value too, so a silent truncation at 25 rows cannot slip in.
    const seen: LibraryListParams[] = [];
    const real = getLibraryRepository();
    setLibraryRepository({
      ...real,
      list: (params: LibraryListParams) => {
        seen.push(params);
        return real.list(params);
      },
    } as unknown as LibraryRepository);

    const { result } = renderHook(() => useLibraryList({ kind: "sheet", per_page: 200 }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(seen.at(-1)).toMatchObject({ per_page: 200, kind: "sheet" });
  });

  it("applies filters and search to the rows it returns", async () => {
    const { result } = renderHook(
      ({ params }: { params: LibraryListParams & { per_page: number } }) => useLibraryList(params),
      { wrapper, initialProps: { params: { kind: "sheet", per_page: 200 } } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.every((row) => row.kind === "sheet")).toBe(true);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it("treats a zero-item catalogue as a valid loaded state", async () => {
    demoStore.replace(createEmptyDataset());

    const { result } = renderHook(() => useLibraryList({ per_page: 200 }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("surfaces a repository failure instead of showing an empty shelf", async () => {
    setLibraryRepository({
      list: () => Promise.reject(new ApiError({ kind: "server", status: 500, message: "کتابخانه در دسترس نیست" })),
    } as unknown as LibraryRepository);

    const { result } = renderHook(() => useLibraryList({ per_page: 200 }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("کتابخانه در دسترس نیست");
    expect(result.current.items).toEqual([]);
  });

  it("shows rows created since the last load", async () => {
    const { result } = renderHook(() => useLibraryList({ per_page: 200 }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.total;

    await getLibraryRepository().create({ title: "نت تازهٔ هوک", kind: "sheet", instrument: "piano" });

    // The persisted write bumps the data version; no cross-view coupling needed.
    await waitFor(() => expect(result.current.total).toBe(before + 1));
    expect(result.current.items.some((row) => row.title === "نت تازهٔ هوک")).toBe(true);
  });
});

describe("useLibraryFile — the demo record", () => {
  it("resolves real metadata and real bytes", async () => {
    await act(async () => {
      await ensureBytes();
    });
    const item = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.asset).toEqual(DEMO_LIBRARY_ASSET);
    expect(result.current.reason).toBeUndefined();
    expect(await result.current.blob?.text()).toBe(DEMO_LIBRARY_TEXT);
  });

  it("reports a catalogue row that has no linked file", async () => {
    const item = await getLibraryRepository().create({ title: "فهرست بدون فایل", kind: "doc", instrument: "theory" });

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("none"));
    expect(result.current.blob).toBeUndefined();
    expect(result.current.reason).toContain("فایل ذخیره‌شده ندارد");
  });

  it("reports missing bytes honestly rather than offering an empty download", async () => {
    // What a metadata-only backup restore leaves behind.
    await ensureBytes();
    await getBlobStore().remove(DEMO_LIBRARY_ASSET_ID);
    const item = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("missing"));
    expect(result.current.asset?.id).toBe(DEMO_LIBRARY_ASSET_ID);
    expect(result.current.blob).toBeUndefined();
    expect(result.current.reason).toContain("موجود نیست");
    expect(result.current.error).toBeNull();
  });

  it("distinguishes a dangling media reference from missing bytes", async () => {
    const item = await getLibraryRepository().create({
      title: "ارجاع ناموجود",
      kind: "sheet",
      instrument: "piano",
    });
    demoStore.resources.update(item.id, { mediaId: "md_does_not_exist" });

    const { result } = renderHook(() => useLibraryFile({ mediaId: "md_does_not_exist" }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("missing"));
    expect(result.current.asset).toBeUndefined();
    expect(result.current.reason).toContain("یافت نشد");
    // The row itself is still readable; only its file is gone.
    expect((await getLibraryRepository().get(item.id)).title).toBe("ارجاع ناموجود");
  });

  it("reports an unavailable blob store as a state, not a crash", async () => {
    setBlobStore({
      async put() {
        throw new Error("IndexedDB is not available");
      },
      async get() {
        throw new Error("IndexedDB is not available");
      },
      async remove() {},
      async clear() {},
    });
    const item = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("missing"));
    // Metadata is still readable from the dataset; only the binary half failed,
    // so the honest reason is "not available in this browser" — and no throw.
    expect(result.current.asset?.id).toBe(DEMO_LIBRARY_ASSET_ID);
    expect(result.current.reason).toContain("موجود نیست");
    expect(result.current.error).toBeNull();
  });
});

describe("useLibraryFile — download", () => {
  it("hands the browser the actual bytes of the stored file", async () => {
    await ensureBytes();
    const item = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.download());

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe(DEMO_LIBRARY_FILENAME);
    expect(clicks[0].href).toBe(created[0]);

    // The URL was built from the retrieved blob — the bytes the store holds.
    const stored = await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID);
    expect(await result.current.blob?.text()).toBe(await stored?.text());
  });

  it("does not revoke the object URL synchronously", async () => {
    // Revoking before the browser has read the blob cancels the download — the
    // failure mode `downloadBlobFile` exists to avoid.
    await ensureBytes();
    const item = await getLibraryRepository().get(DEMO_LIBRARY_RESOURCE_ID);

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.download());

    expect(created).toHaveLength(1);
    expect(revoked).toEqual([]);
  });

  it("invents no URL when there is nothing to download", async () => {
    const item = await getLibraryRepository().create({ title: "بدون فایل", kind: "doc", instrument: "theory" });

    const { result } = renderHook(() => useLibraryFile(item), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("none"));

    act(() => result.current.download());

    expect(clicks).toEqual([]);
    expect(created).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe("useDemoLibraryFile — provisioning", () => {
  it("writes the bytes the dataset cannot carry", async () => {
    // A pure seed has no blob store to write to, so a fresh dataset ships the
    // record's metadata and the hook supplies its bytes.
    await getBlobStore().remove(DEMO_LIBRARY_ASSET_ID);
    expect(await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID)).toBeUndefined();

    renderHook(() => useDemoLibraryFile(), { wrapper });

    await waitFor(async () => {
      expect(await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID)).toBeInstanceOf(Blob);
    });
    const blob = await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID);
    expect(await blob?.text()).toBe(DEMO_LIBRARY_TEXT);
  });

  it("is idempotent across mounts", async () => {
    const first = renderHook(() => useDemoLibraryFile(), { wrapper });
    await waitFor(async () => {
      expect(await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID)).toBeInstanceOf(Blob);
    });
    first.unmount();

    renderHook(() => useDemoLibraryFile(), { wrapper });
    await waitFor(async () => {
      expect(await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID)).toBeInstanceOf(Blob);
    });

    expect(demoStore.media.all()).toHaveLength(1);
    expect((await getLibraryRepository().list({ per_page: 200 })).meta.total).toBeGreaterThan(0);
  });

  it("does not resurrect a catalogue row in an emptied library", async () => {
    demoStore.replace(createEmptyDataset());

    renderHook(() => useDemoLibraryFile(), { wrapper });
    await waitFor(() => expect(demoStore.snapshot().media.length).toBeGreaterThan(0));

    expect((await getLibraryRepository().list({ per_page: 200 })).data).toEqual([]);
  });

  it("never throws when the blob store refuses the write", async () => {
    setBlobStore({
      async put() {
        throw new Error("quota exceeded");
      },
      async get() {
        throw new Error("quota exceeded");
      },
      async remove() {},
      async clear() {},
    });

    const { result } = renderHook(() => {
      useDemoLibraryFile();
      return useLibraryFile({ mediaId: DEMO_LIBRARY_ASSET_ID });
    }, { wrapper });

    // The hook settles; the record is simply reported as unavailable.
    await waitFor(() => expect(result.current.status).toBe("missing"));
  });
});

/**
 * Puts the demo file's bytes where a real session would have them: the metadata
 * is seeded, the binary is provisioned at bootstrap.
 */
async function ensureBytes(): Promise<void> {
  await ensureDemoLibraryFile();
}
