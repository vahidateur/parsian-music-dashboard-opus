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
import { useEffect, useState } from "react";
import { getMediaRepository } from "@/domains/registry";

/**
 * Resolves a media id to a temporary object URL for `<img src>` / `<audio src>`.
 *
 * Returns `undefined` while loading, and also when the blob is genuinely
 * missing — which happens legitimately after restoring a backup, since backups
 * carry metadata but not bytes. Callers must treat `undefined` as "not
 * available yet or not available at all", never as "empty file".
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
