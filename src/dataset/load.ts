/**
 * Loading the dataset artifact — FAIL CLOSED.
 *
 * The loader reads the committed artifact and rebuilds the dataset object in the
 * manifest's recorded key order, so the rebuilt value serializes to the same
 * bytes as the artifact's own `datasetSha256` claims. Anything that does not
 * satisfy the manifest — a missing member file, malformed JSON, an unreadable
 * manifest — throws `DatasetArtifactError` with the exact path and reason
 * instead of returning a partial dataset. A caller that cannot get `ok` gets
 * nothing; there is no degraded path, because a half-loaded dataset would be
 * presented as the product's sample data.
 *
 * Node-only on purpose: this module reads the repository's artifact from disk.
 * It is deliberately NOT imported by the application (the browser has no
 * filesystem), so it is not bundled and opens no new data path in the product.
 * A browser-side loader is a later wave's decision, not W2's.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATASET_ARTIFACT_DIR, DATASET_MANIFEST_FILE, type DatasetManifest } from "./schema";
import type { DemoDataset } from "@/domains/demo/types";

export class DatasetArtifactError extends Error {
  override readonly name = "DatasetArtifactError";
  constructor(message: string) {
    super(message);
  }
}

export interface LoadedDatasetArtifact {
  dir: string;
  manifest: DatasetManifest;
  /** The dataset, rebuilt in the manifest's key order. */
  dataset: DemoDataset;
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new DatasetArtifactError(
      `${what} is unreadable at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DatasetArtifactError(`${what} at ${path} is not valid JSON`);
  }
}

function asManifest(value: unknown, path: string): DatasetManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DatasetArtifactError(`the manifest at ${path} is not an object`);
  }
  const candidate = value as Partial<DatasetManifest>;
  if (typeof candidate.schemaVersion !== "string") {
    throw new DatasetArtifactError(`the manifest at ${path} carries no schemaVersion`);
  }
  if (!Array.isArray(candidate.keyOrder) || candidate.keyOrder.some((key) => typeof key !== "string")) {
    throw new DatasetArtifactError(`the manifest at ${path} carries no usable keyOrder`);
  }
  if (typeof candidate.members !== "object" || candidate.members === null) {
    throw new DatasetArtifactError(`the manifest at ${path} carries no members`);
  }
  if (typeof candidate.datasetSha256 !== "string") {
    throw new DatasetArtifactError(`the manifest at ${path} carries no datasetSha256`);
  }
  return candidate as DatasetManifest;
}

/** The artifact's manifest, validated only as far as the loader needs. */
export function readDatasetManifest(dir: string = DATASET_ARTIFACT_DIR): DatasetManifest {
  const path = join(dir, DATASET_MANIFEST_FILE);
  return asManifest(readJson(path, "the dataset manifest"), path);
}

/**
 * Loads the artifact and rebuilds the dataset.
 *
 * The rebuild uses the manifest's `keyOrder` — the recorded canonical order — so
 * the returned object's `JSON.stringify` is stable across loads and platforms.
 * A member named in `keyOrder` but missing from `members` is an error, not a
 * skipped key: an incomplete dataset must never look complete.
 */
export function loadDatasetArtifact(dir: string = DATASET_ARTIFACT_DIR): LoadedDatasetArtifact {
  const manifest = readDatasetManifest(dir);
  const rebuilt: Record<string, unknown> = {};
  for (const name of manifest.keyOrder) {
    const member = manifest.members[name];
    if (!member || typeof member.file !== "string") {
      throw new DatasetArtifactError(`the manifest names 「${name}」 but records no member file for it`);
    }
    const path = join(dir, member.file);
    rebuilt[name] = readJson(path, `the member 「${name}」`);
  }
  return { dir, manifest, dataset: rebuilt as unknown as DemoDataset };
}
