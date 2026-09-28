/**
 * Target seam — demo library provisioning (CLIENT composition target).
 *
 * There is no demo dataset in the client build, so there is nothing to
 * provision. The hook keeps the same call signature so the shared shell needs
 * no target branching of its own.
 */
import { useEffect } from "react";

export function useDemoLibraryFile(): void {
  useEffect(() => {
    /* client target: no demo content exists to provision */
  }, []);
}
