/**
 * The dataset schema — the ONE owner of "what the dataset is made of".
 *
 * W2 (`docs/migration/DEMO_MIGRATION_WAVES.md`) splits the dataset's *schema*
 * away from the demo domain's *types*. This module is that schema:
 *
 *   - the member enumeration (`DEMO_COLLECTIONS`, `DATASET_SINGLETONS`) and the
 *     member-name type — moved here from `src/domains/demo/types.ts`, which
 *     re-exports them so every existing import path keeps resolving;
 *   - the artifact contract: where `data/dataset/` lives, what its manifest
 *     states, what an asset record records, and how the canonical bytes of a
 *     dataset are defined.
 *
 * WHY IT IMPORTS NOTHING
 *
 * The schema is the lowest layer of the data plane: `src/domains/demo/types.ts`
 * imports it, it imports nothing. The dataset's *rows* are domain entities
 * (entities stay in their domains — one model, never two), and the envelope
 * that composes them (`DemoDataset`, the per-domain row shapes, the deferral
 * ledger's `Invoice` disposition) stays in `src/domains/demo/types.ts`. What
 * moves here is the part that must be knowable WITHOUT the demo domain: which
 * members exist, and what an artifact that carries them looks like.
 *
 * THE ARTIFACT (all paths relative to the repository root):
 *
 *   data/dataset/manifest.json          this artifact's contract: versions, the
 *                                       dataset's own key order, per-member
 *                                       file/sha256, counts, the dataset-wide
 *                                       sha256, and the asset-list/schema hashes
 *   data/dataset/<member>.json          one file per top-level dataset member —
 *                                       the 31 collections plus the two
 *                                       singletons (organization, branding)
 *   data/dataset/assets/assets.json     one record per asset the dataset
 *                                       references: bytes location, size, sha256
 *   data/dataset/assets/<filename>      materialized asset bytes (the demo
 *                                       library document, whose only previous
 *                                       copy lived inside TypeScript)
 *   data/dataset/schema/dataset.schema.json
 *                                       the generated shape document an importer
 *                                       validates against
 */

/**
 * Bumped only when the ARTIFACT's on-disk shape changes — never for a data
 * edit. It is not `SEED_VERSION` (the dataset's own content version) and not
 * the backup envelope's `schemaVersion`: three different questions, so three
 * different values.
 */
export const DATASET_SCHEMA_VERSION = "1";

export const DATASET_ARTIFACT_DIR = "data/dataset";
export const DATASET_MANIFEST_FILE = "manifest.json";
export const DATASET_ASSETS_DIR = "assets";
export const DATASET_ASSET_LIST_FILE = `${DATASET_ASSETS_DIR}/assets.json`;
export const DATASET_SCHEMA_DIR = "schema";
export const DATASET_SCHEMA_FILE = `${DATASET_SCHEMA_DIR}/dataset.schema.json`;

/**
 * Names of the array-shaped collections — used by validation and clearing.
 *
 * The enumeration is stated ONCE. `src/dataset/validate.ts` runs over it, the
 * artifact's manifest records counts for it, and `DemoDataPanel` renders it —
 * none of them keeps a copy (the same rule D8's disclosure follows).
 */
export const DEMO_COLLECTIONS = [
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
] as const;

export type DemoCollectionName = (typeof DEMO_COLLECTIONS)[number];

/**
 * The dataset's non-collection members.
 *
 * `organization` (the academy's rules) and `branding` (its identity) are single
 * objects, not arrays — the one structural difference the artifact must carry,
 * and the reason `validateDataset` treats `organization` specially.
 */
export const DATASET_SINGLETONS = ["organization", "branding"] as const;
export type DatasetSingletonName = (typeof DATASET_SINGLETONS)[number];

/** Every top-level member of the dataset: the 31 collections + 2 singletons. */
export type DatasetMemberName = DemoCollectionName | DatasetSingletonName;

/** One member file, as recorded in the manifest. */
export interface DatasetMemberRecord {
  /** Path relative to the artifact directory. */
  file: string;
  kind: "collection" | "singleton";
  /** sha256 of the FILE's bytes (pretty-printed JSON + trailing newline). */
  sha256: string;
}

