/**
 * Test/bootstrap harness for the data lifecycle.
 *
 * `demoStore.reset()` no longer seeds anything: it returns the store to
 * UNINITIALIZED, because reading (or clearing) must never decide what kind of
 * environment this is. A test that wants an environment therefore says which
 * one it wants, out loud — which is also what makes the lifecycle tests
 * meaningful, since the three starting points are genuinely different states.
 */
import { initializeDemoEnvironment, initializeEmptyEnvironment } from "@/domains/demo/lifecycle";
import { demoStore } from "@/services/demoStore";

/** The canonical DEMO environment: the shipped showcase dataset, explicitly. */
export function resetToDemoEnvironment(): void {
  demoStore.reset();
  initializeDemoEnvironment();
}

/**
 * A real/customer EMPTY environment: zero academy records plus the access
 * bootstrap account, so the environment can actually be signed into.
 */
export function resetToEmptyEnvironment(): void {
  demoStore.reset();
  initializeEmptyEnvironment();
}

/** No environment at all — the first-run state, before any choice. */
export function resetToUninitialized(): void {
  demoStore.reset();
}
