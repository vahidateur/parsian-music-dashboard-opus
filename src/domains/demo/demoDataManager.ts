/**
 * Demo Data Manager — data operations on an already-chosen environment.
 *
 * It owns no persistence: `DemoStoreImpl` remains the single database, and the
 * environment's KIND (EMPTY vs DEMO) is owned by `./lifecycle.ts`. Every
 * destructive operation goes through `replace()` on a fully validated dataset,
 * which is what makes restore atomic.
 *
 * Operations are deliberately distinct:
 *   initialize    — create the DEMO environment, only when nothing exists yet
 *   resetToSeed   — canonical shipped dataset (destructive) → marks the environment DEMO
 *   clear         — remove every RECORD, keep the environment and its mode (destructive)
 *   importDataset — replace with a validated dataset (destructive)
 *   restoreBackup — validate a backup file, then replace (destructive, atomic)
 *   uninitialize  — remove the environment itself (destructive; see lifecycle.ts)
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
import { setInstrumentCatalog } from "@/domains/instruments/catalog";
import {
  initializeDemoEnvironment,
  markLifecycle,
  readLifecycleState,
  uninitializeEnvironment,
  type ConfirmedRequest,
  type UninitializeResult,
} from "./lifecycle";
import { createEmptyDataset, createSeedDataset, SEED_VERSION } from "./seed";
import type { DataLifecycleMode, DataLifecycleState, DemoDataset, DemoDatasetStats } from "./types";

/** Destructive operations require an explicit, typed confirmation. */
export type { ConfirmedRequest };

export type DemoOperation =
  | "initialize"
  | "reset"
  | "clear"
  | "import-seed"
  | "import-dataset"
  | "restore-backup"
  | "uninitialize";

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

export class DemoDataManager {
  constructor(private readonly store: DemoStore = demoStore) {}

  /* ---------------- read ---------------- */

  snapshot(): DemoDataset {
    return this.store.snapshot();
  }

  isInitialized(): boolean {
    return this.store.isInitialized();
  }

  /**
   * The environment's lifecycle state: `uninitialized` | `empty` | `demo`.
   *
   * A pure read — it never seeds, never adopts, never writes. The lifecycle
   * boundary (`./lifecycle.ts`) owns the decision; this only reports it.
   */
  lifecycleState(): DataLifecycleState {
    return readLifecycleState(this.store);
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

  /**
   * Creates the DEMO environment only when nothing exists yet. Non-destructive.
   *
   * Delegates to the lifecycle boundary so there is exactly ONE demo-creation
   * path and exactly one place that records the mode — no second copy of the
   * seed logic here.
   */
  initialize(): DemoOperationSuccess {
    const result = initializeDemoEnvironment(this.store);
    return this.success(
      "initialize",
      result.changed,
      result.changed ? "دادهٔ نمایشی اولیه ساخته شد." : "دادهٔ دمو از قبل موجود است.",
    );
  }

  /**
   * Removes the environment entirely — dataset, lifecycle marker and stored
   * binaries — returning to UNINITIALIZED so the first-run choice is offered
   * again. Distinct from `clear()`, which keeps the environment and its mode.
   */
  uninitialize(request: ConfirmedRequest): Promise<UninitializeResult> {
    return uninitializeEnvironment(request, this.store);
  }

  /**
   * Restores the canonical shipped dataset.
   *
   * Installs demo data, so it also records the environment as DEMO: an EMPTY
   * customer environment that is explicitly reset to the showcase dataset IS a
   * demo environment afterwards, and leaving the marker saying otherwise would
   * hide demo records behind a "real data" label.
   */
  resetToSeed(request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("reset", createSeedDataset(), request, "دادهٔ دمو به حالت اولیه بازگردانده شد.", "demo");
  }

  /** Alias with distinct intent: importing the canonical seed. Also marks DEMO. */
  importSeed(request: ConfirmedRequest): DemoOperationResult {
    return this.applyDataset("import-seed", createSeedDataset(), request, "دیتاست کانونیکال وارد شد.", "demo");
  }

  /**
   * Empties every collection but keeps a valid, usable environment.
   *
   * The mode is deliberately NOT changed: an environment whose records were
   * cleared is the same environment. A DEMO dataset with zero students after
   * testing is still DEMO, and an EMPTY one is still EMPTY — the mode is never
   * inferred from how many rows are left.
   */
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
   * dataset in a single write. On any failure the current state is untouched and
   * the caller receives the list of issues.
   *
   * The lifecycle mode is PRESERVED: a restore replaces records, it does not
   * re-decide what kind of environment this is. An EMPTY customer environment
   * that restores its own backup stays EMPTY (and therefore keeps demo-only
   * provisioning off), which is the label the visitor chose.
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
    /** Recorded when the operation installs demo-sourced data. */
    mode?: DataLifecycleMode,
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

    if (mode) markLifecycle(mode, this.store);

    // Instrument labels are read synchronously by services and render paths
    // that cannot await a repository call, so the projection must be refreshed
    // as part of the swap — otherwise an export or CSV written straight after a
    // restore would carry names from the previous dataset.
    setInstrumentCatalog(dataset.instruments);

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
