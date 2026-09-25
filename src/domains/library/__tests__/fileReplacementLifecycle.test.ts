// @vitest-environment jsdom
/**
 * Library file replacement — the reference-before-cleanup order.
 *
 * Replacing the file of a catalogue row used to leave the superseded asset
 * behind: `update()` re-pointed the row and never looked at what it had stopped
 * referencing, while the success message in the dialog already claimed the
 * previous file was freed "if nothing else references it".
 *
 * The order is the whole point, and it is what these cases pin:
 *
 *   1. the new media is validated first (an unknown id is refused), then the row
 *      is re-pointed, and only then is the previous file a cleanup candidate —
 *      so a refused write can never free the file the row still needs;
 *   2. a file another catalogue row still references survives;
 *   3. a cleanup that fails is reported, never thrown back at the committed write.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import type { MediaAsset } from "@/domains/media/types";
import { DemoLibraryRepository, sizeLabel } from "../demoRepository";
import { getMediaRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

async function storeFile(filename: string, text: string): Promise<MediaAsset> {
  return new DemoMediaRepository().create({
    kind: "document",
    filename,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(text).buffer as ArrayBuffer,
  });
}

/** Real media work, with deletions recorded and probed as they happen. */
function spyingMedia(onDelete?: (mediaId: string) => void) {
  const inner = new DemoMediaRepository();
  const deleted: string[] = [];
  const repo = withStubs(inner, {
    delete: async (id: string) => {
      deleted.push(id);
      onDelete?.(id);
      await inner.delete(id);
    },
  });
  return { repo, deleted };
}

async function catalogueRowWithFile(fileId: string, title = "منبع دارای فایل") {
  const repo = new DemoLibraryRepository(demoStore, new DemoMediaRepository());
  return repo.create({ title, kind: "doc", instrument: "piano", mediaId: fileId });
}

describe("replacing a catalogue file", () => {
  it("re-points the row before freeing the superseded file", async () => {
    const previous = await storeFile("before.txt", "نسخهٔ پیشین");
    const next = await storeFile("after.txt", "نسخهٔ تازه");
    const row = await catalogueRowWithFile(previous.id);

    const probe: { mediaId: string; rowAlreadyRePointed: boolean }[] = [];
    const { repo, deleted } = spyingMedia((mediaId) => {
      probe.push({ mediaId, rowAlreadyRePointed: demoStore.resources.find(row.id)?.mediaId === next.id });
    });
    const library = new DemoLibraryRepository(demoStore, repo);

    const updated = await library.update(row.id, { mediaId: next.id });

    expect(updated.mediaId).toBe(next.id);
    // The measurement follows the file it now carries.
    expect(updated.size).toBe(sizeLabel((await getMediaRepository().get(next.id)).sizeBytes));
    // The old file was freed, and at that moment the row already carried the new one.
    expect(deleted).toEqual([previous.id]);
    expect(probe).toEqual([{ mediaId: previous.id, rowAlreadyRePointed: true }]);
    expect(demoStore.media.find(previous.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(previous.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(next.id)).toBeInstanceOf(Blob);
  });

  it("does not free the current file when the replacement is refused", async () => {
    const previous = await storeFile("kept.txt", "فایل فعلی");
    const row = await catalogueRowWithFile(previous.id);
    const { repo, deleted } = spyingMedia();
    const library = new DemoLibraryRepository(demoStore, repo);

    // An unknown media id is refused by the write-time validation: the row must
    // keep pointing at the file it has, and that file must keep its bytes.
    await expect(library.update(row.id, { mediaId: "md_does_not_exist" })).rejects.toBeInstanceOf(ApiError);

    expect(deleted).toEqual([]);
    expect((await library.get(row.id)).mediaId).toBe(previous.id);
    expect(demoStore.media.find(previous.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(previous.id)).toBeInstanceOf(Blob);
  });

  it("keeps a superseded file another catalogue row still references", async () => {
    const shared = await storeFile("shared.txt", "مشترک بین دو منبع");
    const first = await catalogueRowWithFile(shared.id, "نسخهٔ اول");
    await catalogueRowWithFile(shared.id, "نسخهٔ دوم");
    const next = await storeFile("second-copy.txt", "فایل تازه");
    const { repo, deleted } = spyingMedia();
    const library = new DemoLibraryRepository(demoStore, repo);

    await library.update(first.id, { mediaId: next.id });

    // The row moved on, but the other row still shows the shared file.
    expect(deleted).toEqual([]);
    expect(demoStore.media.find(shared.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(shared.id)).toBeInstanceOf(Blob);
  });

  it("reports a failed cleanup instead of failing the committed write", async () => {
    const previous = await storeFile("stuck.txt", "آزاد نمی‌شود");
    const next = await storeFile("next.txt", "نسخهٔ تازه");
    const row = await catalogueRowWithFile(previous.id, "منبع با فایل چسبنده");
    const failing = withStubs(new DemoMediaRepository(), {
      delete: async () => {
        throw new ApiError({ kind: "server", code: "MEDIA_STORAGE_FAILED", message: "ذخیره‌سازی پاسخ نداد." });
      },
    });
    const library = new DemoLibraryRepository(demoStore, failing);

    const updated = await library.update(row.id, { mediaId: next.id });

    // The write stands — it is what the operator asked for and it succeeded.
    expect(updated.mediaId).toBe(next.id);
    expect((await library.get(row.id)).mediaId).toBe(next.id);
    // The superseded file simply remains; the failure was not swallowed, it was
    // returned by the media domain and reported (see mediaOwnershipTransition).
    expect(demoStore.media.find(previous.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(previous.id)).toBeInstanceOf(Blob);
  });
});
