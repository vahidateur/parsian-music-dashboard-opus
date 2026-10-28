/**
 * W2 — the dataset artifact is the dataset. Proven, not assumed.
 *
 * THE CLAIM
 *
 * `data/dataset/` carries the canonical demo dataset as data: one file per
 * top-level member, an asset list with real hashes, a schema document and a
 * manifest that names every member and its hash. This suite proves the claim by
 * re-running the generator and comparing what it produces with what is
 * committed — byte for byte — and by re-loading the committed artifact and
 * comparing the rebuilt value with `createSeedDataset()`.
 *
 * WHY BOTH DIRECTIONS
 *
 *   seed  → artifact : `buildDatasetArtifact()` output ≡ the committed files
 *                      (so the artifact cannot silently drift from the seed)
 *   artifact → seed  : the loaded dataset ≡ `createSeedDataset()`
 *                      (so the artifact is the same DATA, and its own hash is
 *                      the hash of the canonical serialization)
 *
 * Either direction alone would be weaker: a stale artifact and a changed seed
 * can agree with each other, and a matching hash proves nothing about what the
 * files contain.
 *
 * WHAT THIS SUITE DOES NOT DO: it does not change any behaviour. The runtime
 * still builds the dataset with `createSeedDataset()`; consuming the artifact is
 * a later wave's decision (`docs/migration/DEMO_MIGRATION_WAVES.md` §W3/W5).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDataset } from "@/domains/demo/backup";
import { DEMO_LIBRARY_ASSET_FILE, DEMO_LIBRARY_ASSET_ID, demoLibraryFileBytes } from "@/domains/demo/librarySeed";
import { DEMO_GALLERY_PHOTOS } from "@/domains/demo/gallerySeed";
import { createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS, DATASET_ARTIFACT_DIR, canonicalDatasetJson } from "@/dataset/schema";
import { loadDatasetArtifact } from "@/dataset/load";
import { validateDatasetArtifact } from "@/dataset/validate";
import { buildDatasetArtifact, datasetAssetRecords } from "@/dataset/write";

const ROOT = process.cwd();
const DIR = DATASET_ARTIFACT_DIR;

/** sha256 of a string's UTF-8 bytes, or of a file's exact bytes. */
const hashText = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const hashFile = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * The demo library file's bytes as shipped BEFORE W2 — the value this wave must
 * not change. W2 moved the text out of `librarySeed.ts` into the artifact; a
 * move is only a move if the bytes survive it, so the pre-move hash is pinned
 * here rather than trusted.
 */
const PRE_W2_LIBRARY_SHA256 = "005e799fcce17f88cfb0e3ffd51b16df1188019afb2730c260c263eda954d473";

