/**
 * Demo library repository — adapts the DemoStore to the domain contract.
 *
 * It owns NO persistence and NO binaries:
 *   - rows live in `DemoDataset.resources`, written through the store's
 *     collection API like every other domain;
 *   - files live in the media domain, referenced by `mediaId` and validated
 *     against `DemoDataset.media` on the way in.
 *
 * Display labels (`size`, `duration`, `added`) are projected here from real
 * values — the linked asset's byte length, the declared duration, the creation
 * timestamp — so a created row shows measurements that came from somewhere,
 * never a constant (§38).
 */
import type { Page } from "@/api/types";
import { faNum } from "@/lib/format";
import { matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import type { MediaRepository } from "@/domains/media/repository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { LibraryRepository } from "./repository";
import type { CreateLibraryItemInput, LibraryItem, LibraryListParams, UpdateLibraryItemInput } from "./types";

/** Size label for a row with no file: unknown, and said so. */
const UNKNOWN_SIZE = "نامشخص";

export class DemoLibraryRepository implements LibraryRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    /** Bytes and their metadata belong to the media domain, never to us. */
    private readonly media: MediaRepository = new DemoMediaRepository(),
  ) {}

  async list(params: LibraryListParams = {}): Promise<Page<LibraryItem>> {
    const rows = this.store.resources.all().filter((row) => {
      if (params.kind && row.kind !== params.kind) return false;
      if (params.instrument && row.instrument !== params.instrument) return false;
      return matchesQuery([row.title, row.composer, row.level], params.search);
    });
    return paginate(rows, params);
  }

  async get(id: string): Promise<LibraryItem> {
    const found = this.store.resources.find(id);
    if (!found) throw notFound("LIBRARY_ITEM_NOT_FOUND", `منبع با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async create(input: CreateLibraryItemInput): Promise<LibraryItem> {
    const fields = this.validate(input);
    if (Object.keys(fields).length > 0) {
      throw validationError("LIBRARY_ITEM_INVALID", "اطلاعات منبع معتبر نیست.", fields);
    }

    const createdAt = new Date().toISOString();
    const asset = input.mediaId ? this.store.media.find(input.mediaId) : undefined;

    return this.store.resources.create({
      title: input.title.trim(),
      composer: input.composer?.trim() ?? "",
      kind: input.kind,
      instrument: input.instrument,
      level: input.level?.trim() ?? "",
      uses: 0,
      createdAt,
      added: addedLabel(createdAt),
      size: asset ? sizeLabel(asset.sizeBytes) : UNKNOWN_SIZE,
      ...(input.pages !== undefined ? { pages: input.pages } : {}),
      ...(input.durationSeconds !== undefined ? { duration: durationLabel(input.durationSeconds) } : {}),
      ...(input.peaks ? { peaks: input.peaks } : {}),
      ...(input.mediaId ? { mediaId: input.mediaId } : {}),
    });
  }

  async update(id: string, input: UpdateLibraryItemInput): Promise<LibraryItem> {
    const existing = await this.get(id);
    const fields = this.validate(input);
    if (Object.keys(fields).length > 0) {
      throw validationError("LIBRARY_ITEM_INVALID", "اطلاعات منبع معتبر نیست.", fields);
    }

    const patch: Partial<Omit<LibraryItem, "id">> = {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.composer !== undefined ? { composer: input.composer.trim() } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.instrument !== undefined ? { instrument: input.instrument } : {}),
      ...(input.level !== undefined ? { level: input.level.trim() } : {}),
      ...(input.pages !== undefined ? { pages: input.pages } : {}),
      ...(input.peaks !== undefined ? { peaks: input.peaks } : {}),
      ...(input.durationSeconds !== undefined ? { duration: durationLabel(input.durationSeconds) } : {}),
    };

    // Re-pointing the file changes the measured size, so the label follows the
    // asset rather than keeping the previous file's number.
    if (input.mediaId !== undefined && input.mediaId !== existing.mediaId) {
      patch.mediaId = input.mediaId;
      const asset = input.mediaId ? this.store.media.find(input.mediaId) : undefined;
      patch.size = asset ? sizeLabel(asset.sizeBytes) : UNKNOWN_SIZE;
    }

    const updated = this.store.resources.update(id, patch);
    if (!updated) throw notFound("LIBRARY_ITEM_NOT_FOUND", `منبع با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!this.store.resources.remove(id)) {
      throw notFound("LIBRARY_ITEM_NOT_FOUND", `منبع با شناسهٔ ${id} یافت نشد.`);
    }
    if (existing.mediaId) await this.freeMedia(existing.mediaId);
  }

  /**
   * Frees a file no catalogue row references any more, through the media
   * abstraction (metadata AND bytes). A blob failure must not resurrect the
   * deleted row, so it is reported by the media layer and not rethrown here.
   */
  private async freeMedia(mediaId: string): Promise<void> {
    const stillUsed = this.store.resources.all().some((row) => row.mediaId === mediaId);
    if (stillUsed) return;
    try {
      await this.media.delete(mediaId);
    } catch {
      /* the asset is already gone; the catalogue row deletion stands */
    }
  }

  /**
   * Field rules shared by create and update.
   *
   * Referential checks are the point: a row may only point at an instrument and
   * a file that actually exist in this environment, so the UI can never render
   * a download for an asset the store does not have.
   */
  private validate(input: CreateLibraryItemInput | UpdateLibraryItemInput): Record<string, string[]> {
    const fields: Record<string, string[]> = {};

    if (input.title !== undefined && input.title.trim().length < 2) {
      fields.title = ["عنوان منبع الزامی است."];
    }
    if (input.instrument !== undefined && !this.store.instruments.find(input.instrument)) {
      fields.instrument = ["ساز انتخاب‌شده در فهرست سازهای آموزشگاه وجود ندارد."];
    }
    if (input.mediaId !== undefined && input.mediaId !== "" && !this.store.media.find(input.mediaId)) {
      fields.mediaId = ["فایل انتخاب‌شده در فضای ذخیره‌سازی وجود ندارد."];
    }
    if (input.pages !== undefined && (!Number.isInteger(input.pages) || input.pages < 0)) {
      fields.pages = ["تعداد صفحه باید عددی صحیح و نامنفی باشد."];
    }
    if (input.durationSeconds !== undefined && (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0)) {
      fields.durationSeconds = ["مدت زمان معتبر نیست."];
    }

    return fields;
  }
}

/* ------------------------------------------------------------------ */
/* Display projections                                                  */
/* ------------------------------------------------------------------ */

/** Byte length as the Persian label the catalogue displays. */
export function sizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return UNKNOWN_SIZE;
  if (bytes < 1024) return `${faNum(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faNum(Math.round(bytes / 1024))} کیلوبایت`;
  return `${faNum(bytes / (1024 * 1024), { decimals: 1 })} مگابایت`;
}

/** Seconds as `m:ss` in Persian digits. */
export function durationLabel(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const padded = safe % 60 < 10 ? `۰${faNum(safe % 60)}` : faNum(safe % 60);
  return `${faNum(Math.floor(safe / 60))}:${padded}`;
}

/**
 * `Resource.added` is a Persian relative label in the shipped catalogue, so a
 * created row keeps the same vocabulary — derived from its real timestamp.
 */
export function addedLabel(iso: string): string {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return "امروز";
  const days = Math.floor((Date.now() - created) / 86_400_000);
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${faNum(days)} روز پیش`;
}
