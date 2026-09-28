/**
 * DemoStore — the single persistence authority for the local environment.
 *
 * It holds ONE snapshot of the whole environment (`DemoDataset`) under a single
 * localStorage key, plus the environment's lifecycle marker under a second key.
 * Repositories adapt this store to domain contracts; nothing else in the app may
 * read or write this persistence directly.
 *
 * There is intentionally no second database: every collection lives in the same
 * snapshot, which is also what makes atomic restore possible.
 *
 * READING NEVER CHOOSES A LIFECYCLE. `snapshot()` used to seed the canonical
 * demo dataset the first time it was called, which meant demo records were
 * inserted into every environment implicitly — including a real customer's. An
 * environment is now created only by an explicit operation
 * (`domains/demo/lifecycle.ts`), and a read of an uninitialized store returns a
 * valid in-memory EMPTY dataset without writing anything.
 */
import { createEmptyDataset, createSeedDataset } from "@/domains/demo/seed";
import { stripPrototypeKeys } from "@/domains/demo/backup";
import {
  DEMO_COLLECTIONS,
  LIFECYCLE_MODES,
  type DataLifecycleMode,
  type DemoCollectionName,
  type DemoDataset,
} from "@/domains/demo/types";
import type { Student } from "@/domains/students/types";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "@/domains/auth/types";
import type { BrandingSettings } from "@/domains/branding/types";
import { withRuleDefaults, type OrganizationSettings } from "@/domains/organization/types";

export const DEMO_STORAGE_KEY = "ava:demo:dataset";
/**
 * The environment's lifecycle marker (`"empty"` | `"demo"`).
 *
 * A separate key from the dataset on purpose: the mode is a property of the
 * ENVIRONMENT, not academy data. Keeping it out of `DemoDataset` means it is
 * never exported into a backup, never validated as a record, and never carried
 * from one environment into another by a restore.
 */
export const LIFECYCLE_STORAGE_KEY = "ava:demo:lifecycle";
/**
 * Dataset provenance — explicit ownership/identity metadata (Phase 2A).
 *
 * The lifecycle marker answers "what KIND of environment is this?"; the
 * provenance stamp answers "whose records are in this dataset, and which
 * environment are they?" with a stable `datasetId`. Delivery uses BOTH: they
 * must AGREE before any dataset is removed (disagreement = ownership conflict
 * → fail closed, preserve everything, park the delivery in pending/recovery).
 *
 * It lives INSIDE the dataset payload as a top-level `provenance` field — not
 * as a third storage key. The store's persistence contract (asserted by
 * demoDataManager's "single localStorage key for data" test) is exactly two
 * keys: the serialized dataset and the mode marker. A sidecar key would break
 * that invariant for metadata that belongs WITH the dataset anyway: it
 * travels with restores (round-trips through backups), dies with the dataset
 * (a deleted dataset cannot claim ownership it no longer holds), and needs no
 * extra write path. Absence on a legacy payload is reported as absence —
 * delivery then trusts the marker alone; a present-but-corrupt value is
 * unproven → preserve.
 */
export interface DatasetProvenance {
  version: 1;
  /** Stable id minted when the environment was created/adopted. */
  datasetId: string;
  owner: "demo" | "customer";
  origin: "seed" | "first-run" | "adopted" | "import";
  seedVersion?: string;
  createdAt: string;
}

/**
 * A raw probe result that distinguishes ABSENT (readable, value null) from
 * UNREADABLE (the read itself failed). Delivery's fail-closed ownership check
 * treats those differently: absent can mean "nothing to remove", unreadable
 * always means "cannot prove — preserve".
 */
export type StoragePeek = { readable: true; value: string | null } | { readable: false };

export type ProvenanceRead =
  | { kind: "absent" }
  | { kind: "valid"; value: DatasetProvenance }
  | { kind: "corrupt" };

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

