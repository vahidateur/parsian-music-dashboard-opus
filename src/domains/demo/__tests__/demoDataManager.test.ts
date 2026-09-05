import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { createBackup } from "@/domains/demo/backup";
import { createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS } from "@/domains/demo/types";
import { DEMO_STORAGE_KEY, DemoStoreImpl, memoryStorage, type StorageLike } from "@/services/demoStore";

const CONFIRM = { confirm: true } as const;

function makeManager() {
  const storage = memoryStorage();
  const store = new DemoStoreImpl(storage);
  return { storage, store, manager: new DemoDataManager(store) };
}

describe("initialize", () => {
  it("seeds when no demo database exists", () => {
    const { manager, store } = makeManager();
    expect(store.isInitialized()).toBe(false);
    const result = manager.initialize();
    expect(result.ok && result.changed).toBe(true);
    expect(store.isInitialized()).toBe(true);
    expect(manager.stats().counts.students).toBeGreaterThan(0);
  });

  it("is idempotent and never overwrites existing data", () => {
    const { manager, store } = makeManager();
    manager.initialize();
    store.students.create({ ...createSeedDataset().students[0], name: "کاربر محلی" } as never);
    const before = manager.stats().counts.students;
    const again = manager.initialize();
    expect(again.changed).toBe(false);
    expect(manager.stats().counts.students).toBe(before);
  });
});

describe("reset / clear / import seed", () => {
  let ctx: ReturnType<typeof makeManager>;
  beforeEach(() => {
    ctx = makeManager();
    ctx.manager.initialize();
  });

  it("reset restores the canonical dataset", () => {
    ctx.store.students.remove(ctx.store.students.all()[0].id);
    const result = ctx.manager.resetToSeed(CONFIRM);
    expect(result.ok).toBe(true);
    expect(ctx.manager.stats().counts.students).toBe(createSeedDataset().students.length);
  });

  it("clear empties every collection but keeps a valid environment", () => {
    const result = ctx.manager.clear(CONFIRM);
    expect(result.ok).toBe(true);
    for (const name of DEMO_COLLECTIONS) expect(ctx.manager.stats().counts[name]).toBe(0);
    expect(ctx.manager.snapshot().organization.name.length).toBeGreaterThan(0);
  });

  it("import seed is distinct from clear and restores records", () => {
    ctx.manager.clear(CONFIRM);
    expect(ctx.manager.stats().total).toBe(0);
    const result = ctx.manager.importSeed(CONFIRM);
    expect(result.ok && result.operation).toBe("import-seed");
    expect(ctx.manager.stats().total).toBeGreaterThan(0);
  });

  it("every destructive operation requires explicit confirmation", () => {
    const unconfirmed = { confirm: false } as unknown as typeof CONFIRM;
    const before = ctx.manager.stats().total;
    for (const call of [
      () => ctx.manager.resetToSeed(unconfirmed),
      () => ctx.manager.clear(unconfirmed),
      () => ctx.manager.importSeed(unconfirmed),
      () => ctx.manager.restoreBackup("{}", unconfirmed),
    ]) {
      expect(call().ok).toBe(false);
    }
    expect(ctx.manager.stats().total).toBe(before);
  });

  it("takes a safety backup before destructive operations", () => {
    const result = ctx.manager.clear(CONFIRM);
    expect(result.ok && result.safetyBackup?.data.students.length).toBeGreaterThan(0);
  });
});

describe("export / restore", () => {
  it("round-trips the demo state", () => {
    const ctx = makeManager();
    ctx.manager.initialize();
    const json = ctx.manager.exportBackupJson();
    ctx.manager.clear(CONFIRM);
    expect(ctx.manager.stats().total).toBe(0);

    const result = ctx.manager.restoreBackup(json, CONFIRM);
    expect(result.ok).toBe(true);
    expect(ctx.manager.stats().total).toBe(createSeedDataset().students.length > 0 ? ctx.manager.stats().total : 0);
    expect(ctx.manager.snapshot().students.length).toBe(createSeedDataset().students.length);
  });

  it("rejects malformed JSON and leaves the state unchanged", () => {
    const ctx = makeManager();
    ctx.manager.initialize();
    const before = JSON.stringify(ctx.manager.snapshot());
    const result = ctx.manager.restoreBackup("{{{", CONFIRM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe("MALFORMED_JSON");
    expect(JSON.stringify(ctx.manager.snapshot())).toBe(before);
  });

  it("rejects an unsupported schema version without touching data", () => {
    const ctx = makeManager();
    ctx.manager.initialize();
    const before = JSON.stringify(ctx.manager.snapshot());
    const bad = JSON.stringify({ ...createBackup(createSeedDataset()), schemaVersion: "0.1" });
    expect(ctx.manager.restoreBackup(bad, CONFIRM).ok).toBe(false);
    expect(JSON.stringify(ctx.manager.snapshot())).toBe(before);
  });

  it("rejects invalid entity relationships without touching data", () => {
    const ctx = makeManager();
    ctx.manager.initialize();
    const before = JSON.stringify(ctx.manager.snapshot());
    const dataset = createSeedDataset();
    dataset.sessions[0].classId = "cl_ghost";
    const result = ctx.manager.restoreBackup(JSON.stringify(createBackup(dataset)), CONFIRM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.code === "INVALID_REFERENCE")).toBe(true);
    expect(JSON.stringify(ctx.manager.snapshot())).toBe(before);
  });

  it("restore is atomic — a failing write leaves the previous state intact", () => {
    const storage = memoryStorage();
    const store = new DemoStoreImpl(storage);
    const manager = new DemoDataManager(store);
    manager.initialize();
    const before = JSON.stringify(manager.snapshot());

    const failing = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const result = manager.restoreBackup(manager.exportBackupJson(), CONFIRM);
    failing.mockRestore();

    expect(result.ok).toBe(false);
    expect(JSON.stringify(manager.snapshot())).toBe(before);
  });

  it("never partially restores: invalid input performs zero writes", () => {
    const storage: StorageLike = memoryStorage();
    const store = new DemoStoreImpl(storage);
    const manager = new DemoDataManager(store);
    manager.initialize();
    const writes = vi.spyOn(storage, "setItem");
    const dataset = createSeedDataset();
    dataset.students.push({ ...dataset.students[0] });
    manager.restoreBackup(JSON.stringify(createBackup(dataset)), CONFIRM);
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
  });
});

describe("persistence boundary", () => {
  it("uses a single localStorage key — no second demo database", () => {
    const storage = memoryStorage();
    const keys: string[] = [];
    const wrapped: StorageLike = {
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => {
        keys.push(k);
        storage.setItem(k, v);
      },
      removeItem: (k) => storage.removeItem(k),
    };
    const manager = new DemoDataManager(new DemoStoreImpl(wrapped));
    manager.initialize();
    manager.resetToSeed(CONFIRM);
    manager.clear(CONFIRM);
    manager.importSeed(CONFIRM);
    expect(new Set(keys)).toEqual(new Set([DEMO_STORAGE_KEY]));
  });
});
