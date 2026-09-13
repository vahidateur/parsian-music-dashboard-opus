/**
 * Data version — the cross-domain invalidation seam.
 *
 * A write in one domain (enrolling a student) changes what another domain
 * reads (a class's seat count). Rather than let every view own a private copy
 * of state and try to keep the copies in step, all list hooks re-read from
 * their repository whenever the version bumps.
 *
 * The version is deliberately global and coarse. Demo datasets are small
 * (hundreds of rows held in memory), so a re-read costs far less than the
 * bookkeeping that fine-grained per-collection invalidation would need. If a
 * future backend makes re-reads expensive, this is the one place to add
 * per-collection granularity.
 *
 * Views never import DemoStore. In demo mode the store's write notification
 * drives this; in API mode nothing subscribes and mutations bump it directly
 * via `bumpDataVersion`, so the same hooks work in both environments.
 */
import { useSyncExternalStore } from "react";
import { demoStore } from "@/services/demoStore";

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one broken subscriber must not stop the rest */
    }
  });
}

/** Signals that persisted data changed and every reader should re-fetch. */
export function bumpDataVersion(): void {
  version += 1;
  notify();
}

export function getDataVersion(): number {
  return version;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Demo persistence is one source of version bumps. Subscribing once at module
// scope keeps the wiring in a single place instead of in every hook.
demoStore.subscribe(bumpDataVersion);

/**
 * Re-renders the caller whenever persisted data changes. Pass the result into
 * a list hook's `revision` argument to make it re-read.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getDataVersion, getDataVersion);
}
