/**
 * W8 — dataset schema gate.
 *
 * The artifact contract is pinned. This gate does not load the artifact into
 * the client composition, and it does not change SEED_DATE, SEED_VERSION, or
 * the dataset bytes. A mismatch is a failure, not a rewrite.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATASET_SCHEMA_VERSION } from "@/dataset/schema";
import { validateDatasetArtifact } from "@/dataset/validate";
import { SEED_DATE } from "@/domains/demo/schedulingSeed";
import { SEED_VERSION } from "@/domains/demo/seed";

const ROOT = process.cwd();

interface VersionContract {
  schemaVersion: string;
  datasetVersion: string;
  seedDate: string;
}

function versionViolations(actual: VersionContract, expected: VersionContract): string[] {
  const violations: string[] = [];
  if (actual.schemaVersion !== expected.schemaVersion) violations.push("schemaVersion");
  if (actual.datasetVersion !== expected.datasetVersion) violations.push("datasetVersion");
  if (actual.seedDate !== expected.seedDate) violations.push("seedDate");
  return violations;
}

const EXPECTED: VersionContract = {
  schemaVersion: "1",
  datasetVersion: "2026.09.2",
  seedDate: "2026-09-01",
};

describe("dataset schema gate", () => {
  it("pins the manifest to the schema and the untouched seed constants", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "data", "dataset", "manifest.json"), "utf8")) as VersionContract;
    expect(DATASET_SCHEMA_VERSION).toBe(EXPECTED.schemaVersion);
    expect(SEED_VERSION).toBe(EXPECTED.datasetVersion);
    expect(SEED_DATE).toBe(EXPECTED.seedDate);
    expect(versionViolations(manifest, EXPECTED)).toEqual([]);
    expect(versionViolations({ ...EXPECTED, schemaVersion: "2" }, EXPECTED)).toEqual(["schemaVersion"]);
    expect(versionViolations({ ...EXPECTED, seedDate: "2026-09-02" }, EXPECTED)).toEqual(["seedDate"]);
  });

  it("the committed artifact validates, and the schema module imports nothing", () => {
    expect(validateDatasetArtifact()).toEqual([]);
    const schema = readFileSync(join(ROOT, "src", "dataset", "schema.ts"), "utf8");
    expect(schema).not.toMatch(/^import\s/m);
    expect(schema).not.toMatch(/\bfrom\s+["']/);
  });

  it("the client composition and the fixture manager do not load the artifact", () => {
    const files = [
      "src/domains/registry.client.ts",
      "src/domains/demo/demoDataManager.ts",
      "src/targets/targetFeatures.client.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, file).not.toContain("loadDatasetArtifact");
      expect(source, file).not.toMatch(/from ["']@\/dataset\//);
    }
  });
});
