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
import type { InstrumentId } from "@/domains/instruments/types";
import type { MediaAsset } from "@/domains/media/types";
import { evaluateResourceAccess, type ResourceId } from "@/domains/resources/types";

/* ------------------------------------------------------------------ */
/* Catalogue vocabulary — canonical owner (M10)                          */
/*                                                                      */
/* Moved here unchanged from the dissolved fixture module. The library  */
/* domain owns what a resource is and what its kinds are called.        */
/* ------------------------------------------------------------------ */
export type ResourceKind = "sheet" | "audio" | "video" | "doc";
export const resourceKindLabel: Record<ResourceKind, string> = { sheet: "نت", audio: "صوت", video: "ویدیو", doc: "جزوه" };

/**
 * The catalogue record shape the demo dataset persists
 * (`DemoDataset.resources`) — the persisted entity this domain manages.
 */
export interface Resource {
  /** Canonical logical resource id; never a MediaAsset id. */
  id: ResourceId;
  title: string;
  composer: string;
  kind: ResourceKind;
  instrument: InstrumentId;
  level: string;
  size: string;
  duration?: string;
  pages?: number;
  added: string;
  uses: number;
  /** normalized waveform peaks, only for audio */
  peaks?: number[];
}

/**
 * Visibility semantics reused from LearningContent per F1 disposition:
 * publication status uses existing active/visibility semantics, no new workflow.
 * Library visibility is students (public to students) or teachers (staff-facing).
 */
export type LibraryVisibility = "students" | "teachers";

/**
 * One catalogue record.
 *
 * `size`, `duration` and `added` are Persian display labels carried by the
 * persisted entity (they predate this domain). `createdAt` is the authoritative
 * timestamp for rows created through the repository; `added` is derived from it
 * so the two can never disagree.
 *
 * F1: added visibility + active per publication status disposition — uses
 * existing semantics active/visibility from LearningContent, no new workflow.
 */
export interface LibraryItem extends Resource {
  /** `MediaAsset.id` of the stored file. Absent = a catalogue row with no file. */
  mediaId?: string;
  /** ISO-8601 creation time, set by the repository on create. */
  createdAt?: string;
  /** Visibility — students or teachers — per F1 disposition publication status */
  visibility?: LibraryVisibility;
  /**
   * Per-student access restriction, meaningful only while `visibility` is
   * `students`: the item is then accessibly ONLY by the listed students (and by
   * staff managing them). Absent or empty means every student may access it.
   *
   * The academy sets this here; `studentCanAccess` below is the ONE rule both
   * the demo and — per the backend contract — the server evaluate, so a student
   * portal and this panel can never disagree about what a student may see.
   */
  restrictedToStudentIds?: string[];
  /** Active flag — per F1 disposition publication status */
  active?: boolean;
}

export interface LibraryListParams extends ListParams {
  kind?: ResourceKind;
  instrument?: InstrumentId;
  level?: string;
  visibility?: LibraryVisibility;
}

/**
 * A new catalogue row. The file itself is uploaded through the media domain
 * first; this input only references the resulting `MediaAsset.id`.
 *
 * F1: includes visibility + active per publication status disposition.
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
  visibility?: LibraryVisibility;
  active?: boolean;
  /** See `LibraryItem.restrictedToStudentIds`. */
  restrictedToStudentIds?: string[];
}

export type UpdateLibraryItemInput = Partial<CreateLibraryItemInput>;

/**
 * THE ACCESS RULE — pure, so the demo repository, the panel and the future
 * student portal all evaluate the same sentence.
 *
 * A teachers-only item is not a student's to access at all; a students item is
 * theirs unless the academy narrowed it to a list, in which case the list IS
 * the access. An empty list means "not narrowed", never "nobody".
 */
export function studentCanAccess(
  item: Pick<LibraryItem, "visibility" | "restrictedToStudentIds" | "active">,
  studentId: string,
): boolean {
  return evaluateResourceAccess({
    actor: { role: "student", id: studentId },
    hasReadPermission: true,
    subject: {
      active: item.active,
      visibility: item.visibility,
      restrictedToStudentIds: item.restrictedToStudentIds,
    },
  }).allowed;
}

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
  /** The actual bytes, only when `status === \"ready\"`. */
  blob?: Blob;
  /** Honest, user-facing explanation whenever the file cannot be downloaded. */
  reason?: string;
  downloading: boolean;
  /** Real failure of a download attempt; never a silent no-op. */
  error: string | null;
  /** Triggers a genuine browser download of the stored bytes. */
  download: () => void;
}
