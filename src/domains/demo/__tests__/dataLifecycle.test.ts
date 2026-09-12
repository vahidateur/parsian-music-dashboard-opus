/**
 * Data lifecycle — UNINITIALIZED → EMPTY | DEMO.
 *
 * The invariants this file exists to pin:
 *
 *  - a READ never decides, writes, seeds or deletes anything;
 *  - the mode is a persisted FACT (`ava:demo:lifecycle`), never inferred from
 *    how many rows happen to exist;
 *  - initialization is refused once an environment exists, so neither choice can
 *    destroy a customer's data;
 *  - demo bytes — the `res1` resource, its `md_demo_res1` media asset and the
 *    stored blob — exist ONLY in a DEMO environment;
 *  - a dataset that predates the marker is adopted as DEMO with every record
 *    preserved, and the adoption is recorded exactly once.
 *
 * Hermetic by construction: each case builds its own `memoryStorage()` and its
 * own store, and passes the store explicitly, so nothing here touches the
 * singleton, the DOM or another test's state.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  createEmptyEnvironment,
  initializeDemoEnvironment,
  initializeEmptyEnvironment,
  isDemoEnvironment,
  markLifecycle,
  persistLifecycleAdoption,
  readLifecycleState,
  uninitializeEnvironment,
} from "@/domains/demo/lifecycle";
import {
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_MIME_TYPE,
  DEMO_LIBRARY_RESOURCE_ID,
  demoLibraryFileBytes,
} from "@/domains/demo/librarySeed";
import { createEmptyDataset, createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS } from "@/domains/demo/types";
import { validateDataset } from "@/domains/demo/backup";
import { createMemoryBlobStore, getBlobStore, setBlobStore } from "@/domains/media/blobStore";
import {
  DEMO_STORAGE_KEY,
  LIFECYCLE_STORAGE_KEY,
  DemoStoreImpl,
  memoryStorage,
  type StorageLike,
} from "@/services/demoStore";

/** Academy content — everything except the access bootstrap (users/roles). */
const CONTENT_COLLECTIONS = DEMO_COLLECTIONS.filter((name) => name !== "users" && name !== "roles");

/** One isolated environment per case. */
function createEnvironment() {
  const storage = memoryStorage();
  const store = new DemoStoreImpl(storage);
  return { storage, store, manager: new DemoDataManager(store) };
}

/** Which lifecycle keys hold anything, so "wrote nothing" is checkable. */
function writtenKeys(storage: StorageLike): string[] {
  return [DEMO_STORAGE_KEY, LIFECYCLE_STORAGE_KEY].filter((key) => storage.getItem(key) !== null);
}

beforeEach(() => {
  setBlobStore(createMemoryBlobStore());
  setRuntimeConfig({ mode: "demo", error: null });
});

afterEach(() => {
  resetRuntimeConfig();
});

describe("UNINITIALIZED", () => {
  it("is the state of storage that was never given an environment", () => {
    const { store } = createEnvironment();

    expect(readLifecycleState(store)).toBe("uninitialized");
    expect(store.isInitialized()).toBe(false);
    expect(store.readLifecycleMarker()).toBe(null);
  });

  it("is also the state when a marker survived without its dataset", () => {
    // Only an interrupted creation or manual tampering produces this. Re-offering
    // the choice is the safe recovery: there is nothing to overwrite or lose.
    const { storage, store } = createEnvironment();
    storage.setItem(LIFECYCLE_STORAGE_KEY, "demo");

    expect(readLifecycleState(store)).toBe("uninitialized");
    expect(store.isInitialized()).toBe(false);
  });

  it("reads without writing, seeding or deleting anything", () => {
    const { storage, store } = createEnvironment();

    // Every read a repository, a metric or a render can perform...
    expect(store.snapshot().students).toEqual([]);
    expect(store.students.all()).toEqual([]);
    expect(store.isInitialized()).toBe(false);
    expect(readLifecycleState(store)).toBe("uninitialized");
    expect(isDemoEnvironment(store)).toBe(false);

    // ...and storage is still exactly as empty as it started. No implicit demo
    // dataset, no marker, no "helpful" repair.
    expect(writtenKeys(storage)).toEqual([]);
  });

  it("answers reads with a valid dataset so no reader can crash", () => {
    const { store } = createEnvironment();
    const snapshot = store.snapshot();

    for (const name of DEMO_COLLECTIONS) {
      expect(Array.isArray(snapshot[name]), `${name} must still be an array`).toBe(true);
    }
    expect(snapshot.organization.direction).toBe("rtl");
    expect(typeof snapshot.branding.academyName).toBe("string");
    expect(validateDataset(snapshot)).toEqual([]);
  });
});

