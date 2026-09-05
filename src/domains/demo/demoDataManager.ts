/**
 * Demo Data Manager — lifecycle operations for the DEMO environment only.
 *
 * It owns no persistence: `DemoStoreImpl` remains the single demo database.
 * Every destructive operation goes through `replace()` on a fully validated
 * dataset, which is what makes restore atomic.
 *
 * Operations are deliberately distinct:
 *   initialize    — seed only when nothing exists yet
 *   resetToSeed   — canonical shipped dataset (destructive)
 *   clear         — empty demo environment (destructive)
 *   importDataset — replace with a validated dataset (destructive)
 *   restoreBackup — validate a backup file, then replace (destructive, atomic)
 *   exportBackup  — versioned envelope of the current state
 */
import { demoStore, type DemoStore } from "@/services/demoStore";
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  datasetStats,
  parseBackup,
  validateDataset,
  type DemoBackup,
  type ValidationIssue,
} from "./backup";
import { AUTH_SESSION_KEY } from "@/domains/auth/demoAuthRepository";
import { createEmptyDataset, createSeedDataset, SEED_VERSION } from "./seed";
import type { DemoDataset, DemoDatasetStats } from "./types";

export type DemoOperation = "initialize" | "reset" | "clear" | "import-seed" | "import-dataset" | "restore-backup";

export interface DemoOperationSuccess {
  ok: true;
  operation: DemoOperation;
  /** False when `initialize` found an existing dataset and did nothing. */
  changed: boolean;
  stats: DemoDatasetStats;
  /** Snapshot taken before a destructive operation, when one was possible. */
  safetyBackup?: DemoBackup;
  message: string;
}

export interface DemoOperationFailure {
  ok: false;
  operation: DemoOperation;
  issues: ValidationIssue[];
  message: string;
}

export type DemoOperationResult = DemoOperationSuccess | DemoOperationFailure;

/** Destructive operations require an explicit, typed confirmation. */
export interface ConfirmedRequest {
  confirm: true;
}

export class DemoDataManager {
  constructor(private readonly store: DemoStore = demoStore) {}

  /* ---------------- read ---------------- */

  snapshot(): DemoDataset {
    return this.store.snapshot();
  }

  isInitialized(): boolean {
    return this.store.isInitialized();
  }

  stats(): DemoDatasetStats {
    return datasetStats(this.store.snapshot());
  }

  get seedVersion(): string {
    return SEED_VERSION;
  }

  get schemaVersion(): string {
    return BACKUP_SCHEMA_VERSION;
  }

  /* ---------------- lifecycle ---------------- */

  /** Seeds the demo database only when it does not exist yet. Non-destructive. */
  initialize(): DemoOperationSuccess {
    if (this.store.isInitialized()) {
      return this.success("initialize", false, "دادهٔ دمو از قبل موجود است.");
    }
    this.store.replace(createSeedDataset());
    return this.success("initialize", true, "دادهٔ نمایشی اولیه ساخته شد.");
  }

  /** Restores the canonical shipped dataset. */
  resetToSeed(request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("reset", createSeedDataset(), request, "دادهٔ دمو به حالت اولیه بازگردانده شد.");
  }

  /** Alias with distinct intent: importing the canonical seed. */
  importSeed(request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("import-seed", createSeedDataset(), request, "دیتاست کانونیکال وارد شد.");
  }

  /** Empties every collection but keeps a valid, usable demo environment. */
  clear(request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("clear", createEmptyDataset(), request, "همهٔ رکوردهای دمو حذف شد.");
  }

  /** Replaces the demo state with an externally supplied dataset. */
  importDataset(dataset: DemoDataset, request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("import-dataset", dataset, request, "دیتاست وارد شد.");
  }

  /* ---------------- backup / restore ---------------- */

  exportBackup(exportedAt: Date = new Date()): DemoBackup {
    return createBackup(this.store.snapshot(), exportedAt);
  }

  exportBackupJson(exportedAt?: Date): string {
    return JSON.stringify(this.exportBackup(exportedAt), null, 2);
  }

  /**
   * Validates raw backup text and, only if it is fully valid, replaces the
   * demo state in a single write. On any failure the current state is
   * untouched and the caller receives the list of issues.
   */
  restoreBackup(text: string, request: ConfirmedRequest): DemoOperationResult {
    if (!request?.confirm) return this.needsConfirmation("restore-backup");

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      return { ok: false, operation: "restore-backup", issues: parsed.issues, message: "فایل پشتیبان معتبر نیست؛ دادهٔ فعلی تغییر نکرد." };
    }
    return this.applyDataset("restore-backup", parsed.backup.data, request, "پشتیبان بازگردانی شد.");
  }

  /* ---------------- internals ---------------- */

  /**
   * The single destructive path. Validates first, snapshots a safety backup,
   * then performs one atomic `replace`. A failed write leaves the previous
   * snapshot in place because nothing is deleted beforehand.
   */
  private applyDataset(
    operation: DemoOperation,
    dataset: DemoDataset,
    request: ConfirmedRequest,
    message: string,
  ): DemoOperationResult {
    if (!request?.confirm) return this.needsConfirmation(operation);

    const issues = validateDataset(dataset);
    if (issues.length > 0) {
      return { ok: false, operation, issues, message: "دادهٔ ورودی معتبر نیست؛ دادهٔ فعلی تغییر نکرد." };
    }

    const safetyBackup = this.store.isInitialized() ? createBackup(this.store.snapshot()) : undefined;

    try {
      this.store.replace(dataset);
    } catch (cause) {
      return {
        ok: false,
        operation,
        issues: [{ code: "INVALID_COLLECTION", message: cause instanceof Error ? cause.message : "خطای ذخیره‌سازی." }],
        message: "ذخیرهٔ داده ناموفق بود؛ دادهٔ فعلی تغییر نکرد.",
      };
    }

    // The signed-in user may no longer exist in the new dataset. Dropping the
    // session reference is safe: DemoAuthRepository re-validates on restore and
    // signs the user out if their account is gone or disabled.
    this.invalidateSessionIfUserMissing();

    return { ...this.success(operation, true, message), safetyBackup };
  }

  /** Clears the persisted session when its user is absent from the dataset. */
  private invalidateSessionIfUserMissing(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const userId = typeof parsed === "object" && parsed !== null ? (parsed as { userId?: unknown }).userId : undefined;
      const stillExists = typeof userId === "string" && this.store.snapshot().users.some((u) => u.id === userId);
      if (!stillExists) localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      /* storage unavailable or unparsable — nothing to invalidate */
    }
  }

  private needsConfirmation(operation: DemoOperation): DemoOperationFailure {
    return {
      ok: false,
      operation,
      issues: [{ code: "NOT_AN_OBJECT", message: "این عملیات نیازمند تأیید صریح کاربر است." }],
      message: "عملیات مخرب بدون تأیید انجام نمی‌شود.",
    };
  }

  private success(operation: DemoOperation, changed: boolean, message: string): DemoOperationSuccess {
    return { ok: true, operation, changed, stats: this.stats(), message };
  }
}

export const demoDataManager = new DemoDataManager();
