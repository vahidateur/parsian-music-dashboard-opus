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
import type { DemoDataset } from "@/domains/demo/types";
import type { Student } from "@/data/records";

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

  /* ---------------- snapshot level ---------------- */

  /** Reads the persisted dataset, seeding it on first access. */
  snapshot(): DemoDataset {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
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
  }

  /** Removes the persisted snapshot; the next read reseeds from the canonical seed. */
  reset(): void {
    this.storage.removeItem(DEMO_STORAGE_KEY);
  }

  private mutate<T>(fn: (dataset: DemoDataset) => T): T {
    const dataset = this.snapshot();
    const result = fn(dataset);
    this.replace(dataset);
    return result;
  }

  /* ---------------- students ---------------- */

  readonly students = {
    all: (): Student[] => clone(this.snapshot().students),
    find: (id: string): Student | undefined => this.students.all().find((s) => s.id === id),
    create: (draft: StudentDraft): Student =>
      this.mutate((dataset) => {
        const created: Student = { ...clone(draft), id: nextId("st_") };
        dataset.students = [created, ...dataset.students];
        return clone(created);
      }),
    update: (id: string, patch: Partial<StudentDraft>): Student | undefined =>
      this.mutate((dataset) => {
        const index = dataset.students.findIndex((s) => s.id === id);
        if (index === -1) return undefined;
        const updated: Student = { ...dataset.students[index], ...clone(patch), id };
        dataset.students[index] = updated;
        return clone(updated);
      }),
    remove: (id: string): boolean =>
      this.mutate((dataset) => {
        const next = dataset.students.filter((s) => s.id !== id);
        if (next.length === dataset.students.length) return false;
        dataset.students = next;
        return true;
      }),
  };
}

export type StudentDraft = Omit<Student, "id">;

export const demoStore = new DemoStoreImpl();

export type DemoStore = DemoStoreImpl;
