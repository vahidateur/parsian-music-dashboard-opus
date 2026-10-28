/**
 * Validating the dataset artifact — the checks an importer would run.
 *
 * This is the artifact-level sibling of `domains/demo/backup.ts#validateDataset`:
 * that function answers "is this dataset internally coherent (ids, references)?",
 * this one answers "is this artifact the coherent dataset it claims to be —
 * every member present, counted, hashed; every asset resolvable; the file set
 * exact; the schema document agreeing with the manifest; the whole-dataset hash
 * matching?". It then hands the rebuilt dataset to the authoritative domain
 * validator rather than re-implementing referential integrity, so there is
 * exactly one answer to "is the data sound?".
 *
 * Never throws: every failure is an `ArtifactIssue` with a code, a message and
 * the path it came from. An empty array means the artifact is sound — the suite
 * asserts exactly that against the committed artifact.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateDataset } from "@/domains/demo/backup";
import {
  DATASET_ARTIFACT_DIR,
  DATASET_ASSET_LIST_FILE,
  DATASET_ASSETS_DIR,
  DATASET_MANIFEST_FILE,
  DATASET_SCHEMA_DIR,
  DATASET_SCHEMA_VERSION,
  datasetMemberNames,
  isCollectionName,
} from "./schema";
import { DatasetArtifactError, loadDatasetArtifact, readDatasetManifest } from "./load";
import type { DatasetAssetRecord, DatasetManifest } from "./schema";
import type { DemoDataset } from "@/domains/demo/types";

export interface ArtifactIssue {
  code: string;
  message: string;
  path?: string;
}

function issue(code: string, message: string, path?: string): ArtifactIssue {
  return { code, message, path };
}

/** sha256 of a file's exact bytes. */
export function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** sha256 of a string's UTF-8 bytes. */
export function sha256OfText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Resolves an artifact-relative path. */
function artifactPath(dir: string, relative: string): string {
  return join(dir, relative);
}

/** Resolves a repository-relative path named by an asset record. */
function repoPath(relative: string): string {
  return join(process.cwd(), relative);
}

/**
 * Validates the committed artifact at `dir`.
 *
 * `dir` defaults to the artifact directory relative to the repository root, so
 * the suite — and any CI — checks the artifact that actually ships in the repo.
 */
