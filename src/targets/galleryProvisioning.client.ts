/**
 * Target seam — demo gallery provisioning (CLIENT composition target).
 *
 * Same call signature, no demo content: the client build ships no bundled
 * photographs and never writes demo bytes into storage. The grid is ready on
 * first paint because there is exactly nothing to wait for.
 */
export function useDemoGalleryBytes(): { settled: boolean; unavailable: boolean } {
  return { settled: true, unavailable: false };
}
