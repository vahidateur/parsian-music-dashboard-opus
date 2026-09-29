/**
 * Remove Demo / Deliver Production — Phase 2A delivery guarantees.
 *
 * Contract under test (`domains/demo/delivery.ts` + `api/deploymentLock.ts`):
 *
 *   1. confirm-gated: without an explicit confirmation nothing happens;
 *   2. proven demo environment → demo blobs, dataset, marker, demo credential
 *      and session keys are removed, an empty production environment boots,
 *      the deployment locks — and a RE-RUN performs no destructive step
 *      (idempotency);
 *   3. customer environment → the dataset bytes are preserved and only the
 *      lock flips (fail-closed ownership: preserve what you cannot prove is
 *      demo);
 *   4. unreadable dataset / corrupt marker / marker-vs-provenance conflict →
 *      pending + EVERYTHING preserved (fail closed, retry safe);
 *   5. legacy demo payload (no provenance field) → marker governs: deletable;
 *   6. while a delivery is pending, demo operations are rejected at the
 *      service layer and destructive mutations are blocked;
 *   7. an interrupted `removing` waypoint resumes to completion on retry
 *      (refresh mid-operation ⇒ safe retry, not a restart from scratch).
 *
 * jsdom + localStorage mirrors the real deployment: `demoStore` and the lock
 * both persist through the browser storage. Blob cleanup is mocked — the
 * IndexedDB blob store is not what these guarantees are about.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DemoDisabledError,
  assertDemoOperationAllowed,
  isDestructiveOperationAllowed,
  memoryDeliveryStorage,
  readDeliveryPending,
  readDeliveryState,
  setDeliveryStorage,
  writeDeliveryPending,
  writeDeliveryState,
} from "@/api/deploymentLock";
import { AUTH_SESSION_KEY } from "@/domains/auth/localAuthRepository";
import { DEMO_CREDENTIALS_KEY } from "@/domains/auth/demoCredentials";
import { createSeedDataset } from "../seed";
import type { ConfirmedRequest } from "../lifecycle";
import { deliverProduction, evaluateDeliveryOwnership } from "../delivery";
import { DEMO_STORAGE_KEY, LIFECYCLE_STORAGE_KEY, demoStore } from "@/services/demoStore";

vi.mock("@/domains/media/blobStore", () => ({
  getBlobStore: () => ({ remove: vi.fn().mockResolvedValue(undefined) }),
}));

const CONFIRM = { confirm: true as const };
/** `ConfirmedRequest` is confirm:true by type — the gate is also runtime. */
const NO_CONFIRM = { confirm: false } as unknown as ConfirmedRequest;

/** The stored dataset payload, narrowed from StoragePeek's union. */
function datasetPayload(): string | null {
  const peek = demoStore.peekDatasetPayload();
  return peek.readable ? peek.value : null;
}

function seedDemoEnv(): void {
  demoStore.initializeEnvironment("sample", createSeedDataset());
  localStorage.setItem(DEMO_CREDENTIALS_KEY, '{"demo@example.local":{}}');
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ accountId: "a1" }));
}

beforeEach(() => {
  localStorage.clear();
  setDeliveryStorage(memoryDeliveryStorage());
});

describe("confirm gate", () => {
  it("without an explicit confirmation nothing happens — no lock, no deletion", async () => {
    seedDemoEnv();
    const outcome = await deliverProduction(NO_CONFIRM);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.pending).toBe(false);
      expect(outcome.reason).toBe("not-confirmed");
    }
    expect(readDeliveryState()).toBe("demo_active");
    expect(datasetPayload()).toContain('"students"');
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("sample");
    expect(localStorage.getItem(DEMO_CREDENTIALS_KEY)).not.toBeNull();
  });
});

describe("proven demo environment", () => {
  it("removes demo data, boots an empty production environment and locks", async () => {
    seedDemoEnv();
    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: true, state: "locked", changed: true, ownership: "demo" });
    expect(readDeliveryState()).toBe("locked");
    // demo-scoped keys are gone; the environment itself boots empty
    expect(localStorage.getItem(DEMO_CREDENTIALS_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    const booted = JSON.parse(datasetPayload()!) as { students: unknown[] };
    expect(booted.students).toHaveLength(0);
    expect(readDeliveryPending()).toBeNull();
    // service-level rejection from here on
    expect(() => assertDemoOperationAllowed("reset")).toThrow(DemoDisabledError);
  });

  it("re-running after delivery performs no destructive step (idempotent)", async () => {
    seedDemoEnv();
    const first = await deliverProduction(CONFIRM);
    expect(first.ok).toBe(true);

    // A customer records their work in the fresh production environment…
    const boot = datasetPayload();
    expect(boot).not.toBeNull();

    const second = await deliverProduction(CONFIRM);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.changed).toBe(false);
      expect(second.ownership).toBe("none");
    }
    // …and the re-run did not touch it, nor the lock.
    expect(datasetPayload()).toBe(boot);
    expect(readDeliveryState()).toBe("locked");
  });

  it("a fresh state after a completed delivery preserves the customer dataset on re-evaluation", async () => {
    seedDemoEnv();
    await deliverProduction(CONFIRM);
    // Simulate the delivery keys being wiped (fresh deployment metadata, same
    // browser): the customer environment created by the first run must be
    // evaluated as customer-owned and preserved byte-for-byte.
    setDeliveryStorage(memoryDeliveryStorage());
    expect(readDeliveryState()).toBe("demo_active");
    const before = datasetPayload();

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: true, state: "locked", ownership: "customer" });
    expect(datasetPayload()).toBe(before);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
  });
});

