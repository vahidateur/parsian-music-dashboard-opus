import type { Page } from "@/api/types";
import type { CreateLibraryItemInput, LibraryItem, LibraryListParams, UpdateLibraryItemInput } from "./types";

/**
 * Business-facing contract for library catalogue persistence.
 * Implementations: DemoLibraryRepository (#1) and ApiLibraryRepository (#2).
 *
 * BYTES ARE NOT PART OF THIS CONTRACT — deliberately.
 *
 * A record references a `MediaAsset.id`; retrieving the file goes through
 * `MediaRepository.getBlob(id)`, the same abstraction profile photos and
 * gallery images use. Keeping binaries out of this interface means one storage
 * boundary for the whole product instead of one per domain, and no
 * implementation can invent its own way of holding a file.
 *
 * Methods speak in domain ids ("res1"), never in URLs or storage keys.
 * Failures are always `ApiError` instances (see `@/api/errors`).
 */
export interface LibraryRepository {
  list(params?: LibraryListParams, signal?: AbortSignal): Promise<Page<LibraryItem>>;
  get(id: string, signal?: AbortSignal): Promise<LibraryItem>;
  create(input: CreateLibraryItemInput): Promise<LibraryItem>;
  update(id: string, input: UpdateLibraryItemInput): Promise<LibraryItem>;
  /** Removes the catalogue row and frees a file no other row references. */
  delete(id: string): Promise<void>;
}
