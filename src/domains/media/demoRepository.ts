/**
 * Demo media repository — validates uploads, stores bytes in the blob store
 * and metadata in the DemoStore.
 *
 * SECURITY (§24)
 *  - Type allow-list per kind; SVG is excluded because it can execute script.
 *  - The declared MIME type is cross-checked against the file's magic bytes,
 *    so renaming `evil.html` to `photo.png` does not get it treated as an image.
 *  - Size ceilings are enforced before the bytes are stored.
 *  - Filenames are sanitized: no directory separators, no control characters,
 *    no leading dots, length-capped. They are display strings, never paths.
 *
 * None of this is a substitute for server-side validation. A browser check can
 * be bypassed entirely; production must re-validate and scan (documented in
 * the production handoff).
 */
import type { Page } from "@/api/types";
import { matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { getBlobStore, type BlobStore } from "./blobStore";
import type { MediaRepository } from "./repository";
import {
  allowedTypesFor,
  maxBytesFor,
  type CreateMediaInput,
  type MediaAsset,
  type MediaListParams,
} from "./types";

/**
 * Magic-byte signatures for the formats we accept.
 * `undefined` means "no reliable prefix" (e.g. some audio containers), in which
 * case we fall back to the declared type having passed the allow-list.
 */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/gif": (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  "image/webp": (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
};

/**
 * Strips everything that could turn a display name into a path or a control
 * sequence. Mirrors `safeFilename` in the import domain.
 */
export function sanitizeFilename(raw: string): string {
  const base = raw
    .replace(/[\\/]/g, "_")
    // eslint-disable-next-line no-control-regex -- deliberately stripping C0 controls
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  const cleaned = base.length > 0 ? base : "file";
  return cleaned.slice(0, 120);
}

export class DemoMediaRepository implements MediaRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly blobs: BlobStore = getBlobStore(),
  ) {}

  async list(params: MediaListParams = {}): Promise<Page<MediaAsset>> {
    const rows = this.store.media.all().filter((row) => {
      if (params.kind && row.kind !== params.kind) return false;
      return matchesQuery([row.filename], params.search);
    });
    return paginate(rows, params);
  }

  async get(id: string): Promise<MediaAsset> {
    const found = this.store.media.find(id);
    if (!found) throw notFound("MEDIA_NOT_FOUND", `فایل با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async create(input: CreateMediaInput): Promise<MediaAsset> {
    const allowed = allowedTypesFor(input.kind);
    const fields: Record<string, string[]> = {};

    if (!allowed.includes(input.mimeType)) {
      fields.mimeType = [`قالب مجاز نیست. قالب‌های مجاز: ${allowed.join("، ")}`];
    }
    const max = maxBytesFor(input.kind);
    if (input.bytes.byteLength === 0) {
      fields.bytes = ["فایل خالی است."];
    } else if (input.bytes.byteLength > max) {
      fields.bytes = [`حجم فایل بیش از حد مجاز است (حداکثر ${Math.floor(max / (1024 * 1024))} مگابایت).`];
    }

    // Content sniffing: the declared type must match the actual bytes.
    const check = SIGNATURES[input.mimeType];
    if (!fields.mimeType && !fields.bytes && check) {
      const head = new Uint8Array(input.bytes.slice(0, 16));
      if (!check(head)) {
        fields.bytes = ["محتوای فایل با قالب اعلام‌شده هم‌خوان نیست."];
      }
    }

    if (Object.keys(fields).length) {
      throw validationError("MEDIA_INVALID", "فایل انتخاب‌شده معتبر نیست.", fields);
    }

    // Metadata first so the id exists, then the bytes. If the blob write fails
    // the metadata row is rolled back rather than left dangling.
    const asset = this.store.media.create({
      kind: input.kind,
      filename: sanitizeFilename(input.filename),
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      createdAt: new Date().toISOString(),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
      ...(input.peaks ? { peaks: input.peaks } : {}),
    });

    try {
      await this.blobs.put(asset.id, input.bytes, input.mimeType);
    } catch (cause) {
      this.store.media.remove(asset.id);
      throw validationError("MEDIA_STORAGE_FAILED", "ذخیرهٔ فایل ناموفق بود.", {
        bytes: [cause instanceof Error ? cause.message : "خطای نامشخص در ذخیره‌سازی."],
      });
    }
    return asset;
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.blobs.remove(id);
    this.store.media.remove(id);
  }

  async getBlob(id: string): Promise<Blob | undefined> {
    return this.blobs.get(id);
  }
}