describe("fail-closed ownership — every case preserves the data", () => {
  it("unreadable dataset → pending, payload untouched", async () => {
    seedDemoEnv();
    const garbage = "{definitely not json";
    localStorage.setItem(DEMO_STORAGE_KEY, garbage);

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: false, pending: true, reason: "dataset-unreadable", state: "removing" });
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(garbage);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("sample");
    expect(readDeliveryPending()?.reason).toBe("dataset-unreadable");
    // fail closed at the service layer while pending
    expect(() => assertDemoOperationAllowed("reset")).toThrow(DemoDisabledError);
    expect(isDestructiveOperationAllowed()).toBe(false);
  });

  it("corrupt lifecycle marker → pending ownership-unproven, dataset untouched", async () => {
    seedDemoEnv();
    const before = localStorage.getItem(DEMO_STORAGE_KEY);
    localStorage.setItem(LIFECYCLE_STORAGE_KEY, "banana");

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: false, pending: true, reason: "ownership-unproven" });
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("banana");
    expect(readDeliveryPending()?.reason).toBe("ownership-unproven");
  });

  it("marker-vs-provenance conflict → pending ownership-conflict, nothing deleted", async () => {
    seedDemoEnv();
    // Dataset stays readable and valid; only the ownership stamp disagrees.
    const raw = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as { provenance: { owner: string } };
    raw.provenance.owner = "customer";
    const before = JSON.stringify(raw);
    localStorage.setItem(DEMO_STORAGE_KEY, before);

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: false, pending: true, reason: "ownership-conflict" });
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("sample");
  });

  it("a legacy demo marker is still showcase-owned and deletable", async () => {
    seedDemoEnv();
    localStorage.setItem(LIFECYCLE_STORAGE_KEY, "demo");

    const outcome = await deliverProduction(CONFIRM);

    expect(outcome).toMatchObject({ ok: true, state: "locked", ownership: "demo" });
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
  });

  it("legacy demo payload without provenance → the marker governs (deletable)", async () => {
    seedDemoEnv();
    const raw = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as Record<string, unknown>;
    delete raw.provenance;
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(raw));

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: true, state: "locked", ownership: "demo" });
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(localStorage.getItem(DEMO_CREDENTIALS_KEY)).toBeNull();
  });

  it("customer environment → lock only, dataset bytes untouched", async () => {
    // An explicit customer environment: records exist from the visitor's own
    // work path (marker "empty", provenance stamped customer at creation).
    demoStore.initializeEnvironment("empty", createSeedDataset());
    const before = datasetPayload();
    expect(before).not.toBeNull();

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: true, state: "locked", ownership: "customer" });
    expect(datasetPayload()).toBe(before);
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    // no demo credential/session keys existed; nothing is invented or cleared
    expect(localStorage.getItem(DEMO_CREDENTIALS_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });
});

describe("interrupted delivery — refresh mid-operation", () => {
  it("resumes an existing `removing` waypoint to completion without restarting cleanup", async () => {
    seedDemoEnv();
    // Simulate a refresh right after the waypoint was written: state + pending
    // persisted, dataset fully intact, no destructive step yet.
    writeDeliveryState("removing");
    writeDeliveryPending("in-progress");
    expect(readDeliveryPending()?.reason).toBe("in-progress");

    const outcome = await deliverProduction(CONFIRM);
    expect(outcome).toMatchObject({ ok: true, state: "locked", changed: true, ownership: "demo" });
    expect(readDeliveryPending()).toBeNull();
    expect(localStorage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(localStorage.getItem(DEMO_CREDENTIALS_KEY)).toBeNull();
  });

  it("a parked delivery returns the recovery message and keeps the data for it", async () => {
    seedDemoEnv();
    // Ownership cannot be proven (marker corrupt) → the outcome must explain
    // the recovery path in Persian AND leave every byte in place.
    localStorage.setItem(LIFECYCLE_STORAGE_KEY, "banana");
    const outcome = await deliverProduction(CONFIRM);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.pending) {
      expect(outcome.message).toMatch(/ترمیم|دوباره/);
      expect(outcome.message).toContain("هیچ چیزی حذف نشد");
    } else {
      expect.unreachable("delivery must park pending on an unproven marker");
    }
    // …and the dataset survived the failed attempt for the recovery screen.
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toContain('"students"');
    expect(readDeliveryPending()?.reason).toBe("ownership-unproven");
  });
});

describe("evaluateDeliveryOwnership (unit)", () => {
  it("reports no-environment when nothing is stored", () => {
    expect(evaluateDeliveryOwnership(demoStore)).toEqual({ verdict: "no-environment" });
  });
});
