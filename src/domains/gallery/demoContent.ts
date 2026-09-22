/**
 * Demo gallery provisioning — DEMO DATA, isolated on purpose.
 *
 * The seed carries the photographs' METADATA (`domains/demo/gallerySeed`); the
 * bytes ship as bundled assets and are written into the blob store here, at
 * bootstrap, exactly like the demo library file. Same shape as a real backend:
 * metadata in the dataset, bytes in object storage.
 *
 * The function is total — it reports what it did and never throws — because a
 * blob store that cannot serve bytes (no IndexedDB, private mode, quota) must
 * degrade to an honest "image unavailable" state in the gallery, not break boot.
 * It creates nothing: rows come from the seed, so a gallery the operator emptied
 * stays empty.
 */
import { DEMO_GALLERY_PHOTOS } from "@/domains/demo/gallerySeed";
import { getBlobStore, type BlobStore } from "@/domains/media/blobStore";
import { demoStore, type DemoStore } from "@/services/demoStore";

export interface DemoGalleryProvisionResult {
  /** `present` = nothing to do; `created` = bytes were written; `unavailable` = could not. */
  status: "present" | "created" | "unavailable";
  written: number;
  /** Why provisioning could not finish, when it could not. */
  reason?: string;
}

export async function ensureDemoGalleryBytes(
  store: DemoStore = demoStore,
  blobs: BlobStore = getBlobStore(),
): Promise<DemoGalleryProvisionResult> {
  let written = 0;
  try {
    for (const photo of DEMO_GALLERY_PHOTOS) {
      // Rows deleted by the operator are respected: nothing is re-created here.
      if (!store.media.find(photo.mediaId)) continue;
      const existing = await blobs.get(photo.mediaId);
      if (existing && existing.size > 0) continue;

      const response = await fetch(photo.url);
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0) continue;
      await blobs.put(photo.mediaId, bytes, "image/jpeg");
      written += 1;
    }
  } catch (cause) {
    return {
      status: "unavailable",
      written,
      reason: cause instanceof Error ? cause.message : "فضای ذخیره‌سازی تصویر در دسترس نیست.",
    };
  }
  return { status: written > 0 ? "created" : "present", written };
}