export function validateDatasetArtifact(dir: string = DATASET_ARTIFACT_DIR): ArtifactIssue[] {
  const issues: ArtifactIssue[] = [];

  let manifest: DatasetManifest;
  try {
    manifest = readDatasetManifest(dir);
  } catch (cause) {
    return [
      issue(
        "MANIFEST_UNREADABLE",
        cause instanceof Error ? cause.message : String(cause),
        join(dir, DATASET_MANIFEST_FILE),
      ),
    ];
  }

  if (manifest.schemaVersion !== DATASET_SCHEMA_VERSION) {
    issues.push(
      issue(
        "SCHEMA_VERSION_MISMATCH",
        `the artifact declares schemaVersion 「${String(manifest.schemaVersion)}」, this build expects 「${DATASET_SCHEMA_VERSION}」`,
        join(dir, DATASET_MANIFEST_FILE),
      ),
    );
  }

  validateFileSet(dir, manifest, issues);

  /* ---------------- key order: complete, known, no duplicates ------------ */
  const seen = new Set<string>();
  for (const name of manifest.keyOrder) {
    if (seen.has(name)) issues.push(issue("KEY_ORDER_DUPLICATE", `「${name}」 appears twice in keyOrder`));
    seen.add(name);
    if (!datasetMemberNames().includes(name)) {
      issues.push(issue("UNEXPECTED_MEMBER", `keyOrder names 「${name}」, which is not a dataset member`));
    }
  }
  for (const name of datasetMemberNames()) {
    if (!seen.has(name)) {
      issues.push(
        issue("MEMBER_MISSING", `the dataset member 「${name}」 is absent from keyOrder`, join(dir, DATASET_MANIFEST_FILE)),
      );
    }
  }

  /* ---------------- members: file, count, hash, shape -------------------- */
  for (const name of manifest.keyOrder) {
    const member = manifest.members[name];
    if (!member) {
      issues.push(issue("MEMBER_RECORD_MISSING", `「${name}」 has no member record`));
      continue;
    }
    const path = artifactPath(dir, member.file);
    if (!existsSync(path)) {
      issues.push(issue("MEMBER_FILE_MISSING", `「${name}」 claims ${member.file}, which does not exist`, path));
      continue;
    }
    const hash = sha256OfFile(path);
    if (hash !== member.sha256) {
      issues.push(
        issue("MEMBER_HASH_MISMATCH", `「${name}」 (${member.file}) hashes to ${hash}, the manifest says ${member.sha256}`, path),
      );
    }
    const text = readText(path);
    if (text === null) {
      issues.push(issue("MEMBER_UNREADABLE", `「${name}」 (${member.file}) cannot be read`, path));
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      issues.push(issue("MEMBER_MALFORMED", `「${name}」 (${member.file}) is not valid JSON`, path));
      continue;
    }
    const expectedKind = isCollectionName(name) ? "collection" : "singleton";
    if (member.kind !== expectedKind) {
      issues.push(issue("MEMBER_KIND_MISMATCH", `「${name}」 is recorded as ${member.kind}, expected ${expectedKind}`));
    }
    const recorded = manifest.counts[name];
    if (typeof recorded !== "number") {
      issues.push(issue("MEMBER_COUNT_MISSING", `「${name}」 has no recorded count`, join(dir, DATASET_MANIFEST_FILE)));
    }
    if (expectedKind === "collection") {
      if (!Array.isArray(value)) {
        issues.push(issue("MEMBER_NOT_ARRAY", `the collection 「${name}」 is not an array`, path));
      } else if (value.length !== recorded) {
        issues.push(
          issue("MEMBER_COUNT_MISMATCH", `the collection 「${name}」 has ${value.length} rows, the manifest records ${recorded}`, path),
        );
      }
    } else if (typeof value !== "object" || value === null || Array.isArray(value)) {
      issues.push(issue("MEMBER_NOT_OBJECT", `the singleton 「${name}」 is not an object`, path));
    } else if (recorded !== 1) {
      issues.push(issue("MEMBER_COUNT_MISMATCH", `the singleton 「${name}」 records count ${recorded}, expected 1`, path));
    }
  }

  /* ---------------- the dataset itself: rebuild + hash ------------------- */
  let dataset: DemoDataset | null = null;
  try {
    dataset = loadDatasetArtifact(dir).dataset;
    const hash = sha256OfText(JSON.stringify(dataset));
    if (hash !== manifest.datasetSha256) {
      issues.push(
        issue(
          "DATASET_HASH_MISMATCH",
          `the rebuilt dataset hashes to ${hash}, the manifest records ${manifest.datasetSha256}`,
          join(dir, DATASET_MANIFEST_FILE),
        ),
      );
    }
  } catch (cause) {
    issues.push(
      issue("DATASET_LOAD_FAILED", cause instanceof DatasetArtifactError ? cause.message : String(cause), dir),
    );
  }

  /* ---------------- the asset list and the asset bytes ------------------- */
  const assetIds = validateAssetList(dir, manifest, issues);

  /* ---------------- the dataset's media rows ⟷ the asset list ------------ */
  if (dataset && assetIds) {
    const mediaIds = new Set(dataset.media.map((row) => row.id));
    for (const id of mediaIds) {
      if (!assetIds.has(id)) {
        issues.push(
          issue("ASSET_MISSING_FOR_MEDIA", `the dataset's media row 「${id}」 has no asset record`, join(dir, manifest.assets.file)),
        );
      }
    }
    for (const id of assetIds) {
      if (!mediaIds.has(id)) {
        issues.push(
          issue("ASSET_ORPHANED", `the asset record 「${id}」 matches no media row in the dataset`, join(dir, manifest.assets.file)),
        );
      }
    }
  }

  /* ---------------- the generated schema document ------------------------ */
  validateSchemaDocument(dir, manifest, issues);

  /* ---------------- referential integrity, from the one authority -------- */
  if (dataset) {
    for (const violation of validateDataset(dataset)) {
      issues.push(issue(`INTEGRITY_${violation.code}`, violation.message, violation.path));
    }
  }

  return issues;
}

/**
 * The artifact directory carries EXACTLY its members, the manifest, the asset
 * directory and the schema directory — no stale member file from a previous
 * shape, no stray JSON. A stale file is how an old artifact silently keeps
 * looking valid.
 */
function validateFileSet(dir: string, manifest: DatasetManifest, issues: ArtifactIssue[]): void {
  if (!existsSync(dir)) {
    issues.push(issue("ARTIFACT_DIR_MISSING", `the artifact directory ${dir} does not exist`, dir));
    return;
  }
  const allowed = new Set<string>([DATASET_MANIFEST_FILE, DATASET_ASSETS_DIR, DATASET_SCHEMA_DIR]);
  for (const member of Object.values(manifest.members)) allowed.add(member.file);
  for (const entry of readdirSync(dir)) {
    if (!allowed.has(entry)) {
      issues.push(issue("UNEXPECTED_ARTIFACT_FILE", `the artifact directory carries 「${entry}」, which the manifest does not account for`, join(dir, entry)));
    }
  }
}

