/**
 * Library domain — the academy's resource catalogue (sheet music, audio,
 * video, handouts) and the files behind it.
 *
 * ARCHITECTURE
 *
 *   View → useLibrary → LibraryRepository → DemoStore | REST
 *
 * A library record is METADATA. The bytes belong to the media domain
 * (`MediaAsset` + blob store), exactly like profile photos and gallery images,
 * and `LibraryItem.mediaId` is the only link between the two. Nothing in this
 * domain — and nothing in `Library.tsx` — knows where bytes live, so swapping
 * the demo blob store for object storage changes one adapter.
 *
 * The entity extends the catalogue `Resource` shape the demo dataset already
 * persists (`DemoDataset.resources`), so the seed, backup validation, export
 * and clearing keep working without a second library model.
 */
import type { ListParams } from "@/api/types";
import type { InstrumentId } from "@/data/academy";
import type { Resource, ResourceKind } from "@/data/records";
import type { MediaAsset } from "@/domains/media/types";

export type { Resource, ResourceKind };
export { resourceKindLabel } from "@/data/records";

/**
 * One catalogue record.
 *
 * `size`, `duration` and `added` are Persian display labels carried by the
 * persisted entity (they predate this domain). `createdAt` is the authoritative
 * timestamp for rows created through the repository; `added` is derived from it
 * so the two can never disagree.
 */
export interface LibraryItem extends Resource {
  /** `MediaAsset.id` of the stored file. Absent = a catalogue row with no file. */
  mediaId?: string;
  /** ISO-8601 creation time, set by the repository on create. */
  createdAt?: string;
}

export interface LibraryListParams extends ListParams {
  kind?: ResourceKind;
  instrument?: InstrumentId;
}

/**
 * A new catalogue row. The file itself is uploaded through the media domain
 * first; this input only references the resulting `MediaAsset.id`.
 */
export interface CreateLibraryItemInput {
  title: string;
  composer?: string;
  kind: ResourceKind;
  instrument: InstrumentId;
  level?: string;
  mediaId?: string;
  pages?: number;
  /** Audio/video length; projected onto the `duration` display label. */
  durationSeconds?: number;
  /** Precomputed waveform peaks for audio (see the media domain). */
  peaks?: number[];
}

export type UpdateLibraryItemInput = Partial<CreateLibraryItemInput>;

/* ------------------------------------------------------------------ */
/* File availability                                                    */
/* ------------------------------------------------------------------ */

/**
 * Where a record's file stands.
 *
 * - `none`    — the row has no `mediaId`: a catalogue entry with no file.
 * - `loading` — resolving metadata/bytes.
 * - `ready`   — metadata AND bytes are present; download is real.
 * - `missing` — metadata exists but the bytes do not. This is a legitimate
 *               state, not an error: a backup restore carries metadata only.
 */
export type LibraryFileStatus = "none" | "loading" | "ready" | "missing";

export interface LibraryFileState {
  status: LibraryFileStatus;
  /** Media metadata, when the row references an asset that exists. */
  asset?: MediaAsset;
  /** The actual bytes, only when `status === "ready"`. */
  blob?: Blob;
  /** Honest, user-facing explanation whenever the file cannot be downloaded. */
  reason?: string;
  downloading: boolean;
  /** Real failure of a download attempt; never a silent no-op. */
  error: string | null;
  /** Triggers a genuine browser download of the stored bytes. */
  download: () => void;
}
