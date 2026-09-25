// @vitest-environment jsdom
/**
 * Gallery image removal — detach the relation, then free the media, through the
 * media domain.
 *
 * Two things changed here and both are worth pinning:
 *
 *   1. ORDER. The image row is removed BEFORE its media is freed. Removing the
 *      row is what makes the asset unreachable; the old code freed first and
 *      relied on counting the remaining rows to notice, which is the same
 *      operation with the reference check inverted.
 *   2. ROUTING. Cleanup goes through `MediaRepository` (metadata AND bytes
 *      together) instead of the repository reaching into the blob store and the
 *      media collection itself — the gallery no longer has a private definition
 *      of what deleting an asset means.
 *
 * The removal is observed through a real `DemoMediaRepository` behind a probe,
 * so "freed" still means the metadata row and the bytes are both gone.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import type { MediaAsset } from "@/domains/media/types";
import { DemoGalleryRepository } from "../demoRepository";
import { getMediaRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
});

async function storePhoto(filename: string): Promise<MediaAsset> {
  return new DemoMediaRepository().create({
    kind: "image",
    filename,
    mimeType: "image/png",
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
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

async function albumWithImage(mediaId: string, caption = "تصویر آزمایشی") {
  const gallery = new DemoGalleryRepository(demoStore, new DemoMediaRepository());
  const album = await gallery.createAlbum({ title: "آلبوم آزمایشی", description: "" });
  const image = await gallery.addImage({ albumId: album.id, mediaId, caption, alt: caption });
  return { album, image };
}

describe("removing a gallery image", () => {
  it("detaches the relation first and frees the media through the media domain", async () => {
    const photo = await storePhoto("recital.png");
    const { image } = await albumWithImage(photo.id);

    const probe: { mediaId: string; rowAlreadyGone: boolean }[] = [];
    const { repo, deleted } = spyingMedia((mediaId) => {
      probe.push({ mediaId, rowAlreadyGone: demoStore.galleryImages.find(image.id) === undefined });
    });
    const gallery = new DemoGalleryRepository(demoStore, repo);

    await gallery.removeImage(image.id);

    expect(deleted).toEqual([photo.id]);
    expect(probe).toEqual([{ mediaId: photo.id, rowAlreadyGone: true }]);
    expect(demoStore.galleryImages.find(image.id)).toBeUndefined();
    // Metadata and bytes go together, through the media repository.
    expect(demoStore.media.find(photo.id)).toBeUndefined();
    expect(await getMediaRepository().getBlob(photo.id)).toBeUndefined();
  });

  it("keeps the media while another image still references it", async () => {
    const photo = await storePhoto("shared.png");
    const { album, image } = await albumWithImage(photo.id);
    const galleryForSetup = new DemoGalleryRepository(demoStore, new DemoMediaRepository());
    await galleryForSetup.addImage({ albumId: album.id, mediaId: photo.id, caption: "نسخهٔ دوم", alt: "نسخهٔ دوم" });

    const { repo, deleted } = spyingMedia();
    const gallery = new DemoGalleryRepository(demoStore, repo);

    await gallery.removeImage(image.id);

    expect(deleted).toEqual([]);
    expect(demoStore.media.find(photo.id)).toBeDefined();
    expect(await getMediaRepository().getBlob(photo.id)).toBeInstanceOf(Blob);
  });

  it("frees each album image's media, after the row, when the album is deleted", async () => {
    const first = await storePhoto("one.png");
    const second = await storePhoto("two.png");
    const { album, image } = await albumWithImage(first.id);
    const galleryForSetup = new DemoGalleryRepository(demoStore, new DemoMediaRepository());
    const other = await galleryForSetup.addImage({ albumId: album.id, mediaId: second.id, caption: "دومی", alt: "دومی" });

    const probe: { mediaId: string; itsRowAlreadyGone: boolean }[] = [];
    const { repo, deleted } = spyingMedia((mediaId) => {
      const row = mediaId === first.id ? image.id : other.id;
      probe.push({ mediaId, itsRowAlreadyGone: demoStore.galleryImages.find(row) === undefined });
    });
    const gallery = new DemoGalleryRepository(demoStore, repo);

    await gallery.deleteAlbum(album.id);

    expect(deleted.sort()).toEqual([first.id, second.id].sort());
    expect(probe.every((entry) => entry.itsRowAlreadyGone)).toBe(true);
    expect(demoStore.galleryAlbums.find(album.id)).toBeUndefined();
    expect(demoStore.media.find(first.id)).toBeUndefined();
    expect(demoStore.media.find(second.id)).toBeUndefined();
  });
});
