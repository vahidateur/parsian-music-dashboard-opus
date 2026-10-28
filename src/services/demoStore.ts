/**
 * Compatibility module for the local store.
 *
 * The canonical implementation is `./localStore` (`LocalStoreImpl`, typed by
 * `LocalDataStore`). This file remains so every existing import of
 * `@/services/demoStore` resolves to the same singleton, the same keys and the
 * same functions. It constructs nothing of its own — a second `new` here would
 * split the subscription `targets/environment.tsx` installs.
 *
 * Storage keys are not renamed. Deleting this shim is an import-path sweep
 * (W4 for repositories, W9 for the residue), not W3.
 */
export {
  DEMO_STORAGE_KEY,
  LIFECYCLE_STORAGE_KEY,
  memoryStorage,
  isUsableDatasetPayload,
  stampDatasetProvenance,
  clone,
  migrateDataset,
  localStore,
  localStore as demoStore,
  LocalStoreImpl,
  LocalStoreImpl as DemoStoreImpl,
} from "./localStore";

export type {
  DatasetProvenance,
  StoragePeek,
  ProvenanceRead,
  StorageLike,
  StudentDraft,
  LocalDataStore,
  LocalDataStore as DemoStore,
  CollectionAccessor,
  CanonicalDatasetSource,
} from "./localStore";
