/**
 * LocalDataStore — the canonical store interface.
 *
 * Canonical code depends on this interface, not on `LocalStoreImpl`. The class
 * is one implementation (today's local persistence). A parameter typed as
 * `LocalDataStore` does not name the class, and a type-only import of this
 * module does not pull the implementation into a bundle.
 *
 * The interface describes the public surface repositories and the media
 * reference check already use. It does not add operations. Storage keys are
 * not part of the interface: they are compatibility constants on the module
 * that implements it (`ava:demo:dataset`, `ava:demo:lifecycle`).
 */
import type { CreateUserInput, UpdateUserInput, AuthUser } from "@/domains/auth/types";
import type { BrandingSettings } from "@/domains/branding/types";
import type { DataLifecycleMode, DemoDataset } from "@/domains/demo/types";
import type { OrganizationSettings } from "@/domains/organization/types";
import type { DatasetProvenance, ProvenanceRead, StoragePeek } from "@/services/localStore";

/** CRUD surface shared by every array collection on the store. */
export interface CollectionAccessor<Row> {
  all(): Row[];
  find(id: string): Row | undefined;
  create(draft: Omit<Row, "id"> & { id?: string }): Row;
  update(id: string, patch: Partial<Omit<Row, "id">>): Row | undefined;
  remove(id: string): boolean;
}

type Rows<K extends keyof DemoDataset> = DemoDataset[K] extends readonly (infer Row)[] ? Row : never;

/**
 * The local persistence authority, as a type.
 *
 * `LocalStoreImpl` implements this. `DemoStore` is a compatibility alias of
 * this interface — not of the class — so existing repository constructors keep
 * compiling while depending on the contract rather than the implementation.
 */
export interface LocalDataStore {
  subscribe(listener: () => void): () => void;
  snapshot(): DemoDataset;
  isInitialized(): boolean;
  replace(dataset: DemoDataset): void;
  initializeEnvironment(mode: DataLifecycleMode, dataset: DemoDataset): void;
  peekDatasetPayload(): StoragePeek;
  peekLifecycleMarkerValue(): StoragePeek;
  readProvenance(): ProvenanceRead;
  syncProvenance(owner: "demo" | "customer", origin: DatasetProvenance["origin"]): void;
  readLifecycleMarker(): DataLifecycleMode | null;
  writeLifecycleMarker(mode: DataLifecycleMode): void;
  clearLifecycleMarker(): void;
  reset(): void;

  readonly students: CollectionAccessor<Rows<"students">>;
  readonly teachers: CollectionAccessor<Rows<"teachers">>;
  readonly rooms: CollectionAccessor<Rows<"rooms">>;
  readonly classes: CollectionAccessor<Rows<"classes">>;
  readonly enrollments: CollectionAccessor<Rows<"enrollments">>;
  readonly resources: CollectionAccessor<Rows<"resources">>;
  readonly media: CollectionAccessor<Rows<"media">>;
  readonly instruments: CollectionAccessor<Rows<"instruments">>;
  readonly programs: CollectionAccessor<Rows<"programs">>;
  readonly levels: CollectionAccessor<Rows<"levels">>;
  readonly learningContent: CollectionAccessor<Rows<"learningContent">>;
  readonly levelContent: CollectionAccessor<Rows<"levelContent">>;
  readonly placements: CollectionAccessor<Rows<"placements">>;
  readonly chatConversations: CollectionAccessor<Rows<"chatConversations">>;
  readonly chatMessages: CollectionAccessor<Rows<"chatMessages">>;
  readonly galleryAlbums: CollectionAccessor<Rows<"galleryAlbums">>;
  readonly galleryImages: CollectionAccessor<Rows<"galleryImages">>;
  readonly pieces: CollectionAccessor<Rows<"pieces">>;
  readonly pieceAssignments: CollectionAccessor<Rows<"pieceAssignments">>;
  readonly progressEvents: CollectionAccessor<Rows<"progressEvents">>;
  readonly scheduledSessions: CollectionAccessor<Rows<"scheduledSessions">>;
  readonly attendanceRecords: CollectionAccessor<Rows<"attendanceRecords">>;
  readonly attendanceCorrections: CollectionAccessor<Rows<"attendanceCorrections">>;
  readonly sessionCompensations: CollectionAccessor<Rows<"sessionCompensations">>;
  readonly roles: CollectionAccessor<Rows<"roles">>;

  readonly branding: {
    get(): BrandingSettings;
    update(patch: Partial<Omit<BrandingSettings, "updatedAt">>): BrandingSettings;
  };
  readonly organization: {
    get(): OrganizationSettings;
    update(patch: Partial<Omit<OrganizationSettings, "updatedAt">>): OrganizationSettings;
  };
  readonly users: {
    all(): AuthUser[];
    find(id: string): AuthUser | undefined;
    create(input: CreateUserInput & { status: AuthUser["status"] }): AuthUser;
    update(id: string, patch: UpdateUserInput): AuthUser | undefined;
    remove(id: string): boolean;
  };
}
