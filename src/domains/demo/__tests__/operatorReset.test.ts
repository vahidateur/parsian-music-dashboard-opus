/**
 * Operator Import / Reset on the fixture graph.
 *
 * Ownership is the delivery verdict. A pristine empty envelope is importable
 * and is not treated as a customer refusal. Customer records and unproven
 * envelopes are not written. Reset deletes only demo-owned blobs, and a blob
 * failure leaves the dataset untouched. `demo.manage` is enforced here, not
 * only in the panel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  memoryDeliveryStorage,
  setDeliveryStorage,
  writeDeliveryState,
} from "@/api/deploymentLock";
import type { PermissionHolder } from "@/domains/auth/permissions";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createEmptyEnvironment } from "@/domains/demo/lifecycle";
import { createSeedDataset, SEED_VERSION } from "@/domains/demo/seed";
import { SEED_DATE } from "@/domains/demo/schedulingSeed";
import { validateDataset } from "@/domains/demo/backup";
import { demoOwnedBlobIds, evaluateDeliveryOwnership } from "@/domains/demo/delivery";
import { createMemoryBlobStore, setBlobStore, type BlobStore } from "@/domains/media/blobStore";
import { validateDatasetArtifact } from "@/dataset/validate";
import { DATASET_SCHEMA_VERSION } from "@/dataset/schema";
import {
  DemoStoreImpl,
  DEMO_STORAGE_KEY,
  LIFECYCLE_STORAGE_KEY,
  memoryStorage,
  type StorageLike,
} from "@/services/demoStore";

const CONFIRM = { confirm: true } as const;
const ACTOR: PermissionHolder = { permissions: ["demo.manage"] };
const NO_ACTOR: PermissionHolder = { permissions: ["students.read"] };

function makeManager(storage: StorageLike = memoryStorage()) {
  const store = new DemoStoreImpl(storage);
  return { storage, store, manager: new DemoDataManager(store) };
}

function snapshot(store: DemoStoreImpl): string {
  return JSON.stringify({
    initialized: store.isInitialized(),
    marker: store.readLifecycleMarker(),
    rawMarker: store.peekLifecycleMarkerValue(),
    data: store.isInitialized() ? store.snapshot() : null,
  });
}

function customerEnvelope() {
  const dataset = createEmptyEnvironment();
  dataset.students = [{ ...createSeedDataset().students[0] }];
  return dataset;
}

afterEach(() => {
  setBlobStore(undefined);
});

describe("operator Import", () => {
  it("installs createSeedDataset() into an uninitialized environment", () => {
    const { store, manager } = makeManager();
    const result = manager.importSample(CONFIRM, ACTOR);
    expect(result.ok && result.changed).toBe(true);
    expect(store.readLifecycleMarker()).toBe("sample");
    const raw = store.peekLifecycleMarkerValue();
    expect(raw.readable ? raw.value : null).toBe("sample");
    expect(store.snapshot().students.map((row) => row.id)).toEqual(createSeedDataset().students.map((row) => row.id));
    expect(evaluateDeliveryOwnership(store).verdict).toBe("demo");
  });

  it("imports a pristine empty envelope instead of treating it as customer-owned", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("empty", createEmptyEnvironment());
    const result = manager.importSample(CONFIRM, ACTOR);
    expect(result.ok && result.changed).toBe(true);
    expect(store.readLifecycleMarker()).toBe("sample");
    expect(store.snapshot().students).toEqual(createSeedDataset().students);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("demo");
  });

  it("reinstalls a changed demo envelope and is idempotent when the seed is already installed", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const changed = store.snapshot();
    changed.students = changed.students.slice(1);
    store.replace(changed);
    const reinstalled = manager.importSample(CONFIRM, ACTOR);
    expect(reinstalled.ok && reinstalled.changed).toBe(true);
    expect(store.snapshot().students).toEqual(createSeedDataset().students);

    const again = manager.importSample(CONFIRM, ACTOR);
    const after = snapshot(store);
    expect(again.ok && again.changed).toBe(false);
    expect(snapshot(store)).toBe(after);
  });

  it("does not write a customer envelope that has its own records", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("empty", customerEnvelope());
    const before = snapshot(store);
    const result = manager.importSample(CONFIRM, ACTOR);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("customer");
  });

  it("does not write an unproven environment", () => {
    const { storage, store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    storage.setItem(LIFECYCLE_STORAGE_KEY, "banana");
    const before = snapshot(store);
    const result = manager.importSample(CONFIRM, ACTOR);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("unproven");
  });

  it("rejects an invalid payload shape without a write path for that payload", () => {
    const broken = createSeedDataset();
    broken.students = "not-a-collection" as unknown as typeof broken.students;
    const issues = validateDataset(broken);
    expect(issues.some((issue) => issue.code === "INVALID_COLLECTION")).toBe(true);
    const { store, manager } = makeManager();
    const before = snapshot(store);
    const source = readFileSync(join(process.cwd(), "src/domains/demo/demoDataManager.ts"), "utf8");
    const validateAt = source.indexOf("validateDataset(dataset)");
    const installAt = source.indexOf("initializeEnvironment(\"sample\", dataset)");
    expect(validateAt).toBeGreaterThan(0);
    expect(installAt).toBeGreaterThan(validateAt);
    expect(manager.importSample.length).toBeLessThanOrEqual(2);
    expect(snapshot(store)).toBe(before);
  });

  it("does not install a schema or version the artifact contract rejects", () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), "data/dataset/manifest.json"), "utf8")) as {
      schemaVersion: string;
      datasetVersion: string;
    };
    expect(manifest.schemaVersion).toBe(DATASET_SCHEMA_VERSION);
    expect(manifest.datasetVersion).toBe(SEED_VERSION);
    expect(validateDatasetArtifact()).toEqual([]);
    const source = readFileSync(join(process.cwd(), "src/domains/demo/demoDataManager.ts"), "utf8");
    expect(source).not.toContain("loadDatasetArtifact");
    expect(source).not.toMatch(/from ["']@\/dataset\//);
  });

  it("leaves the previous envelope in place when the dataset write throws", () => {
    let failDataset = false;
    const base = memoryStorage();
    const storage: StorageLike = {
      getItem: (key) => base.getItem(key),
      setItem: (key, value) => {
        if (failDataset && key === DEMO_STORAGE_KEY) throw new Error("disk full");
        base.setItem(key, value);
      },
      removeItem: (key) => base.removeItem(key),
    };
    const { store, manager } = makeManager(storage);
    store.initializeEnvironment("empty", createEmptyEnvironment());
    const before = snapshot(store);
    failDataset = true;
    const result = manager.importSample(CONFIRM, ACTOR);
    failDataset = false;
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });
});

describe("operator Reset", () => {
  it("turns a proven demo environment into empty and keeps system configuration", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    return manager.resetToClean(CONFIRM, ACTOR).then((result) => {
      expect(result.ok && result.changed).toBe(true);
      expect(store.readLifecycleMarker()).toBe("empty");
      expect(evaluateDeliveryOwnership(store).verdict).toBe("customer");
      const empty = createEmptyEnvironment();
      const current = store.snapshot();
      expect(current.students).toEqual([]);
      expect(current.users).toEqual(empty.users);
      expect(current.roles).toEqual(empty.roles);
      expect(current.organization).toEqual(empty.organization);
      expect(current.branding).toEqual(empty.branding);
    });
  });

  it("deletes only demo-owned blobs and keeps an unknown blob", async () => {
    const blobs = createMemoryBlobStore();
    setBlobStore(blobs);
    const owned = demoOwnedBlobIds()[0];
    await blobs.put(owned, new Uint8Array([1]).buffer, "application/octet-stream");
    await blobs.put("unknown-blob", new Uint8Array([2]).buffer, "application/octet-stream");
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const result = await manager.resetToClean(CONFIRM, ACTOR);
    expect(result.ok && result.changed).toBe(true);
    expect(await blobs.get(owned)).toBeUndefined();
    expect(await blobs.get("unknown-blob")).toBeInstanceOf(Blob);
  });

  it("does not modify the dataset when blob deletion fails", async () => {
    const failing: BlobStore = {
      async put() {},
      async get() {
        return undefined;
      },
      async remove() {
        throw new Error("blob store unavailable");
      },
      async clear() {
        throw new Error("must not clear the blob store");
      },
    };
    setBlobStore(failing);
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const before = snapshot(store);
    const result = await manager.resetToClean(CONFIRM, ACTOR);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("does not write a customer envelope", async () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("empty", customerEnvelope());
    const before = snapshot(store);
    const result = await manager.resetToClean(CONFIRM, ACTOR);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("does not write an unproven environment", async () => {
    const { storage, store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    storage.setItem(LIFECYCLE_STORAGE_KEY, "banana");
    const before = snapshot(store);
    const result = await manager.resetToClean(CONFIRM, ACTOR);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("is a no-op when uninitialized", async () => {
    const { store, manager } = makeManager();
    const before = snapshot(store);
    const result = await manager.resetToClean(CONFIRM, ACTOR);
    expect(result.ok && result.changed).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(store.isInitialized()).toBe(false);
  });

  it("is a no-op on an already empty environment, including a second reset", async () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const first = await manager.resetToClean(CONFIRM, ACTOR);
    expect(first.ok && first.changed).toBe(true);
    const before = snapshot(store);
    const second = await manager.resetToClean(CONFIRM, ACTOR);
    expect(second.ok && second.changed).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("rejects a caller without demo.manage and writes nothing", async () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const before = snapshot(store);
    const missing = await manager.resetToClean(CONFIRM, null);
    const other = await manager.resetToClean(CONFIRM, NO_ACTOR);
    expect(missing.ok).toBe(false);
    expect(other.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(manager.importSample(CONFIRM, null).ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("respects the delivery lock", async () => {
    const previous = setDeliveryStorage(memoryDeliveryStorage());
    try {
      const { store, manager } = makeManager();
      store.initializeEnvironment("sample", createSeedDataset());
      const before = snapshot(store);
      writeDeliveryState("removing");
      const blocked = await manager.resetToClean(CONFIRM, ACTOR);
      expect(blocked.ok).toBe(false);
      expect(manager.importSample(CONFIRM, ACTOR).ok).toBe(false);
      expect(snapshot(store)).toBe(before);
      writeDeliveryState("locked");
      const disabled = await manager.resetToClean(CONFIRM, ACTOR);
      expect(disabled.ok).toBe(false);
      expect(snapshot(store)).toBe(before);
    } finally {
      setDeliveryStorage(previous);
    }
  });

  it("does not delete credential material", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/demo/demoDataManager.ts"), "utf8");
    expect(source).not.toContain("DEMO_CREDENTIALS_KEY");
    expect(source).not.toContain("credentialStore");
    expect(source).not.toContain("localStorage.clear(");
  });

  it("reads a legacy demo marker as sample without rewriting it", () => {
    const { storage, store } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    storage.setItem(LIFECYCLE_STORAGE_KEY, "demo");
    expect(store.readLifecycleMarker()).toBe("sample");
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
  });

  it("does not read the dataset artifact, and does not change the seed constants", () => {
    const managerSource = readFileSync(join(process.cwd(), "src/domains/demo/demoDataManager.ts"), "utf8");
    const panelSource = readFileSync(join(process.cwd(), "src/components/settings/DemoDataPanel.tsx"), "utf8");
    const clientFeatures = readFileSync(join(process.cwd(), "src/targets/targetFeatures.client.tsx"), "utf8");
    expect(managerSource).not.toContain("loadDatasetArtifact");
    expect(managerSource).not.toMatch(/from ["']@\/dataset\//);
    expect(managerSource).not.toContain("store.reset(");
    expect(managerSource).not.toContain("blobStore.clear(");
    expect(managerSource).not.toContain("localStorage.clear(");
    expect(panelSource).toContain("data-operator-import");
    expect(panelSource).toContain("data-operator-reset");
    expect(clientFeatures).not.toContain("DemoDataPanel");
    expect(clientFeatures).not.toContain("data-operator-import");
    expect(SEED_VERSION).toBe("2026.09.2");
    expect(SEED_DATE).toBe("2026-09-01");
  });
});
