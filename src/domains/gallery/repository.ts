import type { Page } from "@/api/types";
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

export interface GalleryRepository {
  listAlbums(params?: AlbumListParams, signal?: AbortSignal): Promise<Page<GalleryAlbum>>;
  getAlbum(id: string, signal?: AbortSignal): Promise<GalleryAlbum>;
  createAlbum(input: CreateAlbumInput): Promise<GalleryAlbum>;
  updateAlbum(id: string, input: UpdateAlbumInput): Promise<GalleryAlbum>;
  /** Removes the album and every image row in it (media bytes are freed too). */
  deleteAlbum(id: string): Promise<void>;

  listImages(params?: GalleryImageListParams, signal?: AbortSignal): Promise<Page<GalleryImage>>;
  addImage(input: CreateGalleryImageInput): Promise<GalleryImage>;
  updateImage(id: string, input: UpdateGalleryImageInput): Promise<GalleryImage>;
  removeImage(id: string): Promise<void>;
  /** Moves an image to a new 0-based position within its album. */
  reorderImage(id: string, newOrder: number): Promise<GalleryImage>;
}
