/**
 * Production storage boundary for media bytes.
 *
 * This interface intentionally has no vendor name and no UI dependency. The
 * existing MediaRepository remains the demo/local adapter until a backend
 * supplies an implementation. A future object-storage, self-hosted, or archive
 * adapter can satisfy this contract without changing Library, Gallery, Chat,
 * or profile-photo code.
 */
import type { CreateMediaInput, MediaAsset } from "./types";

export interface MediaUploadInitialization {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  kind: CreateMediaInput["kind"];
}

export interface MediaUploadSession {
  uploadId: string;
  mediaId: string;
  storageKey: string;
  uploadUrl: string;
  expiresAt: string;
  headers?: Record<string, string>;
}

export interface MediaUploadCompletion {
  uploadId: string;
  checksum?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  peaks?: number[];
}

export interface AuthorizedMediaUrl {
  mediaId: string;
  url: string;
  expiresAt: string;
}

export interface MediaChecksumLookup {
  checksum: string;
  sizeBytes: number;
  kind: CreateMediaInput["kind"];
}

export interface MediaReplacementInitialization extends MediaUploadInitialization {
  mediaId: string;
}

export interface MediaOrphanCleanupRequest {
  /** Only objects older than this timestamp may be considered. */
  olderThan: string;
  limit?: number;
}

export interface MediaOrphanCleanupResult {
  inspected: number;
  deleted: number;
  retained: number;
}

export interface MediaRetentionPolicy {
  /** Remove abandoned upload sessions after this many seconds. */
  pendingUploadTtlSeconds: number;
  /** Keep metadata tombstones for audit/restore after bytes are deleted. */
  deletedMetadataRetentionDays: number;
}

export interface MediaStorageUsage {
  scopeId: string;
  usedBytes: number;
  reservedBytes: number;
  quotaBytes?: number;
  measuredAt: string;
}

export interface MediaBackupRequest {
  scopeId: string;
  includeBytes: boolean;
}

export interface MediaBackupManifest {
  backupId: string;
  scopeId: string;
  createdAt: string;
  includesBytes: boolean;
  expiresAt?: string;
}

export interface MediaRestoreRequest {
  backupId: string;
  targetScopeId: string;
  restoreBytes: boolean;
}

export interface MediaRestoreResult {
  restoredAssets: number;
  restoredBytes: number;
  skippedAssets: number;
}

/**
 * Backend-facing storage adapter. Every method is deliberately a seam rather
 * than a demo implementation: authorization, quotas, retention, backup, and
 * restore must be enforced by the service that implements this interface.
 */
export interface MediaStorage {
  initializeUpload(input: MediaUploadInitialization, signal?: AbortSignal): Promise<MediaUploadSession>;
  completeUpload(input: MediaUploadCompletion, signal?: AbortSignal): Promise<MediaAsset>;
  abortUpload(uploadId: string, signal?: AbortSignal): Promise<void>;
  findByChecksum(input: MediaChecksumLookup, signal?: AbortSignal): Promise<MediaAsset | null>;
  initializeReplacement(
    input: MediaReplacementInitialization,
    signal?: AbortSignal,
  ): Promise<MediaUploadSession>;
  getAuthorizedUrl(mediaId: string, signal?: AbortSignal): Promise<AuthorizedMediaUrl>;
  deleteObject(mediaId: string, signal?: AbortSignal): Promise<void>;
  cleanupOrphans(
    input: MediaOrphanCleanupRequest,
    signal?: AbortSignal,
  ): Promise<MediaOrphanCleanupResult>;
  applyRetention(
    policy: MediaRetentionPolicy,
    signal?: AbortSignal,
  ): Promise<MediaOrphanCleanupResult>;
  getUsage(scopeId: string, signal?: AbortSignal): Promise<MediaStorageUsage>;
  createBackup(input: MediaBackupRequest, signal?: AbortSignal): Promise<MediaBackupManifest>;
  restore(input: MediaRestoreRequest, signal?: AbortSignal): Promise<MediaRestoreResult>;
}
