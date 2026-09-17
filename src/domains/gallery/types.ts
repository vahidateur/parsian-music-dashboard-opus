/**
 * Gallery domain — albums of images for the academy showcase.
 *
 * Images reference the media domain by `mediaId`; the bytes never live here.
 * See `src/domains/media/types.ts` for the storage-boundary rationale.
 */
import type { ListParams } from "@/api/types";

export interface GalleryAlbum {
  id: string;
  title: string;
  description: string;
  /** `MediaAsset.id` of the album cover; falls back to its first image. */
  coverMediaId?: string;
  /** ISO-8601. */
  createdAt: string;
  sortOrder: number;
}

export interface GalleryImage {
  id: string;
  albumId: string;
  mediaId: string;
  caption: string;
  /** Alternative text for screen readers. Required for accessibility (§20). */
  alt: string;
  sortOrder: number;
  /** ISO-8601. */
  createdAt: string;
}

export interface AlbumListParams extends ListParams {
  search?: string;
}

export interface GalleryImageListParams extends ListParams {
  albumId?: string;
}

export type CreateAlbumInput = Omit<GalleryAlbum, "id" | "createdAt" | "sortOrder"> &
  Partial<Pick<GalleryAlbum, "sortOrder" | "createdAt">>;
export type UpdateAlbumInput = Partial<Omit<GalleryAlbum, "id" | "createdAt">>;

export type CreateGalleryImageInput = Omit<GalleryImage, "id" | "createdAt" | "sortOrder"> &
  Partial<Pick<GalleryImage, "sortOrder" | "createdAt">>;
export type UpdateGalleryImageInput = Partial<Omit<GalleryImage, "id" | "albumId" | "createdAt">>;