describe("EMPTY initialization", () => {
  it("persists the empty marker with zero academy records", () => {
    const { storage, store } = createEnvironment();

    const result = initializeEmptyEnvironment(store);

    expect(result).toMatchObject({ ok: true, state: "empty", changed: true });
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(readLifecycleState(store)).toBe("empty");

    const snapshot = store.snapshot();
    for (const name of CONTENT_COLLECTIONS) {
      expect(snapshot[name], `${name} must be empty in a customer environment`).toHaveLength(0);
    }
  });

  it("ships one bootstrap administrator so the environment can be signed into", () => {
    const { store } = createEnvironment();
    initializeEmptyEnvironment(store);

    const { users, roles } = store.snapshot();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(BOOTSTRAP_ADMIN_EMAIL);
    expect(users[0].role).toBe("administrator");
    expect(users[0].status).toBe("active");
    // The RBAC projection is access, not content: without it the role cannot
    // resolve and the dataset would not even validate.
    expect(roles.some((role) => role.id === "administrator")).toBe(true);
  });

  it("is a valid dataset, so a customer can back it up and restore it", () => {
    expect(validateDataset(createEmptyEnvironment())).toEqual([]);
  });

  it("contains no demo media, library record or demo blob", async () => {
    const { store } = createEnvironment();
    initializeEmptyEnvironment(store);

    const snapshot = store.snapshot();
    expect(snapshot.media).toHaveLength(0);
    expect(snapshot.resources).toHaveLength(0);
    expect(snapshot.learningContent).toHaveLength(0);
    expect(snapshot.resources.some((row) => row.id === DEMO_LIBRARY_RESOURCE_ID)).toBe(false);
    expect(snapshot.media.some((row) => row.id === DEMO_LIBRARY_ASSET_ID)).toBe(false);
    expect(await getBlobStore().get(DEMO_LIBRARY_ASSET_ID)).toBeFalsy();
  });

  it("refuses to erase an existing environment", () => {
    const { storage, store } = createEnvironment();
    initializeDemoEnvironment(store);
    const before = storage.getItem(DEMO_STORAGE_KEY);

    const result = initializeEmptyEnvironment(store);

    expect(result).toMatchObject({ ok: false, reason: "already-initialized", changed: false });
    expect(readLifecycleState(store)).toBe("demo");
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(store.snapshot().students.length).toBeGreaterThan(0);
  });
});

describe("DEMO initialization", () => {
  it("persists the demo marker with the canonical showcase dataset", () => {
    const { storage, store } = createEnvironment();

    const result = initializeDemoEnvironment(store);

    expect(result).toMatchObject({ ok: true, state: "demo", changed: true });
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(readLifecycleState(store)).toBe("demo");
    expect(isDemoEnvironment(store)).toBe(true);

    const snapshot = store.snapshot();
    expect(snapshot.students.length).toBeGreaterThan(0);
    expect(snapshot.teachers.length).toBeGreaterThan(0);
    expect(snapshot.chatConversations.length).toBeGreaterThan(0);
  });

  it("carries the demo library record and its media asset", () => {
    const { store } = createEnvironment();
    initializeDemoEnvironment(store);

    const snapshot = store.snapshot();
    expect(snapshot.resources.some((row) => row.id === DEMO_LIBRARY_RESOURCE_ID)).toBe(true);
    expect(snapshot.media.some((row) => row.id === DEMO_LIBRARY_ASSET_ID)).toBe(true);
  });

  it("is idempotent: a second call refuses and changes nothing", () => {
    const { storage, store } = createEnvironment();
    initializeDemoEnvironment(store);
    const dataset = storage.getItem(DEMO_STORAGE_KEY);
    const marker = storage.getItem(LIFECYCLE_STORAGE_KEY);

    const second = initializeDemoEnvironment(store);

    expect(second).toMatchObject({ ok: false, reason: "already-initialized", changed: false });
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(dataset);
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe(marker);
    expect(readLifecycleState(store)).toBe("demo");
  });
});

