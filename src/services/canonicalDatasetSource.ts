/**
 * Canonical sample-dataset source — data loading, not a repository.
 *
 * The store does not own the sample dataset. When a persisted payload is missing
 * collections an older build could not have stored, the store asks a source for
 * the current canonical dataset and fills only those gaps. The default source is
 * the seed builder. W2 proved that builder byte-equivalent to the versioned artifact;
 * the artifact loader is Node-only and is deliberately not imported here.
 *
 * A browser build has no filesystem. Bundling the artifact JSON would spend the
 * D9 headroom (118 B at the W2 tip) and would fail the W2 exposure gate. Fetching
 * it is build strategy B2, which is an owner decision required before W5 and is
 * not in force (B1 is). Tests feed an artifact-backed source through this same
 * interface; the production default stays the builder, which is the proven
 * equivalent, so observable behaviour does not change.
 */
import { createSeedDataset } from "@/domains/demo/seed";
import type { DemoDataset } from "@/domains/demo/types";

export interface CanonicalDatasetSource {
  /**
   * The current canonical sample dataset.
   *
   * Called only when a fill is actually needed — never at module load, never
   * from a read of a current payload.
   */
  current(): DemoDataset;
}

/** The sample dataset the store installs and migrates against. */
export function canonicalSampleDataset(): DemoDataset {
  return createSeedDataset();
}

export const seedDatasetSource: CanonicalDatasetSource = {
  current: canonicalSampleDataset,
};