/**
 * Whether a persisted payload is a dataset this store can actually serve.
 *
 * A key holding garbage is not an environment. Treating one as initialized would
 * label an unreadable payload EMPTY or DEMO and render an app with no data
 * behind that label; reporting it as uninitialized re-offers the first-run
 * choice, which is the only recovery that cannot lose readable data — there is
 * none to lose. Prototype-polluting keys are stripped before the shape check, so
 * a hostile payload cannot smuggle inherited properties into the answer.
 */
export function isUsableDatasetPayload(raw: string): boolean { return isUsablePayload(raw); }

/** A copy of `dataset` with a provenance stamp (datasetId/createdAt preserved). */
export function stampDatasetProvenance(
  dataset: DemoDataset,
  owner: "demo" | "customer",
  origin: DatasetProvenance["origin"],
  existing?: DatasetProvenance,
): DemoDataset & { provenance: DatasetProvenance } {
  return {
    ...dataset,
    provenance: {
      version: 1,
      datasetId: existing?.datasetId ?? nextId("ds_"),
      owner,
      origin,
      ...(existing?.seedVersion ? { seedVersion: existing.seedVersion } : {}),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    },
  };
}

function isUsablePayload(raw: string): boolean {
  try {
    const parsed: unknown = stripPrototypeKeys(JSON.parse(raw) as unknown);
    return Boolean(parsed) && typeof parsed === "object" && Array.isArray((parsed as DemoDataset).students);
  } catch {
    return false;
  }
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
  /*
    A dataset written before session rules existed has an `organization` object
    with no rules in it. Absent means "the shipped default", never "no rule": a
    missing value that quietly disabled the gap check or the bookable window
    would be worse than the field not existing at all, so the record is completed
    on read-in and written back.
  */
  const needsRules =
    !needsOrganization && !hasOrganizationRules(dataset.organization as Partial<OrganizationSettings>);
  const needsBranding = typeof dataset.branding !== "object" || dataset.branding === null;

  if (added.length === 0 && !needsOrganization && !needsRules && !needsBranding) {
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
  else if (needsRules) migrated.organization = withRuleDefaults(dataset.organization);
  if (needsBranding) migrated.branding = canonical.branding;

  return { dataset: migrated, migrated: true, added };
}

/** True when every rule field the product relies on is present and well-formed. */
function hasOrganizationRules(organization: Partial<OrganizationSettings>): boolean {
  return (
    typeof organization.defaultSessionMinutes === "number" &&
    typeof organization.sessionGapMinutes === "number" &&
    typeof organization.cancellationGraceHours === "number" &&
    typeof organization.maxMakeupsPerTerm === "number" &&
    typeof organization.workingDayStart === "string" &&
    typeof organization.workingDayEnd === "string" &&
    Array.isArray(organization.closedWeekdays)
  );
}

export class DemoStoreImpl {
  #injected?: StorageLike;
  #resolved?: StorageLike;

  /**
   * Storage is resolved LAZILY, on first access.
   *
   * Two reasons, both load-bearing: (1) `safeStorage()` PROBES localStorage —
   * running that inside the constructor would make every `new` a storage
   * side effect; (2) the module-scope singleton below must be *constructible
   * without observable effects* so a build that never binds it (the CLIENT
   * composition, which imports this module transitively through co-located
   * Api/Demo files) can drop the whole graph — annotated `/* @__PURE__ *\/`
   * and honest. The eager constructor was exactly how the demo store, seed and
   * backup leaked into the client bundle despite every import being unused.
   *
   * An explicit storage argument (tests, delivery probes) is still honoured:
   * it is kept as the injection and resolved on first use.
   */
  constructor(storage?: StorageLike) {
    this.#injected = storage;
  }

  private get storage(): StorageLike {
    this.#resolved ??= this.#injected ?? safeStorage() ?? memoryStorage();
    return this.#resolved;
  }

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
   * Reads the persisted dataset, migrating it to the current schema.
   *
   * A payload written by an older build is repaired here rather than crashing
   * the reader — see `migrateDataset` for why this is the only correct place.
   *
   * SIDE-EFFECT FREE WITH RESPECT TO THE LIFECYCLE: when nothing has been
   * persisted this returns a valid EMPTY dataset **in memory** and writes
   * nothing. Seeding demo data here would insert a showcase dataset into every
   * environment implicitly — including a real customer's — and would make a
   * read decide something only an explicit first-run choice may decide. The
   * only write a read can still perform is the schema repair of a payload that
   * already exists, which preserves the visitor's own records.
   */
  snapshot(): DemoDataset {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw !== null && isUsablePayload(raw)) {
      // localStorage is user-editable: strip prototype-polluting keys before the
      // snapshot reaches any spread/Object.assign in the repositories. Parsed
      // fresh on every read — `mutate()` writes into the object it gets back, so
      // a shared cached parse would be corrupted by the first CRUD call.
      const parsed = stripPrototypeKeys(JSON.parse(raw) as unknown) as DemoDataset;
      const { dataset, migrated } = migrateDataset(parsed);
      // Written back once, so the repair survives a reload and every later read
      // is a plain read. Deliberately NOT `replace()`: this happens inside a read
      // and the caller receives the migrated value, so no subscriber is stale,
      // and emitting from a read path could notify during render.
      if (migrated) this.write(dataset);
      return dataset;
    }
    // Nothing persisted (or the payload was unusable): report an empty, valid
    // dataset WITHOUT writing it. `isInitialized()` still answers false, so the
    // lifecycle boundary can tell "no environment yet" from "an EMPTY
    // environment", which a read must never decide on the caller's behalf.
    return createEmptyDataset();
  }

  /**
   * True when an environment has actually been created: a usable dataset is
   * persisted. An absent, corrupt or non-dataset payload answers false, so the
   * lifecycle boundary reports UNINITIALIZED and the first-run choice is offered.
   *
   * The check is cached per raw payload because the lifecycle state is consulted
   * on every store notification; the cache is keyed by the stored string, so any
   * write invalidates it by construction.
   */
  isInitialized(): boolean {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw === null) return false;
    if (this.usability?.raw === raw) return this.usability.value;
    const value = isUsablePayload(raw);
    this.usability = { raw, value };
    return value;
  }

  private usability: { raw: string; value: boolean } | null = null;

  /**
   * Atomically replaces the whole dataset. Serialization happens before the
   * write, so a value that cannot be serialized never clears existing state.
   *
   * An explicit write into a store that has no lifecycle marker yet records the
   * environment as EMPTY: data written by the visitor is real data, never demo
   * data, and this keeps the invariant that a persisted dataset always has a
   * marker. (Demo environments are created by `initializeEnvironment`, which
   * writes the marker itself.)
   */
  replace(dataset: DemoDataset): void {
    const creating = this.readLifecycleMarker() === null;
    if (creating) this.storage.setItem(LIFECYCLE_STORAGE_KEY, "empty");
    // A first write into an unmarked store CREATES a customer environment:
    // the visitor's own records are customer-owned from the first byte — stamp
    // that here, when the environment comes into being. Incoming datasets that
    // already carry provenance (restores, imports) keep theirs untouched, and
    // a legacy environment without provenance is deliberately left without:
    // absence is reported as absence, never faked.
    const stamped =
      creating && !("provenance" in dataset)
        ? stampDatasetProvenance(dataset, "customer", "first-run")
        : dataset;
    this.write(stamped);
    this.emit();
  }

  /**
   * Creates an environment of the given kind: marker and dataset persisted
   * together, then subscribers notified.
   *
   * The marker is written FIRST so the only interruptible intermediate state is
   * "marker without dataset", which `readLifecycleState` resolves back to
   * UNINITIALIZED — a safe recovery that re-offers the choice instead of
   * presenting a half-created environment as a real one.
   */
  initializeEnvironment(mode: DataLifecycleMode, dataset: DemoDataset): void {
    this.storage.setItem(LIFECYCLE_STORAGE_KEY, mode);
    // Ownership metadata rides INSIDE the payload (still exactly two keys).
    // The only interruptible intermediate is marker-only (UNINITIALIZED
    // recovery) — safe for delivery, which treats a marker without a dataset
    // as "nothing to delete".
    this.write(
      stampDatasetProvenance(dataset, mode === "demo" ? "demo" : "customer", mode === "demo" ? "seed" : "first-run"),
    );
    this.emit();
  }

  /* ---------------- raw probes (delivery/ownership) ---------------- */

  /**
   * The raw persisted dataset string, or null. NEVER writes, never migrates —
   * delivery's ownership evaluation must observe storage exactly as it is, so
   * a read path that could repair-and-write (as `snapshot()` may) is unusable
   * there. Raw bytes are useless until proven readable, which is precisely the
   * fail-closed question delivery asks.
   */
  peekDatasetPayload(): StoragePeek {
    try {
      return { readable: true, value: this.storage.getItem(DEMO_STORAGE_KEY) };
    } catch {
      return { readable: false };
    }
  }

  /** The raw persisted lifecycle marker string, or null. Read-only. */
  peekLifecycleMarkerValue(): StoragePeek {
    try {
      return { readable: true, value: this.storage.getItem(LIFECYCLE_STORAGE_KEY) };
    } catch {
      return { readable: false };
    }
  }

  /* ---------------- dataset provenance ---------------- */

  /**
   * Explicit ownership metadata, read from the dataset's top-level field.
   * Defensive: storage is user-editable, so anything that does not parse into
   * the exact shape is reported `corrupt` — never coerced into a guess.
   */
  readProvenance(): ProvenanceRead {
    const peek = this.peekDatasetPayload();
    if (!peek.readable || peek.value === null) return { kind: "absent" };
    if (!isUsablePayload(peek.value)) return { kind: "corrupt" };
    try {
      const parsed = JSON.parse(peek.value) as { provenance?: unknown };
      const p = parsed.provenance;
      if (p === undefined || p === null) return { kind: "absent" };
      if (typeof p !== "object" || Array.isArray(p)) return { kind: "corrupt" };
      const rec = p as Record<string, unknown>;
      const ok =
        rec.version === 1 &&
        typeof rec.datasetId === "string" &&
        rec.datasetId.length > 0 &&
        (rec.owner === "demo" || rec.owner === "customer") &&
        (rec.origin === "seed" || rec.origin === "first-run" || rec.origin === "adopted" || rec.origin === "import") &&
        typeof rec.createdAt === "string";
      if (!ok) return { kind: "corrupt" };
      return { kind: "valid", value: rec as unknown as DatasetProvenance };
    } catch {
      return { kind: "corrupt" };
    }
  }

  /**
   * Stamps provenance onto the CURRENT dataset, keeping `datasetId` and
   * `createdAt` when one exists. No-op when no readable dataset is present.
   */
  syncProvenance(owner: "demo" | "customer", origin: DatasetProvenance["origin"]): void {
    const peek = this.peekDatasetPayload();
    if (!peek.readable || peek.value === null || !isUsablePayload(peek.value)) return;
    const current = this.readProvenance();
    const existing = current.kind === "valid" ? current.value : undefined;
    const dataset = JSON.parse(peek.value) as DemoDataset & { provenance?: DatasetProvenance };
    dataset.provenance = stampDatasetProvenance({} as DemoDataset, owner, origin, existing).provenance;
    this.write(dataset);
  }

  /* ---------------- lifecycle marker ---------------- */

  /** The persisted marker, or `null` when no lifecycle choice has been made. */
  readLifecycleMarker(): DataLifecycleMode | null {
    // Never trust storage contents: an unrecognised value means "no choice",
    // which the lifecycle boundary resolves explicitly.
    const raw = this.storage.getItem(LIFECYCLE_STORAGE_KEY);
    return raw !== null && (LIFECYCLE_MODES as readonly string[]).includes(raw)
      ? (raw as DataLifecycleMode)
      : null;
  }

  /**
   * Records the environment's mode. Notifies, because the app gates on it.
   *
   * Deliberately does NOT touch the dataset — mode is metadata, and a marker
   * write must never modify records (contract: dataLifecycle's "records a mode
   * without touching the dataset"). Ownership stamps are written by the
   * operations that INSTALL data (`initializeEnvironment`, `applyDataset`),
   * where the dataset is being written anyway.
   */
  writeLifecycleMarker(mode: DataLifecycleMode): void {
    if (this.readLifecycleMarker() === mode) return;
    this.storage.setItem(LIFECYCLE_STORAGE_KEY, mode);
    this.emit();
  }

  /** Drops the marker (used by `reset`, which returns to UNINITIALIZED). */
  clearLifecycleMarker(): void {
    if (this.storage.getItem(LIFECYCLE_STORAGE_KEY) === null) return;
    this.storage.removeItem(LIFECYCLE_STORAGE_KEY);
    this.emit();
  }

  /** Serialize + persist, without notifying. `replace()` adds the notification. */
  private write(dataset: DemoDataset): void {
    const serialized = JSON.stringify(dataset);
    this.storage.setItem(DEMO_STORAGE_KEY, serialized);
  }

  /**
   * Removes the persisted dataset AND its lifecycle marker, returning the store
   * to UNINITIALIZED.
   *
   * This does NOT seed anything: the next read reports an empty dataset in
   * memory, and creating an environment again requires an explicit
   * initialization (`domains/demo/lifecycle.ts`).
   */
  reset(): void {
    this.storage.removeItem(DEMO_STORAGE_KEY);
    this.storage.removeItem(LIFECYCLE_STORAGE_KEY);
    // Provenance needs no cleanup: it lives inside the payload just deleted —
    // a removed dataset cannot keep claiming ownership it no longer holds.
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

  /* ---- compensation ---- */

  /**
   * Make-up obligations for cancelled one-to-one sessions. The obligation is the
   * row; the sessions it points at live in `scheduledSessions`, and its attempt
   * ledger is nested inside this record rather than duplicated here.
   */
  readonly sessionCompensations = this.collection("sessionCompensations", "cmp_");

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

  /**
   * The academy's own rules — a singleton record, like branding, so it gets a
   * read/patch pair instead of the generic CRUD surface. Every value here is
   * validated by the organization repository before it is written; the store
   * itself stays a dumb, honest container.
   */
  readonly organization = {
    get: (): OrganizationSettings => clone(this.snapshot().organization),
    update: (patch: Partial<Omit<OrganizationSettings, "updatedAt">>): OrganizationSettings =>
      this.mutate((dataset) => {
        dataset.organization = {
          ...dataset.organization,
          ...clone(patch),
          updatedAt: new Date().toISOString(),
        };
        return clone(dataset.organization);
      }),
  };

  /* ---------------- users and roles (auth domain) ---------------- */

  /**
   * Roles are configuration rows with FIXED ids (`administrator`, `teacher`, …),
   * not generated records: the id is the role. `create` accepts a supplied id, so
   * a role row is written under the role it describes, and a missing row simply
   * means "this role still runs on the shipped default matrix".
   */
  readonly roles = this.collection("roles", "role_");

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
  | "roles"
  | "media"
  | "instruments"
  | "pieces"
  | "pieceAssignments"
  | "progressEvents"
  | "scheduledSessions"
  | "attendanceRecords"
  | "attendanceCorrections"
  | "sessionCompensations"
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

export const demoStore = /* @__PURE__ */ new DemoStoreImpl();

export type DemoStore = DemoStoreImpl;
