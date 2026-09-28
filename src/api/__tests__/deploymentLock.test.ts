/**
 * Deployment lock — the state machine every demo capability funnels through.
 *
 * Phase 2A service-layer invariants (the UI never gates anything alone):
 *
 *   1. absent state → demo available (nothing delivered yet);
 *   2. delivered/locked → demo operations REJECT at the service (DemoDisabledError
 *      with a stable `code`), not merely hide a button;
 *   3. a corrupt persisted marker FAILS CLOSED — locked, never demo_active;
 *   4. the pending/recovery waypoint (`removing`) also rejects demo operations
 *      and blocks destructive mutations while the dataset stays intact;
 *   5. the pending reason round-trips for recovery UI;
 *   6. delivery state lives under its own keys — independent of dataset and
 *      lifecycle marker.
 *
 * Storage is injected per test so nothing leaks between cases (and nothing
 * depends on whatever the ambient jsdom persisted).
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  DELIVERY_PENDING_KEY,
  DELIVERY_STORAGE_KEY,
  DemoDisabledError,
  assertDemoOperationAllowed,
  clearDeliveryPending,
  isDeliveryPending,
  isDemoCapabilityAvailable,
  isDestructiveOperationAllowed,
  isProductionDelivered,
  memoryDeliveryStorage,
  readDeliveryPending,
  readDeliveryState,
  readDeliveryStateInfo,
  setDeliveryStorage,
  writeDeliveryPending,
  writeDeliveryState,
} from "../deploymentLock";
type InjectedStorage = ReturnType<typeof memoryDeliveryStorage>;

let storage: InjectedStorage;

beforeEach(() => {
  storage = memoryDeliveryStorage();
  setDeliveryStorage(storage);
});

describe("delivery state reads", () => {
  it("absent state means demo_active — nothing delivered yet", () => {
    expect(readDeliveryState()).toBe("demo_active");
    expect(readDeliveryStateInfo()).toEqual({ state: "demo_active", raw: null, corrupt: false });
    expect(isDemoCapabilityAvailable()).toBe(true);
    expect(isProductionDelivered()).toBe(false);
    expect(isDeliveryPending()).toBe(false);
  });

  it("persists each recognised state under its own key", () => {
    writeDeliveryState("removing");
    expect(storage.getItem(DELIVERY_STORAGE_KEY)).toBe("removing");
    expect(readDeliveryState()).toBe("removing");

    writeDeliveryState("delivered");
    expect(readDeliveryState()).toBe("delivered");
    expect(isProductionDelivered()).toBe(true);

    writeDeliveryState("locked");
    expect(readDeliveryState()).toBe("locked");
    expect(isDemoCapabilityAvailable()).toBe(false);
  });

  it("an UNRECOGNISED persisted value fails closed — locked, flagged corrupt", () => {
    storage.setItem(DELIVERY_STORAGE_KEY, "totally-not-a-state");
    const info = readDeliveryStateInfo();
    expect(info.state).toBe("locked");
    expect(info.corrupt).toBe(true);
    expect(info.raw).toBe("totally-not-a-state");
    expect(isDemoCapabilityAvailable()).toBe(false);
    // customer reads/writes are unaffected: destructive ops stay allowed
    // outside the pending waypoint.
    expect(isDestructiveOperationAllowed()).toBe(true);
  });
});

describe("assertDemoOperationAllowed — the service-level gate", () => {
  it("allows demo operations only in demo_active", () => {
    expect(() => assertDemoOperationAllowed("reset")).not.toThrow();
    writeDeliveryState("delivered");
    expect(() => assertDemoOperationAllowed("reset")).toThrow(DemoDisabledError);
    writeDeliveryState("locked");
    expect(() => assertDemoOperationAllowed("reset")).toThrow(DemoDisabledError);
  });

  it("rejects with the stable DEMO_DISABLED code, not a message string", () => {
    writeDeliveryState("locked");
    try {
      assertDemoOperationAllowed("import-seed");
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoDisabledError);
      expect((error as DemoDisabledError).code).toBe("DEMO_DISABLED");
      expect((error as DemoDisabledError).operation).toBe("import-seed");
    }
  });

  it("the pending waypoint (removing) rejects demo operations too — fail closed", () => {
    writeDeliveryState("removing");
    expect(() => assertDemoOperationAllowed("clear")).toThrow(DemoDisabledError);
    // …and blocks destructive mutations while recovery observes a stable dataset.
    expect(isDestructiveOperationAllowed()).toBe(false);
    expect(isDeliveryPending()).toBe(true);
  });

  it("delivered/locked keep destructive (customer-data) operations available", () => {
    writeDeliveryState("locked");
    expect(isDestructiveOperationAllowed()).toBe(true);
  });
});

describe("pending / recovery marker", () => {
  it("round-trips a typed reason with its timestamp", () => {
    expect(readDeliveryPending()).toBeNull();
    writeDeliveryPending("ownership-unproven");
    const pending = readDeliveryPending();
    expect(pending?.reason).toBe("ownership-unproven");
    expect(typeof pending?.at).toBe("string");
    clearDeliveryPending();
    expect(readDeliveryPending()).toBeNull();
    expect(storage.getItem(DELIVERY_PENDING_KEY)).toBeNull();
  });

  it("an unparsable pending marker reports none — the state itself still says removing", () => {
    storage.setItem(DELIVERY_PENDING_KEY, "{not json");
    expect(readDeliveryPending()).toBeNull();
    writeDeliveryState("removing");
    expect(isDeliveryPending()).toBe(true);
  });
});
