/**
 * Media hooks.
 *
 * `useMediaObjectUrl` is the only place object URLs are created for stored
 * binaries, so it is also the only place responsible for revoking them — a leak
 * here would grow unbounded as the user browses galleries or library files.
 *
 * It lives in the media domain because it is a media concern: it talks to
 * `MediaRepository` and nothing else. Gallery and profile photos consume it
 * (gallery historically owned it; the re-export there is gone, both call sites
 * import from here).
 */
import { useEffect, useRef, useState } from "react";
import { getMediaRepository } from "@/domains/registry";

/**
 * Resolves a media id to a temporary object URL for `<img src>` / `<audio src>`.
 *
 * Returns `undefined` while loading, and also when the blob is genuinely
 * missing — which happens legitimately after restoring a backup, since backups
 * carry metadata but not bytes. Callers must treat `undefined` as "not
 * available yet or not available at all", never as "empty file".
 *
 * F1 absorbed hardening: media one-frame stale asset/blob/object-URL fix.
 * Previously, when mediaId changed from A to B, the old URL remained in state
 * for one committed frame (effect runs after render), so the UI showed the
 * previous image/audio for one frame. Now the URL is cleared synchronously
 * when mediaId changes, and the returned URL is only exposed when it was
 * created for the current mediaId — no frame can show a previous asset.
 */
export function useMediaObjectUrl(mediaId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [urlFor, setUrlFor] = useState<string | undefined>(undefined);
  const createdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!mediaId) {
      if (createdRef.current) {
        URL.revokeObjectURL(createdRef.current);
        createdRef.current = undefined;
      }
      setUrl(undefined);
      setUrlFor(undefined);
      return;
    }

    // Clear previous URL synchronously for new mediaId — prevents one-frame stale
    // The state update for url will happen in next render, but we also ensure
    // we don't return old url by checking urlFor at render time (below)
    // Immediately revoke previous if it exists
    if (createdRef.current) {
      URL.revokeObjectURL(createdRef.current);
      createdRef.current = undefined;
    }
    setUrl(undefined);
    setUrlFor(undefined);

    let revoked = false;
    let created: string | undefined;

    void getMediaRepository()
      .getBlob(mediaId)
      .then((blob) => {
        if (revoked || !blob) return;
        created = URL.createObjectURL(blob);
        createdRef.current = created;
        setUrl(created);
        setUrlFor(mediaId);
      })
      .catch(() => {
        if (revoked) return;
        setUrl(undefined);
        setUrlFor(undefined);
      });

    return () => {
      revoked = true;
      if (created) {
        URL.revokeObjectURL(created);
        if (createdRef.current === created) createdRef.current = undefined;
      }
      setUrl(undefined);
      setUrlFor(undefined);
    };
  }, [mediaId]);

  // Render-time guard: only expose URL when it was created for current mediaId
  // This prevents one frame where old URL is still in state while new mediaId is being loaded
  if (mediaId === undefined) return undefined;
  if (urlFor !== mediaId) return undefined;
  return url;
}
