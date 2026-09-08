/**
 * Demo library file provisioning — DEMO DATA, isolated on purpose.
 *
 * The demo dataset carries the file's metadata (`domains/demo/librarySeed.ts`)
 * but cannot carry its bytes: `createSeedDataset()` is pure and synchronous,
 * and binaries live in the blob store. Writing them is therefore an explicit,
 * idempotent step performed at bootstrap.
 *
 * Everything the demo needs to materialize that file is behind ONE function.
 * Nothing in `Library.tsx`, the repository or the hook knows the file exists,
 * so the lifecycle phase can make this DEMO-only — or skip it entirely for an
 * empty environment — by gating a single call site rather than rewriting the
 * Library domain.
 *
 * The function is total: it reports what it did and never throws, because a
 * blob store that cannot serve bytes (no IndexedDB, private mode, quota) must
 * degrade to an honest "file unavailable" state in the UI, not break boot.
 */
import {
  DEMO_LIBRARY_ASSET,
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_MIME_TYPE,
  DEMO_LIBRARY_RESOURCE_ID,
  demoLibraryFileBytes,
} from "@/domains/demo/librarySeed";
import { getBlobStore, type BlobStore } from "@/domains/media/blobStore";
import { demoStore, type DemoStore } from "@/services/demoStore";

export interface DemoFileProvisionResult {
  /** `present` = nothing to do; `created` = something was written; `unavailable` = could not. */
  status: "present" | "created" | "unavailable";
  bytesWritten: boolean;
  metadataWritten: boolean;
  linked: boolean;
  /** Why provisioning could not finish, when it could not. */
  reason?: string;
}

/**
 * Makes the demo file really exist: metadata row, bytes, and the link from the
 * catalogue row. Every step is idempotent, so this is safe on each boot and
 * safe after a reset, a restore or an import.
 *
 * LIFECYCLE: this is demo content. The CALLER decides when it should run.
 */
export async function ensureDemoLibraryFile(
  store: DemoStore = demoStore,
  blobs: BlobStore = getBlobStore(),
): Promise<DemoFileProvisionResult> {
  let bytesWritten = false;
  let metadataWritten = false;
  let linked = false;

  // 1. Metadata. An explicit id is honoured by the store, so re-provisioning
  //    after a reset reuses the same asset instead of accumulating orphans.
  if (!store.media.find(DEMO_LIBRARY_ASSET_ID)) {
    store.media.create({ ...DEMO_LIBRARY_ASSET });
    metadataWritten = true;
  }

  // 2. Bytes. Size-checked rather than merely exists-checked: a truncated blob
  //    left behind by a quota error is rewritten instead of served as valid.
  try {
    const existing = await blobs.get(DEMO_LIBRARY_ASSET_ID);
    if (!existing || existing.size !== DEMO_LIBRARY_ASSET.sizeBytes) {
      await blobs.put(DEMO_LIBRARY_ASSET_ID, demoLibraryFileBytes(), DEMO_LIBRARY_MIME_TYPE);
      bytesWritten = true;
    }
  } catch (cause) {
    return {
      status: "unavailable",
      bytesWritten,
      metadataWritten,
      linked,
      reason: cause instanceof Error ? cause.message : "فضای ذخیره‌سازی فایل در دسترس نیست.",
    };
  }

  // 3. Link. Only an EXISTING row is linked: a library the user emptied stays
  //    empty, because inventing a catalogue row here would push demo data into
  //    an environment that does not have it.
  const row = store.resources.find(DEMO_LIBRARY_RESOURCE_ID);
  if (row && row.mediaId !== DEMO_LIBRARY_ASSET_ID) {
    store.resources.update(row.id, { mediaId: DEMO_LIBRARY_ASSET_ID });
    linked = true;
  }

  return {
    status: bytesWritten || metadataWritten || linked ? "created" : "present",
    bytesWritten,
    metadataWritten,
    linked,
  };
}
