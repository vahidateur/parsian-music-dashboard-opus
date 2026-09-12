/**
 * Demo gallery repository.
 *
 * Albums own their images; deleting an album frees the referenced media so the
 * blob store does not accumulate orphans.
 */
import type { Page } from "@/api/types";
import { matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { getBlobStore, type BlobStore } from "@/domains/media/blobStore";
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
    private readonly blobs: BlobStore = getBlobStore(),
  ) {}

  /* ------------------------------------------------------------ albums */

  async listAlbums(params: AlbumListParams = {}): Promise<Page<GalleryAlbum>> {
    const rows = this.store.galleryAlbums
      .all()
      .filter((row) => matchesQuery([row.title, row.description], params.search))
      .sort((a, b) => a.sortOrder - b.sortOrder);
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
      await this.freeMedia(image.mediaId);
      this.store.galleryImages.remove(image.id);
    }
    this.store.galleryAlbums.remove(id);
  }

  /* ------------------------------------------------------------ images */

  async listImages(params: GalleryImageListParams = {}): Promise<Page<GalleryImage>> {
    const rows = this.store.galleryImages
      .all()
      .filter((row) => (params.albumId ? row.albumId === params.albumId : true))
      .sort((a, b) => a.sortOrder - b.sortOrder);
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
    await this.freeMedia(existing.mediaId);
    this.store.galleryImages.remove(id);

    // Keep the remaining positions contiguous.
    this.store.galleryImages
      .all()
      .filter((row) => row.albumId === existing.albumId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((row, index) => {
        if (row.sortOrder !== index) this.store.galleryImages.update(row.id, { sortOrder: index });
      });
  }

  async reorderImage(id: string, newOrder: number): Promise<GalleryImage> {
    const existing = this.store.galleryImages.find(id);
    if (!existing) throw notFound("GALLERY_IMAGE_NOT_FOUND", `تصویر با شناسهٔ ${id} یافت نشد.`);

    const siblings = this.store.galleryImages
      .all()
      .filter((row) => row.albumId === existing.albumId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

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
   * Deletes the backing media row and bytes when no other record references it.
   * A blob failure must not abort the domain delete, so it is swallowed here
   * deliberately — the metadata row is the source of truth for what exists.
   */
  private async freeMedia(mediaId: string): Promise<void> {
    const stillUsed = this.store.galleryImages.all().filter((row) => row.mediaId === mediaId).length > 1;
    if (stillUsed) return;
    try {
      await this.blobs.remove(mediaId);
    } catch {
      /* the blob is already gone or unavailable; the metadata removal stands */
    }
    this.store.media.remove(mediaId);
  }
}
