/**
 * Gallery hooks.
 *
 * Binary resolution is NOT here: `useMediaObjectUrl` moved to the media domain
 * (`@/domains/media/useMedia`), which owns the object-URL lifetime for every
 * stored file — gallery images, profile photos and library audio alike.
 */
import { useEffect, useState } from "react";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { ensureDemoGalleryBytes } from "./demoContent";
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

/**
 * The demo's showcase photographs, provisioned before the grid paints.
 *
 * `ensureDemoGalleryBytes` writes the bundled photos into the blob store; the
 * grid waits for that ONE step so a tile never mounts against bytes that have
 * not landed yet (a shimmer that resolves a frame later reads as a broken
 * image). In API mode there is nothing to provision: the backend already owns
 * the bytes, so the grid is ready on first paint.
 */
export function useDemoGalleryBytes(): { settled: boolean; unavailable: boolean } {
  const demo = useIsDemoEnvironment();
  const [state, setState] = useState<{ settled: boolean; unavailable: boolean }>({
    settled: !demo,
    unavailable: false,
  });

  useEffect(() => {
    if (!demo) return;
    let live = true;
    void ensureDemoGalleryBytes()
      .then((result) => {
        if (live) setState({ settled: true, unavailable: result.status === "unavailable" });
      })
      .catch(() => {
        if (live) setState({ settled: true, unavailable: true });
      });
    return () => {
      live = false;
    };
  }, [demo]);

  return state;
}
