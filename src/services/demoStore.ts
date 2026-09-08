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
import { DEMO_COLLECTIONS, type DemoCollectionName, type DemoDataset } from "@/domains/demo/types";
import type { Student } from "@/data/records";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "@/domains/auth/types";
import type { BrandingSettings } from "@/domains/branding/types";

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

/**
 * Upgrades a persisted dataset to the current schema.
 *
 * WHY THIS EXISTS
 *
 * `localStorage` outlives deploys. A dataset written by an older build does not
 * have the collections added since — media, chat, gallery, learning, progress,
 * the scheduling/attendance domains, branding — because that build never had
 * them. Handing such a payload straight to a repository means
 * `store.chatConversations.all()` returns `undefined` and the first `.filter()`
 * throws, which is exactly how Messages rendered "بارگذاری گفتگوها ناموفق بود /
 * Cannot read properties of undefined (reading 'filter')" and how a student
 * profile lost its learning and progress panels.
 *
 * WHY HERE AND NOT IN THE CALLERS
 *
 * The store is the single persistence authority, so it is the only place that
 * can repair the payload once, for every reader — repositories, backup export,
 * stats and validation all see the same complete dataset. A `?? []` in a view or
 * a repository would hide one symptom, leave the payload broken on disk, and
 * have to be repeated at all ~30 read sites. `backup.ts` already rejects such a
 * dataset with MISSING_COLLECTION; this makes the live read path agree with that
 * judgement instead of crashing on it.
 *
 * WHAT IS PRESERVED
 *
 * Every collection the payload already has, untouched — the visitor's own
 * students, classes, invoices and edits. Only collections that build could not
 * possibly have stored are added, taken from the canonical seed so a migrated
 * environment is as coherent as a fresh one (an empty `instruments` list would
 * otherwise blank every instrument label in the product).
 *
 * A value that is present but not an array (`null`, an object) is corruption,
 * not data: it can never satisfy the contract, so it is replaced the same way.
 * An intentionally EMPTY dataset (`createEmptyDataset()`) has every collection
 * as `[]`, so it is already valid and is never reseeded — zero rows is a state,
 * not an error.
 */