describe("explicit mode persistence", () => {
  it("survives a reload", () => {
    const { storage, store } = createEnvironment();
    initializeEmptyEnvironment(store);

    // A reload is a new store over the same storage.
    const reloaded = new DemoStoreImpl(storage);

    expect(readLifecycleState(reloaded)).toBe("empty");
    expect(reloaded.isInitialized()).toBe(true);
    expect(store.snapshot().users).toEqual(reloaded.snapshot().users);
  });

  it("is not inferred from row counts: a cleared DEMO is still DEMO", () => {
    const { storage, store } = createEnvironment();
    initializeDemoEnvironment(store);

    // `demoDataManager.clear()` is exactly this write, with no mode argument.
    store.replace(createEmptyDataset());

    expect(readLifecycleState(store)).toBe("demo");
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(store.snapshot().students).toHaveLength(0);
    expect(isDemoEnvironment(store)).toBe(true);
  });

  it("is not inferred from row counts: an EMPTY environment with records is still EMPTY", () => {
    const { storage, store } = createEnvironment();
    initializeEmptyEnvironment(store);

    const seeded = createSeedDataset();
    store.replace({
      ...store.snapshot(),
      students: seeded.students.slice(0, 3),
      teachers: seeded.teachers.slice(0, 1),
    });

    expect(readLifecycleState(store)).toBe("empty");
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("empty");
    expect(store.snapshot().students).toHaveLength(3);
    // Real data in a real environment: no demo affordances.
    expect(isDemoEnvironment(store)).toBe(false);
  });

  it("records DEMO when an explicit operation installs demo-sourced data", () => {
    const { store, manager } = createEnvironment();
    initializeEmptyEnvironment(store);

    const result = manager.resetToSeed({ confirm: true });

    expect(result.ok).toBe(true);
    expect(readLifecycleState(store)).toBe("demo");
    expect(store.snapshot().students.length).toBeGreaterThan(0);
  });

  it("keeps the mode across clear, and refuses both without confirmation", () => {
    const { store, manager } = createEnvironment();
    initializeDemoEnvironment(store);

    expect(manager.clear({ confirm: true }).ok).toBe(true);
    expect(readLifecycleState(store)).toBe("demo");

    // Destructive operations are confirm-gated, and a refusal writes nothing.
    const before = store.snapshot();
    expect(manager.clear({} as { confirm: true }).ok).toBe(false);
    expect(manager.resetToSeed({} as { confirm: true }).ok).toBe(false);
    expect(store.snapshot()).toEqual(before);
    expect(readLifecycleState(store)).toBe("demo");
  });

  it("markLifecycle records a mode without touching the dataset", () => {
    const { storage, store } = createEnvironment();
    initializeEmptyEnvironment(store);
    const before = storage.getItem(DEMO_STORAGE_KEY);

    markLifecycle("demo", store);

    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(readLifecycleState(store)).toBe("demo");
  });
});

describe("legacy migration (a dataset that predates the marker)", () => {
  /** A payload exactly as a previous build left it: dataset, no marker. */
  function legacyEnvironment() {
    const env = createEnvironment();
    env.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(createSeedDataset()));
    return env;
  }

  it("is adopted as DEMO, never as EMPTY", () => {
    const { store } = legacyEnvironment();

    expect(store.readLifecycleMarker()).toBe(null);
    expect(store.isInitialized()).toBe(true);
    expect(readLifecycleState(store)).toBe("demo");
    expect(persistLifecycleAdoption(store)).toBe("demo");
  });

  it("preserves every record the visitor already had", () => {
    const { storage, store } = legacyEnvironment();
    const before = storage.getItem(DEMO_STORAGE_KEY);

    const students = store.snapshot().students;
    expect(students.length).toBeGreaterThan(0);
    persistLifecycleAdoption(store);

    // The marker key is the ONLY thing adoption writes — no record is touched,
    // reseeded, reordered or repaired.
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(before);
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("demo");
    expect(store.snapshot().students).toEqual(students);
  });

  it("records the adoption once and is idempotent", () => {
    const { store } = legacyEnvironment();

    expect(persistLifecycleAdoption(store)).toBe("demo");
    expect(store.readLifecycleMarker()).toBe("demo");
    expect(persistLifecycleAdoption(store)).toBe("demo");
    expect(readLifecycleState(store)).toBe("demo");
  });

  it("adopts the visitor's own edited legacy records, not the shipped seed", () => {
    const { storage, store } = legacyEnvironment();
    const edited = store.snapshot();
    edited.students = [{ ...edited.students[0], name: "هنرجوی خود کاربر" }];
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(edited));
    storage.removeItem(LIFECYCLE_STORAGE_KEY);

    persistLifecycleAdoption(store);

    expect(store.snapshot().students).toHaveLength(1);
    expect(store.snapshot().students[0].name).toBe("هنرجوی خود کاربر");
    expect(readLifecycleState(store)).toBe("demo");
  });
});

