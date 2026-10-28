import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
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

const ALBUMS = "gallery/albums";
const IMAGES = "gallery/images";

/**
 * REST implementation of the gallery domain.
 *
 * Endpoints served by the server (DECISIONS.md §36):
 *   albums  GET|POST /gallery/albums, GET|PATCH|DELETE /gallery/albums/{id}
 *   images  GET|POST /gallery/images, GET|PATCH|DELETE /gallery/images/{id},
 *           POST /gallery/images/{id}/reorder
 *
 * Reads are allowed to every role that opens the showcase (`gallery.read`);
 * writes require `gallery.write` (administrator + manager).
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so the album column and the image grid refresh
 * without knowing who wrote. A write the server refused changes nothing, so
 * the version is bumped only after the write has actually happened. Reads —
 * including the reorder preview the panel never asks for — bump nothing.
 */
export class ApiGalleryRepository implements GalleryRepository {
  constructor(private readonly client: ApiClient) {}

  /* ------------------------------------------------------------ albums */

  listAlbums(params: AlbumListParams = {}, signal?: AbortSignal): Promise<Page<GalleryAlbum>> {
    return this.client.getPage<GalleryAlbum>(ALBUMS, { query: toAlbumQuery(params), signal });
  }

  getAlbum(id: string, signal?: AbortSignal): Promise<GalleryAlbum> {
    return this.client.get<GalleryAlbum>(`${ALBUMS}/${encodeURIComponent(id)}`, { signal });
  }

  async createAlbum(input: CreateAlbumInput): Promise<GalleryAlbum> {
    const created = await this.client.post<GalleryAlbum>(ALBUMS, input);
    bumpDataVersion();
    return created;
  }

  async updateAlbum(id: string, input: UpdateAlbumInput): Promise<GalleryAlbum> {
    const updated = await this.client.patch<GalleryAlbum>(`${ALBUMS}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.client.delete(`${ALBUMS}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  /* ------------------------------------------------------------ images */

  listImages(params: GalleryImageListParams = {}, signal?: AbortSignal): Promise<Page<GalleryImage>> {
    return this.client.getPage<GalleryImage>(IMAGES, { query: toImageQuery(params), signal });
  }

  async addImage(input: CreateGalleryImageInput): Promise<GalleryImage> {
    const created = await this.client.post<GalleryImage>(IMAGES, input);
    bumpDataVersion();
    return created;
  }

  async updateImage(id: string, input: UpdateGalleryImageInput): Promise<GalleryImage> {
    const updated = await this.client.patch<GalleryImage>(`${IMAGES}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async removeImage(id: string): Promise<void> {
    await this.client.delete(`${IMAGES}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  async reorderImage(id: string, newOrder: number): Promise<GalleryImage> {
    const updated = await this.client.post<GalleryImage>(`${IMAGES}/${encodeURIComponent(id)}/reorder`, {
      order: newOrder,
    });
    bumpDataVersion();
    return updated;
  }
}

/** Domain params → wire query params (snake_case, per the API contract). */
export function toAlbumQuery(params: AlbumListParams): QueryParams {
  return {
    search: params.search,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toImageQuery(params: GalleryImageListParams): QueryParams {
  return {
    album_id: params.albumId,
    page: params.page,
    per_page: params.per_page,
  };
}
