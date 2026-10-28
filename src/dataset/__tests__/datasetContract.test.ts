/**
 * W2 — the dataset's contract, and the fact that it fails closed.
 *
 * THE CONTRACT
 *
 *   - the member enumeration: 31 collections, named and ordered, no duplicates
 *     (the code is the authority; see the note on the documents' "30" below);
 *   - the version values an importer can rely on: the artifact's own schema
 *     version, the dataset version (`SEED_VERSION`), the annotation date
 *     (`SEED_DATE`) and the dataset's fixed timestamp (`SEED_TIMESTAMP`);
 *   - the shape document agrees with the manifest, member for member.
 *
 * FAIL-CLOSED
 *
 * A dataset that is half-loaded is presented to an operator as the academy's
 * data, so the loader throws rather than returning what it managed to read —
 * every failure mode below is exercised against a throwaway copy of the real
 * artifact in a temp directory.
 *
 * NO NEW EXPOSURE PATH
 *
 * The artifact carries demo credentials and demo asset bytes. This suite pins
 * that it is reachable from exactly one production module — `librarySeed.ts`,
 * whose bytes are provisioned only through the capability-gated
 * `ensureDemoLibraryFile` — and that the JSON is not bundled at all.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { datasetStats } from "@/domains/demo/backup";
import { SEED_DATE } from "@/domains/demo/schedulingSeed";
import { createSeedDataset, SEED_TIMESTAMP, SEED_VERSION } from "@/domains/demo/seed";
import {
  DATASET_ARTIFACT_DIR,
  DATASET_SCHEMA_VERSION,
  DATASET_SINGLETONS,
  DEMO_COLLECTIONS,
  datasetMemberNames,
} from "@/dataset/schema";
import { DatasetArtifactError, loadDatasetArtifact, readDatasetManifest } from "@/dataset/load";
import { validateDatasetArtifact } from "@/dataset/validate";

const ROOT = process.cwd();
const DIR = DATASET_ARTIFACT_DIR;

/** A throwaway copy of the committed artifact, for the failure modes. */
const sandbox = mkdtempSync(join(tmpdir(), "ava-dataset-w2-"));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

function copyArtifact(label: string): string {
  const dir = join(sandbox, label);
  cpSync(DIR, dir, { recursive: true });
  return dir;
}

/** Every .ts/.tsx under `src/`, excluding test files and the dataset tooling. */
function productionSources(dir = join(ROOT, "src"), prefix = "src/"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      if (rel === "src/dataset") continue; // the tooling itself, exercised here directly
      out.push(...productionSources(join(dir, entry.name), `${rel}/`));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out.sort();
}

const PRODUCTION = productionSources();

describe("the member enumeration is the contract", () => {
  it("names 31 collections, in order, without duplicates", () => {
    /*
      The documents say "30 collections" (`DEMO_MIGRATION_WAVES.md` §W2,
      `DEMO_TO_DATA_TARGET_ARCHITECTURE.md` §3) — the count that predates
      `sessionCompensations` (compensation domain, added with the attendance/
      compensation wave). This test pins the CODE, which is the authority for
      what a dataset actually carries; the drift is recorded in the W2 evidence
      rather than fixed by editing the plan.
    */
    expect(DEMO_COLLECTIONS).toHaveLength(31);
    expect(DEMO_COLLECTIONS).toEqual([
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
      "media",
      "instruments",
      "programs",
      "levels",
      "learningContent",
      "levelContent",
      "placements",
      "chatConversations",
      "chatMessages",
      "galleryAlbums",
      "galleryImages",
      "pieces",
      "pieceAssignments",
      "progressEvents",
      "scheduledSessions",
      "attendanceRecords",
      "attendanceCorrections",
      "sessionCompensations",
    ]);
    expect(new Set(DEMO_COLLECTIONS).size).toBe(DEMO_COLLECTIONS.length);
    expect(DATASET_SINGLETONS).toEqual(["organization", "branding"]);
    expect(datasetMemberNames()).toHaveLength(33);
  });

  it("is the same enumeration the domain's stats use — one list, two readers", () => {
    const stats = datasetStats(createSeedDataset());
    expect(Object.keys(stats.counts)).toEqual([...DEMO_COLLECTIONS]);
  });
});