describe("uninitializeEnvironment", () => {
  it("requires explicit confirmation and writes nothing without it", () => {
    const { storage, store } = createEnvironment();
    initializeDemoEnvironment(store);
    const dataset = storage.getItem(DEMO_STORAGE_KEY);

    return uninitializeEnvironment({} as { confirm: true }, store).then((result) => {
      expect(result.ok).toBe(false);
      expect(result.changed).toBe(false);
      expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(dataset);
      expect(readLifecycleState(store)).toBe("demo");
    });
  });

  it("removes the dataset, the marker and the stored binaries", async () => {
    const { storage, store } = createEnvironment();
    initializeDemoEnvironment(store);
    await getBlobStore().put(DEMO_LIBRARY_ASSET_ID, demoLibraryFileBytes(), DEMO_LIBRARY_MIME_TYPE);
    expect(await getBlobStore().get(DEMO_LIBRARY_ASSET_ID)).toBeTruthy();

    const result = await uninitializeEnvironment({ confirm: true }, store);

    expect(result).toMatchObject({ ok: true, state: "uninitialized", changed: true });
    expect(writtenKeys(storage)).toEqual([]);
    expect(readLifecycleState(store)).toBe("uninitialized");
    expect(await getBlobStore().get(DEMO_LIBRARY_ASSET_ID)).toBeFalsy();
  });

  it("preserves a blob cleanup failure verbatim while reporting the environment reset", async () => {
    const { storage, store } = createEnvironment();
    initializeEmptyEnvironment(store);

    const blobStore = createMemoryBlobStore();
    blobStore.clear = async () => {
      throw new Error("blob cleanup unavailable");
    };
    setBlobStore(blobStore);

    const result = await uninitializeEnvironment({ confirm: true }, store);

    expect(result).toEqual({
      ok: true,
      state: "uninitialized",
      changed: true,
      message:
        "محیط حذف شد و هیچ داده‌ای باقی نمانده است. دادهٔ محیط حذف شد، اما پاک‌کردن فایل‌های ذخیره‌شده ناموفق بود: blob cleanup unavailable",
    });
    expect(writtenKeys(storage)).toEqual([]);
    expect(readLifecycleState(store)).toBe("uninitialized");
  });

  it("is honest when there was no environment to remove", async () => {
    const { store } = createEnvironment();

    const result = await uninitializeEnvironment({ confirm: true }, store);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.state).toBe("uninitialized");
  });
});

describe("isDemoEnvironment", () => {
  it("is false in api mode even with a demo marker", () => {
    const { store } = createEnvironment();
    initializeDemoEnvironment(store);

    setRuntimeConfig({ mode: "api", error: null });

    // With a real backend there is no DemoStore environment to be demo, and demo
    // bytes must not be provisioned into it.
    expect(isDemoEnvironment(store)).toBe(false);
  });

  it("is true only for a DEMO environment running in demo mode", () => {
    const { store } = createEnvironment();

    expect(isDemoEnvironment(store)).toBe(false); // uninitialized
    initializeEmptyEnvironment(store);
    expect(isDemoEnvironment(store)).toBe(false); // EMPTY
    markLifecycle("demo", store);
    expect(isDemoEnvironment(store)).toBe(true); // DEMO
  });
});
