/**
 * Gallery hooks.
 *
 * `useMediaObjectUrl` is the only place object URLs are created for gallery
 * images, so it is also the only place responsible for revoking them — a leak
 * here would grow unbounded as the user browses albums.
 */
import { useEffect, useState } from "react";
import { useResourceList, type ListState } from "@/domains/shared/useResource";
import { getGalleryRepository, getMediaRepository } from "@/domains/registry";
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

/**
 * Resolves a media id to a temporary object URL for `<img src>`.
 *
 * Returns `undefined` while loading, and also when the blob is genuinely
 * missing — which happens legitimately after restoring a backup, since backups
 * carry metadata but not bytes.
 */
export function useMediaObjectUrl(mediaId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!mediaId) {
      setUrl(undefined);
      return;
    }
    let revoked = false;
    let created: string | undefined;

    void getMediaRepository()
      .getBlob(mediaId)
      .then((blob) => {
        if (revoked || !blob) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => setUrl(undefined));

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
      setUrl(undefined);
    };
  }, [mediaId]);

  return url;
}
