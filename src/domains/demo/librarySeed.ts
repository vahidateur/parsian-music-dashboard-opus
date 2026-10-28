/**
 * Demo library seed — the deterministic file that ships with the demo dataset.
 *
 * WHERE THE BYTES LIVE (W2)
 *
 * The file's content used to be a string literal in THIS module, which made
 * TypeScript the only home of a piece of the dataset. It now lives in the
 * dataset artifact — `data/dataset/assets/nocturne-op9-no2.txt` — and this
 * module REFERENCES it (`?raw`), so there is one copy of those bytes in the
 * repository instead of a literal and its copy. `demoLibraryFileBytes()` is
 * byte-identical to before the move (asserted by the W2 equivalence suite, which
 * pins the file's sha256), and so is `DEMO_LIBRARY_TEXT`, which existing suites
 * (library repository, `useLibrary`, `Library.tsx`) compare against.
 *
 * Pure data and pure functions only: this module is imported by `seed.ts`, so
 * it must not touch the store, the blob store or React. Writing the file's
 * bytes INto the blob store is a separate, explicit step owned by
 * `@/domains/library/demoContent.ts` (`ensureDemoLibraryFile`).
 *
 * WHY THE BYTES ARE NOT IN THE DATASET
 *
 * `createSeedDataset()` is synchronous and pure, and binaries never live in the
 * dataset (see `domains/media/types.ts`). So the seed carries the file's
 * METADATA and the link from the catalogue row, while the bytes are provisioned
 * into the blob store at bootstrap. A record whose bytes have not landed yet is
 * a legitimate, documented state — the same one a backup restore produces — and
 * the Library UI reports it honestly instead of offering a dead download.
 */
/* The bytes: the artifact is their canonical home (see DEMO_LIBRARY_ASSET_FILE). */
import libraryText from "../../../data/dataset/assets/nocturne-op9-no2.txt?raw";
import type { MediaAsset } from "@/domains/media/types";
import type { LibraryItem } from "@/domains/library/types";

/** The catalogue row the demo file belongs to. */
export const DEMO_LIBRARY_RESOURCE_ID = "res1";

/** Stable media id, so a reset/restore re-provisions the same asset. */
export const DEMO_LIBRARY_ASSET_ID = "md_demo_res1";

export const DEMO_LIBRARY_FILENAME = "nocturne-op9-no2.txt";

export const DEMO_LIBRARY_MIME_TYPE = "text/plain";

/** Fixed timestamp: the demo dataset is deterministic by construction. */
export const DEMO_LIBRARY_CREATED_AT = "2026-09-01T00:00:00.000Z";

/**
 * Where the file's bytes live inside the dataset artifact
 * (`data/dataset/<this>`). The generator records exactly this path in
 * `assets/assets.json`, and the W2 suite asserts that the bytes this module
 * serves ARE the bytes at that path — so the reference cannot rot.
 */
export const DEMO_LIBRARY_ASSET_FILE = `assets/${DEMO_LIBRARY_FILENAME}`;

/**
 * The file's real content — a plain-text study sheet for the seeded score.
 * Genuine bytes a user can open, not a placeholder pretending to be a file.
 *
 * Same value as before W2: the text is read from the artifact now, but it is
 * still THIS exact constant that the library repository, the hook and the view
 * suite compare against (`nocturne-op9-no2.txt` is its canonical copy).
 */
export const DEMO_LIBRARY_TEXT: string = libraryText;

/** Encoded once; `Blob` copies the bytes, so the buffer can be shared safely. */
const ENCODED = new TextEncoder().encode(DEMO_LIBRARY_TEXT);

/** The demo file's actual bytes. */
export function demoLibraryFileBytes(): ArrayBuffer {
  return ENCODED.buffer.slice(ENCODED.byteOffset, ENCODED.byteOffset + ENCODED.byteLength) as ArrayBuffer;
}

/** Metadata row for the demo file: small, serializable, backup-safe. */
export const DEMO_LIBRARY_ASSET: MediaAsset = {
  id: DEMO_LIBRARY_ASSET_ID,
  kind: "document",
  filename: DEMO_LIBRARY_FILENAME,
  mimeType: DEMO_LIBRARY_MIME_TYPE,
  sizeBytes: ENCODED.byteLength,
  createdAt: DEMO_LIBRARY_CREATED_AT,
};

/**
 * Attaches the demo file to its catalogue row.
 *
 * The row and the asset are derived from one module so the shipped dataset is
 * self-consistent by construction; every other row passes through untouched.
 */
export function withDemoLibraryFile(rows: readonly LibraryItem[]): LibraryItem[] {
  return rows.map((row) =>
    row.id === DEMO_LIBRARY_RESOURCE_ID ? { ...row, mediaId: DEMO_LIBRARY_ASSET_ID } : { ...row },
  );
}
