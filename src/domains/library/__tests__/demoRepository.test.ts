// @vitest-environment jsdom
/**
 * Library repository + the demo file behind it.
 *
 * The claims that matter:
 *   - rows come from the persisted catalogue, not from a fixture import;
 *   - an empty catalogue is a valid state;
 *   - the seeded demo row references a real media asset with real bytes, and
 *     those bytes are retrievable through the media abstraction;
 *   - a record whose bytes are missing is reported as missing, not faked.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { createMemoryBlobStore, getBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { resetRegistry } from "@/domains/registry";
import {
  DEMO_LIBRARY_ASSET,
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_FILENAME,
  DEMO_LIBRARY_RESOURCE_ID,
  DEMO_LIBRARY_TEXT,
  demoLibraryFileBytes,
} from "@/domains/demo/librarySeed";
import { createEmptyDataset } from "@/domains/demo/seed";
import { demoStore } from "@/services/demoStore";
import { ensureDemoLibraryFile } from "../demoContent";
import { DemoLibraryRepository, addedLabel, durationLabel, sizeLabel } from "../demoRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoLibraryRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  repo = new DemoLibraryRepository();
});

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

describe("catalogue reads", () => {
  it("returns Resource records from the persisted catalogue", async () => {
    const page = await repo.list({ per_page: 200 });

    expect(page.meta.total).toBeGreaterThan(0);
    const row = page.data[0];
    // The domain entity, not a wire shape: title, kind, instrument and level.
    expect(typeof row.id).toBe("string");
    expect(row.title.length).toBeGreaterThan(0);
    expect(["sheet", "audio", "video", "doc"]).toContain(row.kind);
    expect(row.instrument.length).toBeGreaterThan(0);
  });

  it("reads what the store holds, not a fixture constant", async () => {
    const before = (await repo.list({ per_page: 200 })).meta.total;

    const created = await repo.create({
      title: "نت آزمایشی کتابخانه",
      composer: "مدرس دمو",
      kind: "sheet",
      instrument: "piano",
      level: "میانی",
    });
    expect((await repo.list({ per_page: 200 })).meta.total).toBe(before + 1);

    await repo.delete(created.id);
    expect((await repo.list({ per_page: 200 })).meta.total).toBe(before);
  });

  it("filters by kind, instrument and search", async () => {
    const sheets = await repo.list({ kind: "sheet", per_page: 200 });
    expect(sheets.data.every((row) => row.kind === "sheet")).toBe(true);

    const piano = await repo.list({ instrument: "piano", per_page: 200 });
    expect(piano.data.every((row) => row.instrument === "piano")).toBe(true);

    const search = await repo.list({ search: "شوپن", per_page: 200 });
    expect(search.meta.total).toBeGreaterThan(0);
    expect(search.data.every((row) => `${row.title}${row.composer}`.includes("شوپن"))).toBe(true);
  });

  it("treats an empty catalogue as a valid state", async () => {
    demoStore.replace(createEmptyDataset());

    const page = await repo.list({ per_page: 200 });
    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
  });

  it("reports a missing record as not found", async () => {
    await expect(repo.get("res-does-not-exist")).rejects.toMatchObject({
      kind: "not_found",
      code: "LIBRARY_ITEM_NOT_FOUND",
    });
  });
});

describe("the seeded demo file", () => {
  it("has valid metadata for the demo row", async () => {
    const row = await repo.get(DEMO_LIBRARY_RESOURCE_ID);

    expect(row.id).toBe(DEMO_LIBRARY_RESOURCE_ID);
    expect(row.title.length).toBeGreaterThan(0);
    expect(row.kind).toBe("sheet");
    expect(row.size.length).toBeGreaterThan(0);
  });

  it("references a real media asset", async () => {
    const row = await repo.get(DEMO_LIBRARY_RESOURCE_ID);
    expect(row.mediaId).toBe(DEMO_LIBRARY_ASSET_ID);

    const asset = await new DemoMediaRepository().get(DEMO_LIBRARY_ASSET_ID);
    expect(asset).toEqual(DEMO_LIBRARY_ASSET);
    expect(asset.kind).toBe("document");
    expect(asset.mimeType).toBe("text/plain");
    expect(asset.filename).toBe(DEMO_LIBRARY_FILENAME);
    expect(asset.sizeBytes).toBeGreaterThan(0);
  });

  it("provisions the actual bytes, retrievable through the media abstraction", async () => {
    const result = await ensureDemoLibraryFile();
    expect(result.status).toBe("created");
    expect(result.bytesWritten).toBe(true);

    // Read back through the media domain — the same call the download makes.
    const blob = await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(DEMO_LIBRARY_ASSET.sizeBytes);
    expect(await blob?.text()).toBe(DEMO_LIBRARY_TEXT);
  });

  it("is idempotent: a second provisioning writes nothing", async () => {
    await ensureDemoLibraryFile();
    const second = await ensureDemoLibraryFile();

    expect(second.status).toBe("present");
    expect(second.bytesWritten).toBe(false);
    expect(second.metadataWritten).toBe(false);
    expect(second.linked).toBe(false);
    // Still exactly one asset: no duplicates, no orphans.
    expect(demoStore.media.all()).toHaveLength(1);
  });

  it("re-links the demo row when a persisted dataset predates the link", async () => {
    // Simulates a dataset whose catalogue row exists but has no mediaId.
    demoStore.resources.update(DEMO_LIBRARY_RESOURCE_ID, { mediaId: undefined });
    demoStore.media.remove(DEMO_LIBRARY_ASSET_ID);
    expect((await repo.get(DEMO_LIBRARY_RESOURCE_ID)).mediaId).toBeUndefined();

    const result = await ensureDemoLibraryFile();

    expect(result.metadataWritten).toBe(true);
    expect(result.linked).toBe(true);
    expect((await repo.get(DEMO_LIBRARY_RESOURCE_ID)).mediaId).toBe(DEMO_LIBRARY_ASSET_ID);
  });

  it("never invents a catalogue row for an environment that has none", async () => {
    // An emptied library stays empty: provisioning writes the file, not a row.
    demoStore.replace(createEmptyDataset());

    const result = await ensureDemoLibraryFile();

    expect(result.linked).toBe(false);
    expect((await repo.list({ per_page: 200 })).data).toEqual([]);
  });

  it("reports an unavailable blob store honestly instead of throwing", async () => {
    setBlobStore({
      async put() {
        throw new Error("IndexedDB quota exceeded");
      },
      async get() {
        throw new Error("IndexedDB quota exceeded");
      },
      async remove() {},
      async clear() {},
    });

    const result = await ensureDemoLibraryFile();
    expect(result.status).toBe("unavailable");
    expect(result.reason).toContain("quota");
  });

  it("exposes bytes that are real, deterministic and self-contained", () => {
    const bytes = demoLibraryFileBytes();
    expect(bytes.byteLength).toBe(DEMO_LIBRARY_ASSET.sizeBytes);
    expect(new TextDecoder().decode(bytes)).toBe(DEMO_LIBRARY_TEXT);
    // Deterministic across calls: the demo dataset is reproducible.
    expect(new TextDecoder().decode(demoLibraryFileBytes())).toBe(DEMO_LIBRARY_TEXT);
    expect(bytes.byteLength).toBeGreaterThan(200);
  });
});

describe("missing bytes are honest, not faked", () => {
  it("leaves metadata readable while the blob is absent", async () => {
    // The state a backup restore produces: metadata without binaries.
    await getBlobStore().remove(DEMO_LIBRARY_ASSET_ID);

    const asset = await new DemoMediaRepository().get(DEMO_LIBRARY_ASSET_ID);
    expect(asset.id).toBe(DEMO_LIBRARY_ASSET_ID);
    expect(await new DemoMediaRepository().getBlob(DEMO_LIBRARY_ASSET_ID)).toBeUndefined();
  });

  it("reports a dangling reference as a validation error on write", async () => {
    const fields = await fieldsOf(
      repo.create({
        title: "نت با فایل ناموجود",
        kind: "sheet",
        instrument: "piano",
        mediaId: "md_does_not_exist",
      }),
    );
    expect(fields).toHaveProperty("mediaId");
  });
});

describe("catalogue writes", () => {
  it("creates a row with measurements derived from the real file", async () => {
    const media = new DemoMediaRepository();
    const asset = await media.create({
      kind: "document",
      filename: "etude-notes.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("یادداشت‌های تمرین").buffer as ArrayBuffer,
    });

    const created = await repo.create({
      title: "یادداشت‌های اتود",
      composer: "مدرس پیانو",
      kind: "doc",
      instrument: "piano",
      level: "میانی",
      mediaId: asset.id,
    });

    expect(created.id).toBeTruthy();
    expect(created.uses).toBe(0);
    expect(created.mediaId).toBe(asset.id);
    // The size label is the asset's real byte length, not a constant.
    expect(created.size).toBe(sizeLabel(asset.sizeBytes));
    expect(created.createdAt).toBeTruthy();
    expect(created.added).toBe(addedLabel(created.createdAt as string));

    // Genuinely persisted: a fresh repository instance reads it back.
    expect(await new DemoLibraryRepository().get(created.id)).toMatchObject({ title: "یادداشت‌های اتود" });
  });

  it("creates a catalogue-only row and says the size is unknown", async () => {
    const created = await repo.create({ title: "فهرست منابع", kind: "doc", instrument: "theory" });
    expect(created.mediaId).toBeUndefined();
    expect(created.size).toBe("نامشخص");
  });

  it("rejects an invalid row without writing anything", async () => {
    const before = (await repo.list({ per_page: 200 })).meta.total;

    expect(await fieldsOf(repo.create({ title: "x", kind: "sheet", instrument: "piano" }))).toHaveProperty("title");
    expect(
      await fieldsOf(repo.create({ title: "نت معتبر", kind: "sheet", instrument: "not-an-instrument" })),
    ).toHaveProperty("instrument");
    expect(
      await fieldsOf(repo.create({ title: "نت معتبر", kind: "sheet", instrument: "piano", pages: -3 })),
    ).toHaveProperty("pages");

    expect((await repo.list({ per_page: 200 })).meta.total).toBe(before);
  });

  it("updates a row and re-measures the size when the file changes", async () => {
    const media = new DemoMediaRepository();
    const asset = await media.create({
      kind: "document",
      filename: "revision.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("نسخهٔ بازبینی‌شده").buffer as ArrayBuffer,
    });

    const created = await repo.create({ title: "نت اولیه", kind: "sheet", instrument: "piano" });
    expect(created.size).toBe("نامشخص");

    const updated = await repo.update(created.id, { title: "نت بازبینی‌شده", mediaId: asset.id });
    expect(updated.title).toBe("نت بازبینی‌شده");
    expect(updated.mediaId).toBe(asset.id);
    expect(updated.size).toBe(sizeLabel(asset.sizeBytes));
  });

  it("deletes a row and frees a file nothing else references", async () => {
    const media = new DemoMediaRepository();
    const asset = await media.create({
      kind: "document",
      filename: "single-use.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("تنها یک ارجاع").buffer as ArrayBuffer,
    });
    const created = await repo.create({ title: "نت موقت", kind: "sheet", instrument: "piano", mediaId: asset.id });

    await repo.delete(created.id);

    await expect(repo.get(created.id)).rejects.toBeInstanceOf(ApiError);
    // Metadata and bytes go together; no orphan blob is left behind.
    expect(demoStore.media.find(asset.id)).toBeUndefined();
    expect(await media.getBlob(asset.id)).toBeUndefined();
  });

  it("keeps a file another row still references", async () => {
    const media = new DemoMediaRepository();
    const asset = await media.create({
      kind: "document",
      filename: "shared.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("مشترک بین دو منبع").buffer as ArrayBuffer,
    });
    const first = await repo.create({ title: "نسخهٔ اول", kind: "sheet", instrument: "piano", mediaId: asset.id });
    await repo.create({ title: "نسخهٔ دوم", kind: "sheet", instrument: "piano", mediaId: asset.id });

    await repo.delete(first.id);

    expect(demoStore.media.find(asset.id)).toBeDefined();
    expect(await media.getBlob(asset.id)).toBeInstanceOf(Blob);
  });
});

describe("display projections", () => {
  it("formats sizes in the catalogue's own vocabulary", () => {
    expect(sizeLabel(512)).toBe("۵۱۲ بایت");
    expect(sizeLabel(2048)).toBe("۲ کیلوبایت");
    expect(sizeLabel(1.5 * 1024 * 1024)).toBe("۱٫۵ مگابایت");
    expect(sizeLabel(0)).toBe("نامشخص");
  });

  it("formats durations as m:ss with Persian digits", () => {
    expect(durationLabel(252)).toBe("۴:۱۲");
    expect(durationLabel(5)).toBe("۰:۰۵");
    expect(durationLabel(0)).toBe("۰:۰۰");
  });

  it("derives the added label from a real timestamp", () => {
    expect(addedLabel(new Date().toISOString())).toBe("امروز");
    expect(addedLabel(new Date(Date.now() - 86_400_000).toISOString())).toBe("دیروز");
    expect(addedLabel(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe("۳ روز پیش");
  });
});
