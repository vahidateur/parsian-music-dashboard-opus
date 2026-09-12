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