export function migrateDataset(dataset: DemoDataset): {
  dataset: DemoDataset;
  migrated: boolean;
  added: DemoCollectionName[];
} {
  const added = DEMO_COLLECTIONS.filter((name) => !Array.isArray(dataset[name]));
  const needsOrganization = typeof dataset.organization !== "object" || dataset.organization === null;
  const needsBranding = typeof dataset.branding !== "object" || dataset.branding === null;

  if (added.length === 0 && !needsOrganization && !needsBranding) {
    return { dataset, migrated: false, added: [] };
  }

  // Derived only when something is genuinely missing, so the common path (a
  // current payload) costs one array scan and no allocation.
  const canonical = createSeedDataset();
  const migrated: DemoDataset = { ...dataset };
  for (const name of added) {
    (migrated as unknown as Record<string, unknown>)[name] = canonical[name];
  }
  if (needsOrganization) migrated.organization = canonical.organization;
  if (needsBranding) migrated.branding = canonical.branding;

  return { dataset: migrated, migrated: true, added };
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

  /**
   * Reads the persisted dataset, migrating it to the current schema and seeding
   * it on first access.
   *
   * A payload written by an older build is repaired here rather than crashing
   * the reader — see `migrateDataset` for why this is the only correct place.
   */
  snapshot(): DemoDataset {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        // localStorage is user-editable: strip prototype-polluting keys before
        // the snapshot reaches any spread/Object.assign in the repositories.
        const parsed: unknown = stripPrototypeKeys(JSON.parse(raw) as unknown);
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as DemoDataset).students)) {
          const { dataset, migrated } = migrateDataset(parsed as DemoDataset);
          // Written back once, so the repair survives a reload and every later
          // read is a plain read. Deliberately NOT `replace()`: this happens
          // inside a read and the caller receives the migrated value, so no
          // subscriber is stale, and emitting from a read path could notify
          // during render.
          if (migrated) this.write(dataset);
          return dataset;
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
    this.write(dataset);
    this.emit();
  }

  /** Serialize + persist, without notifying. `replace()` adds the notification. */
  private write(dataset: DemoDataset): void {
    const serialized = JSON.stringify(dataset);
    this.storage.setItem(DEMO_STORAGE_KEY, serialized);
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

  /* ---- library ---- */

  /**
   * Catalogue rows (sheet music, audio, video, handouts).
   *
   * The BYTES of a library file are not here: they live in the blob store behind
   * `MediaRepository` and are referenced by `LibraryItem.mediaId`, exactly like
   * profile photos and gallery images. One storage boundary for the product.
   */
  readonly resources = this.collection("resources", "res_");

  /* ---- profiles / learning / media / chat / gallery ---- */

  readonly media = this.collection("media", "md_");
  readonly instruments = this.collection("instruments", "ins_");
  readonly programs = this.collection("programs", "pg_");
  readonly levels = this.collection("levels", "lv_");
  readonly learningContent = this.collection("learningContent", "lc_");
  readonly levelContent = this.collection("levelContent", "lcl_");
  readonly placements = this.collection("placements", "pl_");
  readonly chatConversations = this.collection("chatConversations", "cv_");
  /** Newest-last: a thread reads in chronological order. */
  readonly chatMessages = this.collection("chatMessages", "msg_");
  readonly galleryAlbums = this.collection("galleryAlbums", "alb_");
  readonly galleryImages = this.collection("galleryImages", "gim_");

  /* ---- repertoire and progress ---- */

  readonly pieces = this.collection("pieces", "pc_");
  readonly pieceAssignments = this.collection("pieceAssignments", "as_");
  /** Append-only history; newest-last so a timeline reads chronologically. */
  readonly progressEvents = this.collection("progressEvents", "pe_");

  /* ---- scheduling ---- */

  /**
   * Real dated occurrences. Generated slots carry deterministic ids
   * (`ses_<classId>_<YYYYMMDD>_<HHmm>`) supplied by the caller, so the `ses_`
   * prefix here only applies to manually created sessions.
   */
  readonly scheduledSessions = this.collection("scheduledSessions", "ses_m_");

  /* ---- attendance ---- */

  readonly attendanceRecords = this.collection("attendanceRecords", "att_");
  /** Append-only: written by corrections, never updated or removed. */
  readonly attendanceCorrections = this.collection("attendanceCorrections", "atc_");

  /**
   * Branding is a singleton record rather than a collection, so it gets a
   * read/patch pair instead of the generic CRUD surface.
   */
  readonly branding = {
    get: (): BrandingSettings => clone(this.snapshot().branding),
    update: (patch: Partial<Omit<BrandingSettings, "updatedAt">>): BrandingSettings =>
      this.mutate((dataset) => {
        dataset.branding = {
          ...dataset.branding,
          ...clone(patch),
          updatedAt: new Date().toISOString(),
        };
        return clone(dataset.branding);
      }),
  };

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
type ArrayCollection =
  | "students"
  | "teachers"
  | "rooms"
  | "classes"
  | "enrollments"
  | "users"
  | "media"
  | "instruments"
  | "pieces"
  | "pieceAssignments"
  | "progressEvents"
  | "scheduledSessions"
  | "attendanceRecords"
  | "attendanceCorrections"
  | "programs"
  | "levels"
  | "learningContent"
  | "levelContent"
  | "placements"
  | "chatConversations"
  | "chatMessages"
  | "galleryAlbums"
  | "galleryImages"
  | "resources";

export type StudentDraft = Omit<Student, "id">;

export const demoStore = new DemoStoreImpl();

export type DemoStore = DemoStoreImpl;
