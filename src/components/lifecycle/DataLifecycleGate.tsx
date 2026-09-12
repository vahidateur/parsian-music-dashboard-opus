import { isDemoMode } from "@/api/config";
import { useDataLifecycle } from "@/domains/demo/useDataLifecycle";
import { useDemoData } from "@/domains/demo/useDemoData";
import { FirstRunChooser } from "./FirstRunChooser";
import { LifecycleRecoveryContext, type LifecycleRecoveryController } from "./LifecycleRecoveryContext";
import type { ReactNode } from "react";

/**
 * The application's data-lifecycle boundary.
 *
 * Placement is the whole point: this gate sits ABOVE `AuthProvider` (and so
 * above every domain view), because authentication itself reads the environment
 * — resolving the signed-in user against `users`. A visitor therefore never
 * reaches the login screen, the shell or a single record before the environment
 * exists, and no view has to ask which kind of environment it is in.
 *
 * ```
 * AccessGate → ConfigGate → DataLifecycleGate → AuthProvider → Shell → views
 *                            └─ UNINITIALIZED → FirstRunChooser
 * ```
 *
 * With `VITE_DATA_SOURCE` set to a real backend there is no local environment to
 * choose — the data source is already decided by configuration — so the gate is
 * transparent in `api` mode and provides no local recovery controller.
 */
export function DataLifecycleGate({ children }: { children: ReactNode }) {
  if (!isDemoMode()) return <>{children}</>;
  return <LifecycleGate>{children}</LifecycleGate>;
}

/** Split out so the lifecycle hook is never called conditionally. */
function LifecycleGate({ children }: { children: ReactNode }) {
  const { state } = useDataLifecycle();
  const data = useDemoData();
  const recovery: LifecycleRecoveryController = { state, ...data };

  // Nothing is rendered behind this branch: mounting the app while the state is
  // unknown would let a read happen before the choice, which is exactly what
  // the lifecycle boundary exists to prevent. The provider stays mounted so a
  // completed uninitialize can report its awaited blob-cleanup result here.
  return (
    <LifecycleRecoveryContext.Provider value={recovery}>
      {state === "uninitialized" ? <FirstRunChooser /> : children}
    </LifecycleRecoveryContext.Provider>
  );
}
