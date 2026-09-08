/**
 * DemoStore schema migration — the root cause behind two reported product bugs.
 *
 * THE REGRESSION
 *
 * `localStorage` outlives deploys. A dataset written by an older build has the
 * 14 collections that build knew about; the code now reads 32. `snapshot()`
 * used to accept any payload with a `students` array and hand it back verbatim,
 * so every collection added since was `undefined` at the read sites:
 *
 *   - Messages: `store.chatConversations.all().filter(...)` →
 *     "Cannot read properties of undefined (reading 'filter')" →
 *     "بارگذاری گفتگوها ناموفق بود"
 *   - Student profile: `store.placements.all().find(...)` and
 *     `store.pieces.all()` → the learning and progress panels failed to load
 *   - Media (profile photo, library files): `store.media.all().filter(...)`
 *
 * The repair lives at the single persistence authority, not in the callers: one
 * migration fixes every reader (repositories, backup export, stats, validation)
 * instead of ~30 `?? []` bandaids that would leave the payload broken on disk.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_STORAGE_KEY,
  DemoStoreImpl,
  memoryStorage,
  migrateDataset,
  type StorageLike,
} from "@/services/demoStore";
import { createEmptyDataset, createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS, type DemoDataset } from "@/domains/demo/types";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import { DemoLearningRepository } from "@/domains/learning/demoRepository";
import { DemoMediaRepository } from "@/domains/media/demoRepository";

/** The collections a pre-migration build persisted. */
const LEGACY_COLLECTIONS = [
  "rooms",
  "teachers",
  "students",
  "classes",
  "enrollments",
  "sessions",
  "attendance",
  "invoices",
  "payments",
  "conversations",
  "resources",
  "users",
  "roles",
] as const;

/** A dataset exactly as an older build would have written it. */
function legacyPayload(): Record<string, unknown> {
  const full = createSeedDataset() as unknown as Record<string, unknown>;
  const legacy: Record<string, unknown> = { organization: full.organization };
  for (const key of LEGACY_COLLECTIONS) legacy[key] = full[key];
  return legacy;
}

/** A store over fresh in-memory storage, so each case is hermetic. */
function storeWith(payload: unknown): { store: DemoStoreImpl; storage: StorageLike } {
  const storage = memoryStorage();
  storage.setItem(DEMO_STORAGE_KEY, typeof payload === "string" ? payload : JSON.stringify(payload));
  return { store: new DemoStoreImpl(storage), storage };
}

describe("DemoStore migration", () => {
  it("repairs a payload written by an older build", () => {
    const { store } = storeWith(legacyPayload());
    const snapshot = store.snapshot();

    for (const name of DEMO_COLLECTIONS) {
      expect(Array.isArray(snapshot[name]), `collection "${name}" must be an array after migration`).toBe(true);
    }
    expect(typeof snapshot.organization).toBe("object");
    expect(typeof snapshot.branding).toBe("object");
  });

  it("preserves the visitor's own records instead of reseeding them", () => {
    const legacy = legacyPayload();
    const students = legacy.students as DemoDataset["students"];
    students[0] = { ...students[0], name: "هنرجوی خود کاربر" };
    (legacy.rooms as unknown[]).length = 1;

    const snapshot = storeWith(legacy).store.snapshot();

    // Their edits survive; the collections they never had are the only ones
    // that come from the canonical seed.
    expect(snapshot.students[0].name).toBe("هنرجوی خود کاربر");
    expect(snapshot.rooms).toHaveLength(1);
    expect(snapshot.students).toHaveLength(students.length);
  });

  it("writes the repair back once, and is idempotent", () => {
    const { store, storage } = storeWith(legacyPayload());
    store.snapshot();

    const persisted = JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? "null") as DemoDataset;
    for (const name of DEMO_COLLECTIONS) expect(Array.isArray(persisted[name])).toBe(true);

    // A second reader finds a current payload and has nothing to repair.
    const reread = new DemoStoreImpl(storage);
    expect(migrateDataset(reread.snapshot()).migrated).toBe(false);
  });

  it("does not reseed an intentionally EMPTY dataset", () => {
    // Zero rows is a state, not corruption. Reseeding here would put demo data
    // back into an environment the user deliberately emptied.
    const { store } = storeWith(createEmptyDataset());
    const snapshot = store.snapshot();

    for (const name of DEMO_COLLECTIONS) expect(snapshot[name]).toHaveLength(0);
    expect(migrateDataset(snapshot).migrated).toBe(false);
  });

  it("still reseeds a payload that is not a dataset at all", () => {
    const { store } = storeWith("{ not json");
    expect(store.snapshot().students.length).toBeGreaterThan(0);
  });

  it("restores a missing singleton instead of returning undefined", () => {
    const legacy = legacyPayload();
    delete legacy.organization;
    const snapshot = storeWith(legacy).store.snapshot();

    expect(snapshot.organization.name.length).toBeGreaterThan(0);
    expect(snapshot.organization.direction).toBe("rtl");
    expect(snapshot.branding).toEqual(createSeedDataset().branding);
  });

  it("replaces a collection that exists but is not an array", () => {
    const legacy = legacyPayload();
    legacy.chatMessages = null;
    legacy.media = { not: "an array" };

    const snapshot = storeWith(legacy).store.snapshot();
    expect(Array.isArray(snapshot.chatMessages)).toBe(true);
    expect(Array.isArray(snapshot.media)).toBe(true);
  });

  it("reports nothing to do for a current payload", () => {
    expect(migrateDataset(createSeedDataset())).toEqual({ migrated: false, added: [], dataset: expect.any(Object) });
  });

  it("names the collections it had to add", () => {
    const { added } = migrateDataset(legacyPayload() as unknown as DemoDataset);
    expect(added).toContain("chatConversations");
    expect(added).toContain("media");
    expect(added).toContain("placements");
    // Everything the old build did persist is left alone.
    expect(added).not.toContain("students");
    expect(added).not.toContain("resources");
  });
});

/**
 * The three readers that actually crashed, exercised through their real
 * repositories rather than through the store, because a green `snapshot()`
 * means nothing if a domain still throws on the result.
 */
describe("repositories on a migrated legacy payload", () => {
  let store: DemoStoreImpl;

  beforeEach(() => {
    store = storeWith(legacyPayload()).store;
  });

  it("chat lists conversations instead of throwing on undefined.filter", async () => {
    const page = await new DemoChatRepository(store).listConversations({ per_page: 100 });
    expect(page.meta.total).toBeGreaterThan(0);
  });

  it("learning resolves a student placement instead of throwing on undefined.find", async () => {
    const studentId = store.snapshot().students[0].id;
    // A placement is derived data the old build did not store; the read must
    // succeed and may legitimately be undefined.
    await expect(new DemoLearningRepository(store).getStudentPlacement(studentId)).resolves.not.toThrow();
  });

  it("media lists assets instead of throwing on undefined.filter", async () => {
    const page = await new DemoMediaRepository(store).list({ per_page: 50 });
    expect(Array.isArray(page.data)).toBe(true);
  });

  it("a legacy payload with zero conversations is a valid state", async () => {
    const legacy = legacyPayload();
    legacy.conversations = [];
    const empty = new DemoStoreImpl(memoryStorage());
    // Persisted as an emptied, already-migrated dataset.
    const migrated = migrateDataset(legacy as unknown as DemoDataset).dataset;
    migrated.chatConversations = [];
    migrated.chatMessages = [];
    empty.replace(migrated);

    const page = await new DemoChatRepository(empty).listConversations({ per_page: 100 });
    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
  });
});