/** Returns the set of asset ids the list carries, or null when it is unusable. */
function validateAssetList(dir: string, manifest: DatasetManifest, issues: ArtifactIssue[]): Set<string> | null {
  const listPath = artifactPath(dir, manifest.assets.file);
  if (!existsSync(listPath)) {
    issues.push(issue("ASSET_LIST_MISSING", `the asset list ${manifest.assets.file} does not exist`, listPath));
    return null;
  }
  const hash = sha256OfFile(listPath);
  if (hash !== manifest.assets.sha256) {
    issues.push(issue("ASSET_LIST_HASH_MISMATCH", `the asset list hashes to ${hash}, the manifest records ${manifest.assets.sha256}`, listPath));
  }
  const text = readText(listPath);
  if (text === null) {
    issues.push(issue("ASSET_LIST_UNREADABLE", "the asset list cannot be read", listPath));
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    issues.push(issue("ASSET_LIST_MALFORMED", "the asset list is not valid JSON", listPath));
    return null;
  }
  if (!Array.isArray(parsed)) {
    issues.push(issue("ASSET_LIST_NOT_ARRAY", "the asset list is not an array", listPath));
    return null;
  }

  const ids = new Set<string>();
  const materialized = new Set<string>();
  for (const entry of parsed as DatasetAssetRecord[]) {
    if (typeof entry?.id !== "string" || entry.id.length === 0) {
      issues.push(issue("ASSET_UNNAMED", "an asset record carries no id", listPath));
      continue;
    }
    if (ids.has(entry.id)) issues.push(issue("ASSET_DUPLICATE", `the asset id 「${entry.id}」 appears twice`, listPath));
    ids.add(entry.id);

    const hasFile = typeof entry.file === "string";
    const hasSource = typeof entry.sourcePath === "string";
    if (hasFile === hasSource) {
      issues.push(
        issue(
          "ASSET_LOCATION_AMBIGUOUS",
          `asset 「${entry.id}」 must name exactly one of file/sourcePath (it names ${hasFile ? "both" : "neither"})`,
          listPath,
        ),
      );
      continue;
    }
    if (hasFile) materialized.add(entry.file as string);

    const path = hasFile ? artifactPath(dir, entry.file as string) : repoPath(entry.sourcePath as string);
    if (!existsSync(path)) {
      issues.push(
        issue("ASSET_MISSING", `asset 「${entry.id}」 points at ${hasFile ? entry.file : entry.sourcePath}, which does not exist`, path),
      );
      continue;
    }
    const bytes = readFileSync(path);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== entry.sha256) {
      issues.push(issue("ASSET_HASH_MISMATCH", `asset 「${entry.id}」 hashes to ${actualHash}, the record says ${entry.sha256}`, path));
    }
    if (bytes.byteLength !== entry.sizeBytes) {
      issues.push(issue("ASSET_SIZE_MISMATCH", `asset 「${entry.id}」 is ${bytes.byteLength} bytes, the record says ${entry.sizeBytes}`, path));
    }
  }

  if (parsed.length !== manifest.assets.count) {
    issues.push(issue("ASSET_COUNT_MISMATCH", `the asset list carries ${parsed.length} records, the manifest records ${manifest.assets.count}`, listPath));
  }

  // The asset directory holds the list plus exactly the materialized bytes.
  const assetsDir = artifactPath(dir, DATASET_ASSETS_DIR);
  if (existsSync(assetsDir)) {
    const expected = new Set<string>([
      DATASET_ASSET_LIST_FILE.split("/")[1],
      ...[...materialized].map((file) => file.split("/").pop() as string),
    ]);
    for (const entry of readdirSync(assetsDir)) {
      if (!expected.has(entry)) {
        issues.push(issue("UNEXPECTED_ASSET_FILE", `the assets directory carries 「${entry}」, which no record accounts for`, join(assetsDir, entry)));
      }
    }
  }

  return ids;
}

/** The generated shape document must state the members the manifest lists. */
function validateSchemaDocument(dir: string, manifest: DatasetManifest, issues: ArtifactIssue[]): void {
  const path = artifactPath(dir, manifest.schema.file);
  if (!existsSync(path)) {
    issues.push(issue("SCHEMA_FILE_MISSING", `the schema document ${manifest.schema.file} does not exist`, path));
    return;
  }
  const hash = sha256OfFile(path);
  if (hash !== manifest.schema.sha256) {
    issues.push(issue("SCHEMA_FILE_HASH_MISMATCH", `the schema document hashes to ${hash}, the manifest records ${manifest.schema.sha256}`, path));
  }
  const text = readText(path);
  if (text === null) {
    issues.push(issue("SCHEMA_FILE_UNREADABLE", "the schema document cannot be read", path));
    return;
  }
  let parsed: { required?: unknown; additionalProperties?: unknown; properties?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    issues.push(issue("SCHEMA_FILE_MALFORMED", "the schema document is not valid JSON", path));
    return;
  }
  if (!Array.isArray(parsed.required)) {
    issues.push(issue("SCHEMA_FILE_INCOMPLETE", "the schema document declares no required properties", path));
  } else {
    const required = parsed.required as string[];
    const missing = manifest.keyOrder.filter((key) => !required.includes(key));
    const extra = required.filter((key) => !manifest.keyOrder.includes(key));
    if (missing.length > 0 || extra.length > 0) {
      issues.push(
        issue(
          "SCHEMA_FILE_DRIFT",
          `the schema document's required properties differ from the manifest's keyOrder (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
          path,
        ),
      );
    }
  }
  if (parsed.additionalProperties !== false) {
    issues.push(issue("SCHEMA_FILE_PERMISSIVE", "the schema document must forbid additional properties", path));
  }
}
