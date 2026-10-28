/**
 * Demo-domain barrel — data, lifecycle and operator operations.
 *
 * This barrel does not export the store. The canonical persistence authority
 * is LocalDataStore (`@/services/localStore`); importing it from here would
 * pull the store into every component that only wants `backupFileName`.
 * Dataset loading lives in `@/services/canonicalDatasetSource` — the store's
 * default source calls that builder, which W2 proved byte-equivalent to the
 * versioned artifact. This barrel re-exports only the source's type, so a
 * component import of the barrel gains no new runtime module. The Node
 * artifact loader is not re-exported: it must not enter the application
 * graph (W2 exposure gate; B1 still in force).
 */
export type { CanonicalDatasetSource } from "@/services/canonicalDatasetSource";

export { DemoDataManager, demoDataManager } from "./demoDataManager";
export {
  BOOTSTRAP_ADMIN,
  BOOTSTRAP_ADMIN_EMAIL,
  createEmptyEnvironment,
  initializeDemoEnvironment,
  initializeEmptyEnvironment,
  isDemoEnvironment,
  markLifecycle,
  persistLifecycleAdoption,
  readLifecycleState,
  uninitializeEnvironment,
} from "./lifecycle";
export type {
  LifecycleChoiceResult,
  LifecycleChoiceRefused,
  LifecycleChoiceSuccess,
  UninitializeResult,
} from "./lifecycle";
export type { ConfirmedRequest, DemoOperation, DemoOperationResult, DemoOperationSuccess, DemoOperationFailure } from "./demoDataManager";
export {
  BACKUP_ENVIRONMENT,
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  createBackup,
  datasetStats,
  findForbiddenKeys,
  parseBackup,
  validateBackup,
  validateDataset,
} from "./backup";
export type { DemoBackup, ValidationCode, ValidationIssue, ValidationResult } from "./backup";
export {
  SEED_VERSION,
  createEmptyDataset,
  createOrganizationSettings,
  createSeedDataset,
  deriveEnrollments,
  deriveRoles,
  deriveUsers,
} from "./seed";
export { DEMO_COLLECTIONS, LIFECYCLE_MODES } from "./types";
export type {
  DataLifecycleMode,
  DataLifecycleState,
  DemoCollectionName,
  DemoDataset,
  DemoDatasetStats,
  DemoRole,
  DemoRoom,
  DemoUser,
} from "./types";
