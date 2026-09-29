/**
 * W3 — the independent dataset can feed the store, and the store does not own it.
 *
 * The production default source is still the seed builder. W2 proved that
 * builder byte-equivalent to `data/dataset/`, and the Node loader must not be
 * imported by the store (no filesystem in the browser, no new exposure path,
 * B1 still in force). This suite is the proof the seam is real: an
 * artifact-backed source fills the same gaps the seed source fills, and a
 * store initialized from the artifact serves the same collections a repository
 * already reads.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadDatasetArtifact } from "@/dataset/load";
import { canonicalDatasetJson, DEMO_COLLECTIONS } from "@/dataset/schema";
import { createSeedDataset } from "@/domains/demo/seed";
import { LocalStudentRepository } from "@/domains/students/localRepository";
import { seedDatasetSource, type CanonicalDatasetSource } from "@/services/canonicalDatasetSource";
import {
  DEMO_STORAGE_KEY as SHIM_KEY,
  LIFECYCLE_STORAGE_KEY as SHIM_LIFECYCLE_KEY,
  demoStore as shimStore,
} from "@/services/demoStore";
import {
  DEMO_STORAGE_KEY,
  LIFECYCLE_STORAGE_KEY,
  LocalStoreImpl,
  demoStore,
  localStore,
  memoryStorage,
  migrateDataset,
} from "@/services/localStore";
import type { DemoDataset } from "@/domains/demo/types";

const loaded = loadDatasetArtifact();

function withoutProvenance(dataset: DemoDataset): DemoDataset {
  const rest = { ...dataset } as DemoDataset & { provenance?: unknown };
  delete rest.provenance;
  return rest;
}

describe("W3 store plumbing — one store, compatibility keys", () => {
  it("keeps the W1 storage keys and a single singleton across both module paths", () => {
    expect(DEMO_STORAGE_KEY).toBe("ava:demo:dataset");
    expect(LIFECYCLE_STORAGE_KEY).toBe("ava:demo:lifecycle");
    expect(SHIM_KEY).toBe(DEMO_STORAGE_KEY);
    expect(SHIM_LIFECYCLE_KEY).toBe(LIFECYCLE_STORAGE_KEY);
    expect(demoStore).toBe(localStore);
    expect(shimStore).toBe(localStore);
  });

  it("does not import the Node loader or a dataset JSON file", () => {
    const storeSource = readFileSync(new URL("../localStore.ts", import.meta.url), "utf8");
    const sourceSource = readFileSync(new URL("../canonicalDatasetSource.ts", import.meta.url), "utf8");
    for (const source of [storeSource, sourceSource]) {
      expect(source).not.toContain("@/dataset/load");
      expect(source).not.toContain("@/dataset/validate");
      expect(source).not.toContain("@/dataset/write");
      expect(source).not.toMatch(/data\/dataset\/.+\.json/);
    }
  });
});

describe("W3 store plumbing — the artifact feeds the store", () => {
  it("installs the artifact under the compatibility keys and a repository reads it", async () => {
    const storage = memoryStorage();
    const store = new LocalStoreImpl(storage);
    store.initializeEnvironment("sample", loaded.dataset);

    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(LIFECYCLE_STORAGE_KEY)).toBe("sample");
    expect(storage.getItem("ava:local:dataset")).toBeNull();

    const snap = store.snapshot();
    for (const name of DEMO_COLLECTIONS) {
      expect(snap[name], name).toEqual(loaded.dataset[name]);
    }
    expect(snap.organization).toEqual(loaded.dataset.organization);
    expect(snap.branding).toEqual(loaded.dataset.branding);

    const page = await new LocalStudentRepository(store).list({ per_page: 500 });
    expect(page.meta.total).toBe(loaded.dataset.students.length);
    expect(page.data.map((row) => row.id)).toEqual(loaded.dataset.students.map((row) => row.id));
  });

  it("serves the artifact and the seed as the same canonical dataset once persisted", () => {
    const fromArtifact = new LocalStoreImpl(memoryStorage());
    fromArtifact.initializeEnvironment("sample", loaded.dataset);
    const fromSeed = new LocalStoreImpl(memoryStorage());
    fromSeed.initializeEnvironment("sample", createSeedDataset());

    const artifactJson = canonicalDatasetJson(withoutProvenance(fromArtifact.snapshot()));
    const seedJson = canonicalDatasetJson(withoutProvenance(fromSeed.snapshot()));
    expect(artifactJson).toBe(seedJson);
    expect(artifactJson).toBe(canonicalDatasetJson(loaded.dataset));
    // Non-vacuous: the comparison is not two empty objects.
    expect(loaded.dataset.students.length).toBeGreaterThan(0);
    expect(artifactJson.length).toBeGreaterThan(1000);
  });

  it("fills a legacy payload from the artifact identically to the seed source", () => {
    const full = createSeedDataset() as unknown as Record<string, unknown>;
    const legacy: Record<string, unknown> = { organization: full.organization };
    for (const key of [
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
    ]) {
      legacy[key] = full[key];
    }
    const artifactSource: CanonicalDatasetSource = { current: () => loaded.dataset };
    const partial = legacy as unknown as DemoDataset;
    const fromArtifact = migrateDataset(partial, artifactSource);
    const fromSeed = migrateDataset(partial, seedDatasetSource);

    expect(fromArtifact.migrated).toBe(true);
    expect(fromArtifact.added.length).toBeGreaterThan(0);
    expect(fromArtifact.added).toEqual(fromSeed.added);
    expect(canonicalDatasetJson(fromArtifact.dataset)).toBe(canonicalDatasetJson(fromSeed.dataset));
    // The default argument is the seed source — one call, same bytes.
    expect(canonicalDatasetJson(migrateDataset(partial).dataset)).toBe(
      canonicalDatasetJson(fromSeed.dataset),
    );
  });
});