describe("the artifact states its versions, and they are the seed's own", () => {
  const manifest = readDatasetManifest(DIR);

  it("declares the artifact schema version this build expects", () => {
    expect(manifest.schemaVersion).toBe(DATASET_SCHEMA_VERSION);
  });

  it("carries the dataset version, the schedule anchor and the dataset timestamp", () => {
    // Compatibility values (W1 decision boundary): the artifact states them
    // verbatim instead of deriving a second copy an importer would have to
    // reconcile. `seedDate` is I19's anchor — nothing in W2 changes it.
    expect(manifest.datasetVersion).toBe(SEED_VERSION);
    expect(manifest.seedDate).toBe(SEED_DATE);
    expect(manifest.createdAt).toBe(SEED_TIMESTAMP);
    expect(manifest.seedDate).toBe("2026-09-01");
  });

  it("names the builder it was generated from, and the validator it passed", () => {
    expect(manifest.source).toBe("src/domains/demo/seed.ts#createSeedDataset()");
    expect(manifest.integrity).toEqual({
      validator: "src/domains/demo/backup.ts#validateDataset()",
      issues: 0,
    });
  });

  it("counts every member: collections from the dataset, singletons as one", () => {
    const seed = createSeedDataset();
    const stats = datasetStats(seed);
    // Counts follow the dataset's own key order, and cover exactly the members.
    expect(Object.keys(manifest.counts)).toEqual(manifest.keyOrder);
    expect(Object.keys(manifest.counts).sort()).toEqual(datasetMemberNames().sort());
    for (const name of DEMO_COLLECTIONS) {
      expect(manifest.counts[name], name).toBe(stats.counts[name]);
      expect(manifest.members[name].kind).toBe("collection");
      expect(manifest.members[name].file).toBe(`${name}.json`);
      expect(seed[name]).toHaveLength(stats.counts[name]);
    }
    for (const name of DATASET_SINGLETONS) {
      expect(manifest.counts[name], name).toBe(1);
      expect(manifest.members[name].kind).toBe("singleton");
    }
  });

  it("keeps the generated shape document in step with the manifest", () => {
    const schema = JSON.parse(readFileSync(join(DIR, manifest.schema.file), "utf8")) as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, { type: string }>;
    };
    expect(schema.required).toEqual(manifest.keyOrder);
    expect(schema.additionalProperties).toBe(false);
    for (const name of manifest.keyOrder) {
      expect(schema.properties[name]?.type, name).toBe(
        (DEMO_COLLECTIONS as readonly string[]).includes(name) ? "array" : "object",
      );
    }
  });
});

