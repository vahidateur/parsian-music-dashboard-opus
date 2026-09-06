import type { Page } from "@/api/types";
import type { CreateMediaInput, MediaAsset, MediaListParams } from "./types";

export interface MediaRepository {
  list(params?: MediaListParams, signal?: AbortSignal): Promise<Page<MediaAsset>>;
  get(id: string, signal?: AbortSignal): Promise<MediaAsset>;
  /** Validates, stores the bytes, and records the metadata. */
  create(input: CreateMediaInput): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
  /**
   * Retrieves the stored bytes. Returns `undefined` when the metadata exists
   * but the blob does not — e.g. after a backup restore, which carries
   * metadata but not binaries.
   */
  getBlob(id: string): Promise<Blob | undefined>;
}
