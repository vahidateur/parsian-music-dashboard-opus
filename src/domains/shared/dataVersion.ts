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
 * Views never import DemoStore — and neither does THIS module any more: the
 * demo-store subscription is installed by the target seam
 * (`src/targets/environment.tsx`) at module scope, so the shared invalidation
 * primitive stays dependency-free and the client build cannot pull the demo
 * store in through every list hook. Outside the demo composition, mutations
 * bump the version directly via `bumpDataVersion`.
 */
import { useSyncExternalStore } from "react";

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

/**
 * Re-renders the caller whenever persisted data changes. Pass the result into
 * a list hook's `revision` argument to make it re-read.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getDataVersion, getDataVersion);
}