describe("the loader fails closed", () => {
  it("throws when the artifact directory does not exist", () => {
    expect(() => loadDatasetArtifact(join(sandbox, "does-not-exist"))).toThrow(DatasetArtifactError);
  });

  it("throws on a manifest that lost its contract", () => {
    const dir = copyArtifact("manifest-hollow");
    writeFileSync(join(dir, "manifest.json"), "{}\n", "utf8");
    expect(() => loadDatasetArtifact(dir)).toThrow(DatasetArtifactError);
    expect(validateDatasetArtifact(dir).map((issue) => issue.code)).toContain("MANIFEST_UNREADABLE");
  });

  it("throws when the manifest names a member it has no file record for", () => {
    const dir = copyArtifact("manifest-unknown-member");
    const manifest = readDatasetManifest(dir);
    manifest.keyOrder.push("noSuchCollection");
    writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    expect(() => loadDatasetArtifact(dir)).toThrow(DatasetArtifactError);
    const codes = validateDatasetArtifact(dir).map((issue) => issue.code);
    expect(codes).toContain("UNEXPECTED_MEMBER");
    expect(codes).toContain("MEMBER_RECORD_MISSING");
  });

  it("throws when a member file is missing, and never returns a partial dataset", () => {
    const dir = copyArtifact("member-missing");
    const manifest = readDatasetManifest(dir);
    rmSync(join(dir, manifest.members.students.file));
    let loaded: unknown = "not attempted";
    try {
      loaded = loadDatasetArtifact(dir);
    } catch (cause) {
      expect(cause).toBeInstanceOf(DatasetArtifactError);
    }
    expect(loaded, "a partial dataset was returned").toBe("not attempted");
    const codes = validateDatasetArtifact(dir).map((issue) => issue.code);
    expect(codes).toContain("MEMBER_FILE_MISSING");
    expect(codes).toContain("DATASET_LOAD_FAILED");
  });

  it("throws when a member file is truncated JSON", () => {
    const dir = copyArtifact("member-truncated");
    const manifest = readDatasetManifest(dir);
    const path = join(dir, manifest.members.scheduledSessions.file);
    writeFileSync(path, readFileSync(path, "utf8").slice(0, 40), "utf8");
    expect(() => loadDatasetArtifact(dir)).toThrow(DatasetArtifactError);
    const codes = validateDatasetArtifact(dir).map((issue) => issue.code);
    expect(codes).toContain("MEMBER_HASH_MISMATCH");
    expect(codes).toContain("DATASET_LOAD_FAILED");
  });

  it("catches a tampered member even when every hash is regenerated", () => {
    // The strongest tamper: edit a row AND update the manifest's hash for that
    // member. The member hash agrees, the asset hashes agree — the DATASET hash
    // is what still refuses, because it is computed over the canonical JSON of
    // the whole dataset.
    const dir = copyArtifact("member-tampered");
    const manifest = readDatasetManifest(dir);
    const path = join(dir, manifest.members.students.file);
    const rows = JSON.parse(readFileSync(path, "utf8")) as { id: string }[];
    rows[0].id = "st_tampered";
    writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    const codes = validateDatasetArtifact(dir).map((issue) => issue.code);
    expect(codes).toContain("DATASET_HASH_MISMATCH");
  });

  it("catches a stale file the manifest does not account for", () => {
    const dir = copyArtifact("stale-file");
    writeFileSync(join(dir, "oldCollection.json"), "[]\n", "utf8");
    expect(validateDatasetArtifact(dir).map((issue) => issue.code)).toContain("UNEXPECTED_ARTIFACT_FILE");
  });
});

describe("the artifact cannot reach the UI, and its JSON is not bundled", () => {
  const sources = new Map(PRODUCTION.map((file) => [file, readFileSync(join(ROOT, file), "utf8")]));

  /** `import … from "specifier"` / `import("specifier")` specifiers of a source. */
  function specifiersOf(source: string): string[] {
    return [
      ...[...source.matchAll(/\bfrom\s*"([^"]+)"/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]),
    ];
  }

  it("is never imported by an application module — the tooling is Node-only", () => {
    const offenders = [...sources]
      .filter(([, source]) => specifiersOf(source).some((specifier) => /@\/dataset\/(load|validate|write)$/.test(specifier)))
      .map(([file]) => file);
    expect(offenders, "an application module imported the artifact tooling").toEqual([]);
    // The scan is not vacuous: it sees the specifier it claims to ban.
    expect(
      specifiersOf('import { loadDatasetArtifact } from "@/dataset/load";').some((specifier) =>
        /@\/dataset\/(load|validate|write)$/.test(specifier),
      ),
    ).toBe(true);
  });

  it("is read by exactly one production module, through a raw import of its bytes", () => {
    // `librarySeed.ts` is the demo library file's home: its bytes come from the
    // artifact, and `ensureDemoLibraryFile` (capability-gated by the deployment
    // lock and the persisted lifecycle) is the only writer of those bytes.
    const referencing = [...sources]
      .filter(([, source]) => source.includes("data/dataset/"))
      .map(([file]) => file);
    expect(referencing).toEqual(["src/domains/demo/librarySeed.ts"]);
    expect(sources.get("src/domains/demo/librarySeed.ts")).toContain(
      'from "../../../data/dataset/assets/nocturne-op9-no2.txt?raw"',
    );

    const jsonImporters = [...sources].filter(([, source]) =>
      specifiersOf(source).some((specifier) => specifier.includes("data/dataset/") && specifier.endsWith(".json")),
    );
    expect(jsonImporters, "a dataset JSON file reached the bundle").toEqual([]);
  });

  it("keeps the artifact out of the app's own source tree", () => {
    // The data lives in `data/dataset/`, not under `src/`: no application module
    // can reach it by accident, and the M10 boundary (which scans `src/`) sees no
    // new fixture.
    expect(relative(ROOT, DIR)).toBe("data/dataset");
    expect(DIR.startsWith("src/")).toBe(false);
  });
});
