/**
 * Media domain — the storage boundary for every binary the product handles
 * (profile photos, instrument images, gallery images, library audio).
 *
 * ARCHITECTURE DECISION — binaries never live in the DemoStore.
 *
 * The DemoStore serializes the whole dataset to one `localStorage` key on every
 * write. Putting base64 images there would (a) blow the ~5 MB quota after a
 * handful of uploads, (b) make every unrelated write re-serialize megabytes,
 * and (c) bloat every backup JSON. The brief also states explicitly that
 * production binaries must not go to localStorage.
 *
 * So the model is a two-part split, identical in shape to how a real backend
 * works:
 *
 *   metadata (small, structured)  → DemoStore / API      → `MediaAsset`
 *   bytes    (large, opaque)      → IndexedDB / object storage
 *
 * Domain records reference `MediaAsset.id` only. Swapping the demo blob store
 * for S3/MinIO changes one adapter and no domain code.
 *
 * BACKEND REQUIRED: production needs object storage with signed, expiring URLs,
 * server-side content-type sniffing (never trust the client's declared type),
 * virus scanning, and per-object authorization. The demo validates what a
 * browser can validate and no more — it is not a security boundary.
 */
import type { ListParams } from "@/api/types";

/** What a stored binary is used for; drives validation limits and UI. */
export type MediaKind = "image" | "audio" | "document";

/**
 * Metadata for one stored binary. Small enough to live in the dataset and to
 * appear in a backup; the bytes themselves are addressed by `id`.
 */
export interface MediaAsset {
  id: string;
  kind: MediaKind;
  /**
   * Sanitized display name. Never used to build a filesystem path — see
   * `safeFilename` in the import domain for the same rule on the way out.
   */
  filename: string;
  /** Validated MIME type from the allow-list, not the browser's raw claim. */
  mimeType: string;
  sizeBytes: number;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Image pixel dimensions when known; absent for audio/documents. */
  width?: number;
  height?: number;
  /** Audio duration in seconds when known. */
  durationSeconds?: number;
  /**
   * Precomputed normalized waveform peaks (0..1) for audio.
   * Computed once at upload so the player never decodes the file to draw.
   */
  peaks?: number[];
}

export interface MediaListParams extends ListParams {
  kind?: MediaKind;
  search?: string;
}

/** Everything needed to store a new binary plus its metadata. */
export interface CreateMediaInput {
  kind: MediaKind;
  filename: string;
  mimeType: string;
  /** The raw bytes. The blob store owns these; the dataset never sees them. */
  bytes: ArrayBuffer;
  width?: number;
  height?: number;
  durationSeconds?: number;
  peaks?: number[];
}

/* ------------------------------------------------------------------ */
/* Validation policy                                                    */
/* ------------------------------------------------------------------ */

/**
 * Allow-listed image types. SVG is deliberately EXCLUDED: it is an XML
 * document that can carry `<script>`, and rendering user-supplied SVG from a
 * blob URL is a stored-XSS vector.
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"] as const;

/**
 * Allow-listed document types.
 *
 * `text/plain` is included because a music library legitimately holds plain-text
 * material (study notes, lyric sheets, fingering annotations) — the seeded demo
 * file is one. It is not a script container: unlike SVG, which stays EXCLUDED
 * because it is an XML document that can carry `<script>`, a text file rendered
 * as text cannot execute. It has no magic-byte signature, so validation falls
 * back to the declared type having passed this allow-list (see `SIGNATURES` in
 * `demoRepository.ts`).
 */
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "text/plain"] as const;

/** Per-kind size ceilings. Rejected before any read, not after. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function allowedTypesFor(kind: MediaKind): readonly string[] {
  switch (kind) {
    case "image":
      return ALLOWED_IMAGE_TYPES;
    case "audio":
      return ALLOWED_AUDIO_TYPES;
    case "document":
      return ALLOWED_DOCUMENT_TYPES;
  }
}

export function maxBytesFor(kind: MediaKind): number {
  switch (kind) {
    case "image":
      return MAX_IMAGE_BYTES;
    case "audio":
      return MAX_AUDIO_BYTES;
    case "document":
      return MAX_DOCUMENT_BYTES;
  }
}
