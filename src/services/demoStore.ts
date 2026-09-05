/**
 * DemoStore — the single persistence authority for demo mode.
 *
 * It holds ONE snapshot of the whole demo environment (`DemoDataset`) under a
 * single localStorage key, seeded from the canonical seed. Repositories adapt
 * this store to domain contracts; nothing else in the app may read or write
 * demo persistence directly.
 *
 * There is intentionally no second demo database: every collection lives in the
 * same snapshot, which is also what makes atomic restore possible.
 */
import { createSeedDataset } from "@/domains/demo/seed";
import { stripPrototypeKeys } from "@/domains/demo/backup";
import type { DemoDataset } from "@/domains/demo/types";
import type { Student } from "@/data/records";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "@/domains/auth/types";

export const DEMO_STORAGE_KEY = "ava:demo:dataset";
const STORAGE_PREFIX = "ava:demo:";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const probe = `${STORAGE_PREFIX}__probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/** In-memory fallback for SSR/tests/private mode — behaviour is identical. */
export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export class DemoStoreImpl {
  constructor(private readonly storage: StorageLike = safeStorage() ?? memoryStorage()) {}

  /**
   * Write notification.
   *
   * Every mutation funnels through `replace`, so one listener set here is
   * enough to keep every view consistent after any write, wherever it came
   * from (CRUD, import, reset, restore). Views never subscribe to this
   * directly — `@/domains/shared/dataVersion` bridges it into React so the
   * UI stays unaware of demo persistence.
   */
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    // A throwing listener must not abort the remaining notifications or the
    // write that triggered them.
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* a broken subscriber cannot break persistence */
      }
    });
  }

  /* ---------------- snapshot level ---------------- */

  /** Reads the persisted dataset, seeding it on first access. */
  snapshot(): DemoDataset {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        // localStorage is user-editable: strip prototype-polluting keys before
        // the snapshot reaches any spread/Object.assign in the repositories.
        const parsed: unknown = stripPrototypeKeys(JSON.parse(raw) as unknown);
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as DemoDataset).students)) {
          return parsed as DemoDataset;
        }
      } catch {
        /* corrupted payload — fall through and reseed */
      }
    }
    const seeded = createSeedDataset();
    this.replace(seeded);
    return seeded;
  }

  /** True when a demo dataset has already been persisted. */
  isInitialized(): boolean {
    return this.storage.getItem(DEMO_STORAGE_KEY) !== null;
  }

  /**
   * Atomically replaces the whole dataset. Serialization happens before the
   * write, so a value that cannot be serialized never clears existing state.
   */
  replace(dataset: DemoDataset): void {
    const serialized = JSON.stringify(dataset);
    this.storage.setItem(DEMO_STORAGE_KEY, serialized);
    this.emit();
  }

  /** Removes the persisted snapshot; the next read reseeds from the canonical seed. */
  reset(): void {
    this.storage.removeItem(DEMO_STORAGE_KEY);
    this.emit();
  }

  private mutate<T>(fn: (dataset: DemoDataset) => T): T {
    const dataset = this.snapshot();
    const result = fn(dataset);
    this.replace(dataset);
    return result;
  }

  /**
   * Generic CRUD over one array collection of the snapshot.
   *
   * Every domain collection has identical persistence semantics, so they share
   * one implementation rather than five near-copies. `prepend` keeps the
   * existing Students behaviour (newest first); other collections append.
   */
  private collection<K extends ArrayCollection>(name: K, prefix: string, prepend = false) {
    type Row = DemoDataset[K][number];
    return {
      all: (): Row[] => clone(this.snapshot()[name]) as Row[],
      find: (id: string): Row | undefined =>
        (this.snapshot()[name] as ReadonlyArray<{ id: string }>).find((r) => r.id === id) as Row | undefined,
      create: (draft: Omit<Row, "id"> & { id?: string }): Row =>
        this.mutate((dataset) => {
          const created = { ...clone(draft), id: draft.id ?? nextId(prefix) } as Row;
          const rows = dataset[name] as Row[];
          dataset[name] = (prepend ? [created, ...rows] : [...rows, created]) as DemoDataset[K];
          return clone(created);
        }),
      update: (id: string, patch: Partial<Omit<Row, "id">>): Row | undefined =>
        this.mutate((dataset) => {
          const rows = dataset[name] as Row[];
          const index = rows.findIndex((r) => (r as { id: string }).id === id);
          if (index === -1) return undefined;
          const updated = { ...rows[index], ...clone(patch), id } as Row;
          rows[index] = updated;
          return clone(updated);
        }),
      remove: (id: string): boolean =>
        this.mutate((dataset) => {
          const rows = dataset[name] as ReadonlyArray<{ id: string }>;
          const next = rows.filter((r) => r.id !== id);
          if (next.length === rows.length) return false;
          dataset[name] = next as DemoDataset[K];
          return true;
        }),
    };
  }

  /* ---------------- domain collections ---------------- */

  readonly students = this.collection("students", "st_", true);
  readonly teachers = this.collection("teachers", "t_");
  readonly rooms = this.collection("rooms", "r_");
  readonly classes = this.collection("classes", "cl_");
  readonly enrollments = this.collection("enrollments", "enr_");

  /* ---------------- users (auth domain) ---------------- */

  readonly users = {
    all: (): AuthUser[] => clone(this.snapshot().users),
    find: (id: string): AuthUser | undefined => this.users.all().find((u) => u.id === id),
    create: (input: CreateUserInput & { status: AuthUser["status"] }): AuthUser =>
      this.mutate((dataset) => {
        const now = new Date().toISOString();
        const created: AuthUser = { ...input, id: nextId("usr_"), createdAt: now, updatedAt: now };
        dataset.users = [...dataset.users, created];
        return clone(created);
      }),
    update: (id: string, patch: UpdateUserInput): AuthUser | undefined =>
      this.mutate((dataset) => {
        const index = dataset.users.findIndex((u) => u.id === id);
        if (index === -1) return undefined;
        const updated: AuthUser = {
          ...dataset.users[index],
          ...clone(patch),
          id,
          createdAt: dataset.users[index].createdAt,
          updatedAt: new Date().toISOString(),
        };
        dataset.users[index] = updated;
        return clone(updated);
      }),
    remove: (id: string): boolean =>
      this.mutate((dataset) => {
        const next = dataset.users.filter((u) => u.id !== id);
        if (next.length === dataset.users.length) return false;
        dataset.users = next;
        return true;
      }),
  };
}

/** Collections of the dataset that are arrays of `{ id }` rows. */
type ArrayCollection = "students" | "teachers" | "rooms" | "classes" | "enrollments" | "users";

export type StudentDraft = Omit<Student, "id">;

export const demoStore = new DemoStoreImpl();

export type DemoStore = DemoStoreImpl;
