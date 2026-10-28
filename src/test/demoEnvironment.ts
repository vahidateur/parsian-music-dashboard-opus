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
import { localStore } from "@/services/localStore";

/**
 * The harness follows the canonical store. `localStore` and the compatibility
 * alias `demoStore` are the same object, so a reset here is the reset the
 * lifecycle default sees. Function names stay: they name the persisted
 * environment kind (`demo`), which W6 owns, and 113 suites import them.
 *
 * The canonical DEMO environment: the shipped showcase dataset, explicitly.
 */
export function resetToDemoEnvironment(): void {
  localStore.reset();
  initializeDemoEnvironment(localStore);
}

/**
 * A real/customer EMPTY environment: zero academy records plus the access
 * bootstrap account, so the environment can actually be signed into.
 */
export function resetToEmptyEnvironment(): void {
  localStore.reset();
  initializeEmptyEnvironment(localStore);
}

/** No environment at all — the first-run state, before any choice. */
export function resetToUninitialized(): void {
  localStore.reset();
}
