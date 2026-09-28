/**
 * Gallery hooks.
 *
 * Binary resolution is NOT here: `useMediaObjectUrl` moved to the media domain
 * (`@/domains/media/useMedia`), which owns the object-URL lifetime for every
 * stored file — gallery images, profile photos and library audio alike.
 */
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import { getGalleryRepository } from "@/domains/registry";
import type { AlbumListParams, GalleryAlbum, GalleryImage, GalleryImageListParams } from "./types";

export function useAlbums(params: AlbumListParams = {}): ListState<GalleryAlbum> {
  return useResourceList<GalleryAlbum, AlbumListParams>(
    (listParams, signal) => getGalleryRepository().listAlbums(listParams, signal),
    params,
  );
}

export function useGalleryImages(params: GalleryImageListParams = {}): ListState<GalleryImage> {
  return useResourceList<GalleryImage, GalleryImageListParams>(
    (listParams, signal) => getGalleryRepository().listImages(listParams, signal),
    params,
  );
}
