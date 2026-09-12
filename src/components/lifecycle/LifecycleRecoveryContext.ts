import { createContext, useContext } from "react";
import type { DemoDataState } from "@/domains/demo/useDemoData";
import type { DataLifecycleState } from "@/domains/demo/types";

/**
 * The lifecycle-owned portion of the existing destructive-action seam.
 *
 * The provider remains mounted while the gate changes from an initialized
 * environment to UNINITIALIZED, so an awaited blob-cleanup result cannot be
 * lost when the login branch unmounts and FirstRunChooser returns.
 */
export interface LifecycleRecoveryController
  extends Pick<DemoDataState, "stats" | "pending" | "lastResult" | "busy" | "request" | "cancel" | "confirm"> {
  state: DataLifecycleState;
}

export const LifecycleRecoveryContext = createContext<LifecycleRecoveryController | null>(null);

/** Returns the gate-owned recovery controller, or null in API mode/direct tests. */
export function useLifecycleRecovery(): LifecycleRecoveryController | null {
  return useContext(LifecycleRecoveryContext);
}
