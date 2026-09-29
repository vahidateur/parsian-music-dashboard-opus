/**
 * Target seam — demo gallery provisioning (DEMO composition target).
 *
 * The showcase photographs are DEMO DATA: `ensureDemoGalleryBytes` writes the
 * bundled photos into the blob store before the grid paints. This hook lives in
 * the demo target so the client build — which has no bundled photos and no
 * local blob store for demo bytes — never links the seed payload
 * (`domains/gallery/demoContent` → `gallerySeed`).
 *
 * In API mode (and in the client target) there is nothing to provision: the
 * backend owns the bytes, so the grid is ready on first paint.
 */
import { useEffect, useState } from "react";
import { useIsDemoEnvironment } from "@/targets/environment";
import { ensureDemoGalleryBytes } from "@/domains/gallery/demoContent";

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
