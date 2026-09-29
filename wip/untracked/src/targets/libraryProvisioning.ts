/**
 * Target seam — demo library provisioning (DEMO composition target).
 *
 * The bytes behind the seeded library file are DEMO DATA: this hook (and the
 * `ensureDemoLibraryFile` implementation it drives) belongs to the demo target
 * only. Shared code (`App`'s shell) calls the hook through this specifier; the
 * client composition provides a no-op at `libraryProvisioning.client.ts`, so
 * neither the seed payload nor the blob-store provisioning code can reach the
 * client bundle.
 *
 * Runs inside the shell — after the access gate and after authentication — so
 * a visitor who never gets in never touches storage. Gated by the persisted
 * lifecycle state (a DEMO environment only), never by row counts.
 */
import { useEffect } from "react";
import { useIsDemoEnvironment } from "@/targets/environment";
import { ensureDemoLibraryFile } from "@/domains/library/demoContent";

export function useDemoLibraryFile(): void {
  const demo = useIsDemoEnvironment();

  useEffect(() => {
    if (!demo) return;
    void ensureDemoLibraryFile();
  }, [demo]);
}
