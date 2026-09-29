/**
 * Operator Import / Reset. Ownership is the delivery verdict, not a second
 * classifier. Customer and unproven are not written. Empty and uninitialized
 * Reset is a no-op. The sample payload is createSeedDataset(), not the
 * dataset artifact.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createEmptyEnvironment } from "@/domains/demo/lifecycle";
import { createSeedDataset, SEED_VERSION } from "@/domains/demo/seed";
import { SEED_DATE } from "@/domains/demo/schedulingSeed";
import { evaluateDeliveryOwnership } from "@/domains/demo/delivery";
import { DemoStoreImpl, LIFECYCLE_STORAGE_KEY, memoryStorage } from "@/services/demoStore";

const CONFIRM = { confirm: true } as const;

function makeManager() {
  const storage = memoryStorage();
  const store = new DemoStoreImpl(storage);
  return { storage, store, manager: new DemoDataManager(store) };
}

function snapshot(store: DemoStoreImpl): string {
  return JSON.stringify({
    initialized: store.isInitialized(),
    marker: store.readLifecycleMarker(),
    data: store.isInitialized() ? store.snapshot() : null,
  });
}

describe("operator Import", () => {
  it("installs createSeedDataset() into an uninitialized environment", () => {
    const { store, manager } = makeManager();
    const result = manager.importSample(CONFIRM);
    expect(result.ok && result.changed).toBe(true);
    expect(store.readLifecycleMarker()).toBe("sample");
    expect(store.snapshot().students).toEqual(createSeedDataset().students);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("demo");
  });

  it("does not write a customer environment", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("empty", createEmptyEnvironment());
    const before = snapshot(store);
    const result = manager.importSample(CONFIRM);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("customer");
  });

  it("does not write an unproven environment", () => {
    const { storage, store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    storage.setItem(LIFECYCLE_STORAGE_KEY, "banana");
    const before = snapshot(store);
    const result = manager.importSample(CONFIRM);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(evaluateDeliveryOwnership(store).verdict).toBe("unproven");
  });
});

describe("operator Reset", () => {
  it("turns a proven demo environment into empty", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    const result = manager.resetToClean(CONFIRM);
    expect(result.ok && result.changed).toBe(true);
    expect(store.readLifecycleMarker()).toBe("empty");
    expect(evaluateDeliveryOwnership(store).verdict).toBe("customer");
    expect(store.snapshot().students).toEqual([]);
  });

  it("does not write a customer environment", () => {
    const { store, manager } = makeManager();
    const dataset = createEmptyEnvironment();
    dataset.students = [{ ...createSeedDataset().students[0] }];
    store.initializeEnvironment("empty", dataset);
    const before = snapshot(store);
    const result = manager.resetToClean(CONFIRM);
    expect(result.ok && result.changed).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("does not write an unproven environment", () => {
    const { storage, store, manager } = makeManager();
    store.initializeEnvironment("sample", createSeedDataset());
    storage.setItem(LIFECYCLE_STORAGE_KEY, "banana");
    const before = snapshot(store);
    const result = manager.resetToClean(CONFIRM);
    expect(result.ok).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("is a no-op when uninitialized", () => {
    const { store, manager } = makeManager();
    const before = snapshot(store);
    const result = manager.resetToClean(CONFIRM);
    expect(result.ok && result.changed).toBe(false);
    expect(snapshot(store)).toBe(before);
    expect(store.isInitialized()).toBe(false);
  });

  it("is a no-op on an already empty environment", () => {
    const { store, manager } = makeManager();
    store.initializeEnvironment("empty", createEmptyEnvironment());
    const before = snapshot(store);
    const result = manager.resetToClean(CONFIRM);
    expect(result.ok && result.changed).toBe(false);
    expect(snapshot(store)).toBe(before);
  });

  it("does not read the dataset artifact, and does not change the seed constants", () => {
    const managerSource = readFileSync(join(process.cwd(), "src/domains/demo/demoDataManager.ts"), "utf8");
    const panelSource = readFileSync(join(process.cwd(), "src/components/settings/DemoDataPanel.tsx"), "utf8");
    expect(managerSource).not.toContain("loadDatasetArtifact");
    expect(managerSource).not.toMatch(/from ["']@\/dataset\//);
    expect(panelSource).toContain("data-operator-import");
    expect(panelSource).toContain("data-operator-reset");
    expect(SEED_VERSION).toBe("2026.09.2");
    expect(SEED_DATE).toBe("2026-09-01");
  });
});