/**
 * One asset the dataset references.
 *
 * `file` and `sourcePath` are mutually exclusive and say WHERE the bytes live:
 *
 *   - `file` — materialized under `data/dataset/`: bytes that had no home of
 *     their own before W2 (the demo library document lived inside
 *     `librarySeed.ts` as a string constant). The artifact, not the TypeScript,
 *     is where those bytes live now.
 *   - `sourcePath` — referenced in the repository: bytes that already ship from
 *     a canonical location (the six showcase photographs under
 *     `src/assets/images/`, which the app bundles). Copying them here would
 *     create a second copy of the same bytes in one repository — the drift the
 *     migration exists to remove — so the record states path + size + sha256
 *     and the equivalence suite proves the linkage.
 */
export interface DatasetAssetRecord {
  /** The media id the dataset's `media` collection carries. */
  id: string;
  kind: "document" | "image";
  filename: string;
  mimeType: string;
  /** The ACTUAL byte length of the bytes this record points at. */
  sizeBytes: number;
  /** Artifact-relative path, for materialized bytes. */
  file?: string;
  /** Repository-relative path, for referenced bytes. */
  sourcePath?: string;
  /** sha256 of the bytes, computed from the file itself at generation time. */
  sha256: string;
}

export interface DatasetManifest {
  /** This artifact's own shape version (`DATASET_SCHEMA_VERSION`). */
  schemaVersion: string;
  /**
   * The dataset's content version — `SEED_VERSION`, verbatim. A compatibility
   * value (W1 decision boundary): importers and the store compare against it,
   * so the artifact states it rather than deriving it.
   */
  datasetVersion: string;
  /**
   * When the dataset's content is dated. The canonical dataset is
   * deterministic, so this is the seed's own fixed timestamp — a wall-clock
   * generation time would make the artifact (and its hash) change on every
   * regeneration, which is exactly what "deterministic" forbids.
   */
  createdAt: string;
  /** Human label for the dataset, for importers and operators. */
  label: string;
  /** The date the demo schedule is anchored to (`SEED_DATE`) — a compatibility value. */
  seedDate: string;
  /** Where the dataset comes from — the builder this artifact serializes. */
  source: string;
  /**
   * The dataset's top-level key order, recorded so a reload reproduces the
   * canonical serialization BYTE-exactly. Pinned against
   * `Object.keys(createSeedDataset())` by the suite, so a seed reorder fails
   * loudly instead of silently changing the artifact.
   */
  keyOrder: string[];
  /** Rows per member: a collection's length, or 1 for a singleton. */
  counts: Record<string, number>;
  members: Record<string, DatasetMemberRecord>;
  /** sha256 of the canonical (compact) JSON of the whole dataset. */
  datasetSha256: string;
  /** The asset list and how many assets it carries. */
  assets: { file: string; count: number; sha256: string };
  /** The generated shape document and its hash. */
  schema: { file: string; sha256: string };
  /**
   * The domain validator that was run when this artifact was generated, and
   * how many issues it reported. `issues: 0` is a claim the suite re-checks by
   * running the same validator against the loaded artifact.
   */
  integrity: { validator: string; issues: number };
}

/**
 * The canonical serialization of a dataset — compact `JSON.stringify`.
 *
 * These are the exact bytes the store persists under `ava:demo:dataset`, the
 * bytes `datasetSha256` hashes, and the bytes the equivalence suite compares.
 * File formatting (pretty-printed members) is a presentation choice for
 * reviewability; THIS is the value. Defined once so the writer, the validator
 * and the tests can never disagree about what "the same dataset" means.
 */
export function canonicalDatasetJson(dataset: unknown): string {
  return JSON.stringify(dataset);
}

/** The file that carries one top-level member. */
export function memberFileName(name: string): string {
  return `${name}.json`;
}

/** Every member name the dataset must contain. */
export function datasetMemberNames(): string[] {
  return [...DEMO_COLLECTIONS, ...DATASET_SINGLETONS];
}

/** True for a name that must serialize as an array (a collection). */
export function isCollectionName(name: string): boolean {
  return (DEMO_COLLECTIONS as readonly string[]).includes(name);
}