describe("the artifact is byte-equivalent to the canonical dataset", () => {
  it("regenerating produces exactly the committed files", () => {
    const build = buildDatasetArtifact();
    const mismatches: string[] = [];
    for (const file of build.files) {
      const path = join(DIR, file.path);
      if (!existsSync(path)) {
        mismatches.push(`${file.path}: committed artifact does not carry it`);
        continue;
      }
      const onDisk = readFileSync(path, "utf8");
      if (onDisk !== file.contents) {
        mismatches.push(`${file.path}: committed ${onDisk.length} bytes, regenerated ${file.contents.length} bytes`);
      }
    }
    expect(mismatches, "the committed artifact is not what the seed generates").toEqual([]);
  });

  it("carries exactly the files the manifest accounts for", () => {
    const build = buildDatasetArtifact();
    const committed = new Set(
      readdirSync(DIR, { withFileTypes: true }).flatMap((entry) => {
        if (!entry.isFile()) return [];
        return [entry.name];
      }),
    );
    const expectedFiles = build.files.filter((file) => !file.path.includes("/")).map((file) => file.path);
    // manifest.json is generated last and listed among `build.files`, so the
    // top-level expectation is every non-nested generated file.
    for (const name of expectedFiles) expect(committed.has(name), `${name} is missing from the artifact`).toBe(true);
    expect(build.files.length).toBe(33 /* members */ + 1 /* manifest */ + 1 /* asset list */ + 1 /* schema */ + 1 /* asset bytes */);
  });

  it("hashes the canonical dataset, not a reformatted one", () => {
    const seed = createSeedDataset();
    const { manifest } = buildDatasetArtifact();
    expect(manifest.datasetSha256).toBe(hashText(canonicalDatasetJson(seed)));
    expect(manifest.datasetSha256).toBe(hashText(JSON.stringify(loadDatasetArtifact().dataset)));
  });

  /**
   * JSON's own normalization, written out: `undefined`-valued object keys are
   * dropped, `undefined` array entries become `null`. The seed DOES carry
   * explicit `undefined` values (the diff below is non-vacuous because of it),
   * and no JSON artifact can carry them — so the honest claim is "the artifact
   * is the seed, modulo exactly what JSON cannot represent", not a claim that
   * the two objects are identical before serialization.
   */
  function jsonNormalize<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((item) => (item === undefined ? null : jsonNormalize(item))) as unknown as T;
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (entry === undefined) continue;
        out[key] = jsonNormalize(entry);
      }
      return out as unknown as T;
    }
    return value;
  }

  /** Positions where the seed states `undefined` — the whole of the difference. */
  function undefinedPositions(value: unknown): number {
    if (Array.isArray(value)) return value.reduce<number>((total, item) => total + (item === undefined ? 1 : undefinedPositions(item)), 0);
    if (value !== null && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).reduce<number>(
        (total, entry) => total + (entry === undefined ? 1 : undefinedPositions(entry)),
        0,
      );
    }
    return 0;
  }

  it("loads back to the same dataset value as createSeedDataset()", () => {
    const seed = createSeedDataset();
    const loaded = loadDatasetArtifact();

    // The canonical serialization — the value the artifact's hash is defined
    // over — is identical, byte for byte.
    expect(JSON.stringify(loaded.dataset)).toBe(JSON.stringify(seed));

    // And the value comparison: identical except where the seed carries
    // `undefined`, which JSON cannot carry. Both halves are asserted, so the
    // exception cannot grow silently.
    expect(undefinedPositions(seed), "the seed no longer carries undefined values — tighten this test").toBeGreaterThan(0);
    expect(loaded.dataset).toStrictEqual(jsonNormalize(seed));

    // Member by member, so a difference names the member instead of the whole
    // dataset: each artifact member serializes exactly as the seed's member.
    for (const name of Object.keys(seed) as (keyof typeof seed)[]) {
      expect(canonicalDatasetJson(loaded.dataset[name]), `${String(name)} differs`).toBe(canonicalDatasetJson(seed[name]));
    }
  });

  it("reproduces the dataset's own key order, so a reload is byte-stable", () => {
    const { manifest } = buildDatasetArtifact();
    expect(manifest.keyOrder).toEqual(Object.keys(createSeedDataset()));
    expect(Object.keys(loadDatasetArtifact().dataset)).toEqual(manifest.keyOrder);
  });

  it("is deterministic: two loads are byte-identical, two builds are identical", () => {
    const first = JSON.stringify(loadDatasetArtifact().dataset);
    const second = JSON.stringify(loadDatasetArtifact().dataset);
    expect(second).toBe(first);

    const a = buildDatasetArtifact();
    const b = buildDatasetArtifact();
    expect(b.manifest).toStrictEqual(a.manifest);
    expect(b.files.map((file) => `${file.path}:${hashText(file.contents)}`)).toEqual(
      a.files.map((file) => `${file.path}:${hashText(file.contents)}`),
    );
  });
});

