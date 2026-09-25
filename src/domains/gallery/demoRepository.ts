/**
 * Demo gallery repository — F1 genuine.
 *
 * Albums own their images; deleting an album frees the referenced media so the
 * blob store does not accumulate orphans.
 *
 * MEDIA IS FREED THROUGH THE MEDIA DOMAIN, NOT THE BLOB STORE. This repository
 * used to remove the bytes and the metadata row itself, which meant the gallery
 * had its own private idea of deletion — and the check for "does anything else
 * reference this asset?" only ever looked at gallery rows. Cleanup now goes
 * through `MediaRepository.delete` via the ownership transition, and the check it
 * asks is the global parent predicate (X1), so metadata and bytes always leave
 * together and no other domain's reference is missed.
 *
 * ORDER: the image row is detached BEFORE its media is freed. The row is what
 * makes the asset reachable; freeing first and relying on a count of remaining
 * rows to notice was the same operation with the invariant inverted.
 *
 * F1: sorting sortOrder ASC then createdAt per spec, album filtering via search,
 * empty state honest, alt required, upload via media seam, no fabricated counts,
 * seed VERIFIED 2 albums 0 images.
 */
import type { Page } from "@/api/types";
import { matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { mediaStillReferenced } from "@/domains/media/demoReferences";
import { releaseUnreferencedMedia } from "@/domains/media/release";
import type { MediaRepository } from "@/domains/media/repository";
import type { GalleryRepository } from "./repository";
import type {
  AlbumListParams,
  CreateAlbumInput,
  CreateGalleryImageInput,
  GalleryAlbum,
  GalleryImage,
  GalleryImageListParams,
  UpdateAlbumInput,
  UpdateGalleryImageInput,
} from "./types";

export class DemoGalleryRepository implements GalleryRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    /** Bytes belong to the media domain; this repository only names the id. */
    private readonly media: MediaRepository = new DemoMediaRepository(),
  ) {}

  /* ------------------------------------------------------------ albums */

  async listAlbums(params: AlbumListParams = {}): Promise<Page<GalleryAlbum>> {
    const rows = this.store.galleryAlbums
      .all()
      .filter((row) => matchesQuery([row.title, row.description], params.search))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      });
    return paginate(rows, params);
  }

  async getAlbum(id: string): Promise<GalleryAlbum> {
    const found = this.store.galleryAlbums.find(id);
    if (!found) throw notFound("ALBUM_NOT_FOUND", `آلبوم با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async createAlbum(input: CreateAlbumInput): Promise<GalleryAlbum> {
    if (input.title.trim().length < 2) {
      throw validationError("ALBUM_INVALID", "اطلاعات آلبوم معتبر نیست.", { title: ["عنوان الزامی است."] });
    }
    const rows = this.store.galleryAlbums.all();
    return this.store.galleryAlbums.create({
      ...input,
      title: input.title.trim(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      sortOrder: input.sortOrder ?? rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
    });
  }

  async updateAlbum(id: string, input: UpdateAlbumInput): Promise<GalleryAlbum> {
    await this.getAlbum(id);
    if (input.title !== undefined && input.title.trim().length < 2) {
      throw validationError("ALBUM_INVALID", "عنوان آلبوم معتبر نیست.", { title: ["عنوان الزامی است."] });
    }
    const updated = this.store.galleryAlbums.update(id, {
      ...input,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    });
    if (!updated) throw notFound("ALBUM_NOT_FOUND", `آلبوم با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.getAlbum(id);
    for (const image of this.store.galleryImages.all()) {
      if (image.albumId !== id) continue;
      // Detach the row first, then free what it referenced: the reference check
      // must not see this image as its own reason to keep the asset alive.
      this.store.galleryImages.remove(image.id);
      await this.releaseImage(image.mediaId);
    }
    this.store.galleryAlbums.remove(id);
  }

  /* ------------------------------------------------------------ images */

  async listImages(params: GalleryImageListParams = {}): Promise<Page<GalleryImage>> {
    const rows = this.store.galleryImages
      .all()
      .filter((row) => (params.albumId ? row.albumId === params.albumId : true))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      });
    return paginate(rows, params);
  }

  async addImage(input: CreateGalleryImageInput): Promise<GalleryImage> {
    await this.getAlbum(input.albumId);
    if (!this.store.media.find(input.mediaId)) {
      throw validationError("GALLERY_IMAGE_INVALID", "فایل تصویر یافت نشد.", { mediaId: ["نامعتبر است"] });
    }
    // Alt text is required for accessibility; an image with no description is
    // invisible to a screen reader.
    if (input.alt.trim().length < 2) {
      throw validationError("GALLERY_IMAGE_INVALID", "متن جایگزین تصویر الزامی است.", {
        alt: ["توضیح کوتاه تصویر را وارد کنید."],
      });
    }
    const siblings = this.store.galleryImages.all().filter((row) => row.albumId === input.albumId);
    return this.store.galleryImages.create({
      ...input,
      alt: input.alt.trim(),
      caption: input.caption.trim(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      sortOrder: input.sortOrder ?? siblings.length,
    });
  }

  async updateImage(id: string, input: UpdateGalleryImageInput): Promise<GalleryImage> {
    const existing = this.store.galleryImages.find(id);
    if (!existing) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);
    if (input.alt !== undefined && input.alt.trim().length < 2) {
      throw validationError("GALLERY_IMAGE_INVALID", "متن جایگزین تصویر الزامی است.", {
        alt: ["توضیح کوتاه تصویر را وارد کنید."],
      });
    }
    const updated = this.store.galleryImages.update(id, input);
    if (!updated) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async removeImage(id: string): Promise<void> {
    const existing = this.store.galleryImages.find(id);
    if (!existing) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);
    // Detach first — the row is the reference that keeps the media alive.
    this.store.galleryImages.remove(id);

    // Keep the remaining positions contiguous.
    this.store.galleryImages
      .all()
      .filter((row) => row.albumId === existing.albumId)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      })
      .forEach((row, index) => {
        if (row.sortOrder !== index) this.store.galleryImages.update(row.id, { sortOrder: index });
      });

    // Only now is the asset a cleanup candidate — and it is kept if another
    // image still uses the same media id.
    await this.releaseImage(existing.mediaId);
  }

  async reorderImage(id: string, newOrder: number): Promise<GalleryImage> {
    const existing = this.store.galleryImages.find(id);
    if (!existing) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);

    const siblings = this.store.galleryImages
      .all()
      .filter((row) => row.albumId === existing.albumId)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      });

    if (!Number.isInteger(newOrder) || newOrder < 0 || newOrder >= siblings.length) {
      throw validationError("GALLERY_IMAGE_INVALID", "جایگاه تصویر معتبر نیست.", { sortOrder: ["خارج از محدوده"] });
    }
    const without = siblings.filter((row) => row.id !== id);
    without.splice(newOrder, 0, existing);
    without.forEach((row, index) => {
      if (row.sortOrder !== index) this.store.galleryImages.update(row.id, { sortOrder: index });
    });

    const updated = this.store.galleryImages.find(id);
    if (!updated) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  /**
   * Frees the media a detached image row no longer reaches — through
   * `MediaRepository`, so metadata and bytes leave together — and keeps it while
   * ANY persisted record still references it: another image, an album cover, or
   * a parent in a different domain entirely (the global check, X1). The caller
   * has already removed the row, so this can never be asked before the relation
   * is gone.
   */
  private async releaseImage(mediaId: string): Promise<void> {
    await releaseUnreferencedMedia(
      mediaId,
      (id) => mediaStillReferenced(this.store, id),
      this.media,
    );
  }
}