describe("the artifact is referentially sound data", () => {
  it("validates with zero issues", () => {
    // The artifact-level validator: manifest/version, member files and hashes,
    // counts, exact file set, assets, schema document — plus referential
    // integrity through the domain's own `validateDataset`.
    expect(validateDatasetArtifact()).toEqual([]);
  });

  it("passes the domain's referential-integrity validator after a round trip", () => {
    // Ids, class/student/room/teacher references, rosters, dated sessions —
    // the same validator a backup restore runs. Round-tripped, the data must be
    // exactly as sound as the seed.
    expect(validateDataset(loadDatasetArtifact().dataset)).toEqual([]);
  });

  it("covers all 31 collections, and every collection file is an array", () => {
    const loaded = loadDatasetArtifact();
    expect(DEMO_COLLECTIONS.length).toBe(31);
    for (const name of DEMO_COLLECTIONS) {
      expect(Array.isArray(loaded.dataset[name]), `${name} is not an array`).toBe(true);
    }
    expect(Object.keys(loaded.dataset)).toHaveLength(DEMO_COLLECTIONS.length + 2);
  });
});

describe("assets: bytes referenced, not duplicated", () => {
  const records = datasetAssetRecords();

  it("records exactly the dataset's media rows", () => {
    const mediaIds = createSeedDataset().media.map((row) => row.id).sort();
    expect(records.map((record) => record.id).sort()).toEqual(mediaIds);
  });

  it("materializes the library document, byte-identical to the bytes the app serves", () => {
    const record = records.find((entry) => entry.id === DEMO_LIBRARY_ASSET_ID)!;
    expect(record.file).toBe(DEMO_LIBRARY_ASSET_FILE);
    const bytes = new Uint8Array(demoLibraryFileBytes());
    expect(record.sha256).toBe(hashFile(join(DIR, record.file as string)));
    expect(record.sha256).toBe(hashText(new TextDecoder().decode(bytes)));
    // The point of the whole move: the same bytes as before W2.
    expect(record.sha256).toBe(PRE_W2_LIBRARY_SHA256);
    expect(record.sizeBytes).toBe(bytes.byteLength);
    expect(record.sizeBytes).toBe(createSeedDataset().media[0].sizeBytes);
  });

  it("references the showcase photographs at their shipped source files", () => {
    const photos = new Map(DEMO_GALLERY_PHOTOS.map((photo) => [photo.mediaId, photo]));
    const media = new Map(createSeedDataset().media.map((row) => [row.id, row]));
    for (const [mediaId, photo] of photos) {
      const record = records.find((entry) => entry.id === mediaId);
      expect(record, `${mediaId} has no asset record`).toBeDefined();
      const row = media.get(mediaId)!;
      // Where the bytes live: the file Vite bundles for this photo's URL.
      expect(`/${record!.sourcePath}`).toBe(photo.url);
      expect(existsSync(join(ROOT, record!.sourcePath as string)), `${record!.sourcePath} does not exist`).toBe(true);
      // The record's size is the FILE's size, and it agrees with the size the
      // seed declares for its media row — two independent statements.
      expect(record!.sizeBytes).toBe(readFileSync(join(ROOT, record!.sourcePath as string)).byteLength);
      expect(record!.sizeBytes).toBe(row.sizeBytes);
      expect(record!.filename).toBe(row.filename);
      expect(record!.sha256).toBe(hashFile(join(ROOT, record!.sourcePath as string)));
    }
  });

  it("copies no referenced asset bytes into the artifact", () => {
    // The six photographs already ship from `src/assets/images/`; a copy here
    // would be a second home for the same bytes in one repository.
    const copied = readdirSync(join(DIR, "assets")).filter((file) => !file.endsWith(".txt") && file !== "assets.json");
    expect(copied).toEqual([]);
  });

  it("the asset list on disk is the generated one", () => {
    expect(createHash("sha256").update(readFileSync(join(DIR, "assets", "assets.json"))).digest("hex")).toBe(
      buildDatasetArtifact().manifest.assets.sha256,
    );
  });
});
