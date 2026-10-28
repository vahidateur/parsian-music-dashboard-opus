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
 *   importSample  — operator Import on the fixture graph. Seed comes from
 *                   `createSeedDataset()`. Customer and unproven ownership are
 *                   not written. The runtime does not read `data/dataset`.
 *   resetToClean  — operator Reset on the fixture graph. Proven demo ownership
 *                   becomes empty. Customer and unproven are not written.
 *                   Empty and uninitialized are no-ops.
 *   clear         — remove every RECORD, keep the environment and its mode (destructive)
 *   importDataset — replace with a validated dataset (destructive)
 *   restoreBackup — validate a backup file, then replace (destructive, atomic)
 *   uninitialize  — remove the environment itself (destructive; see lifecycle.ts)
 *   exportBackup  — versioned envelope of the current state
 */
import { demoStore, stampDatasetProvenance, type DemoStore } from "@/services/demoStore";
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  datasetStats,
  parseBackup,
  validateDataset,
  type DemoBackup,
  type ValidationIssue,
} from "./backup";
import { AUTH_SESSION_KEY } from "@/domains/auth/localAuthRepository";
import {
  DemoDisabledError,
  DEMO_DISABLED_MESSAGE,
  DELIVERY_PENDING_MESSAGE,
  isDemoCapabilityAvailable,
  isDestructiveOperationAllowed,
} from "@/api/deploymentLock";
import { can, type PermissionHolder } from "@/domains/auth/permissions";
import { setInstrumentCatalog } from "@/domains/instruments/catalog";
import { getBlobStore } from "@/domains/media/blobStore";
import { evaluateDeliveryOwnership, demoOwnedBlobIds } from "./delivery";
import {
  createEmptyEnvironment,
  initializeDemoEnvironment,
  markLifecycle,
  readLifecycleState,
  uninitializeEnvironment,
  type ConfirmedRequest,
  type UninitializeResult,
} from "./lifecycle";
import { createEmptyDataset, createSeedDataset, SEED_VERSION } from "./seed";
import {
  provenanceForLifecycle,
  type DataLifecycleMode,
  type DataLifecycleState,
  type DemoDataset,
  type DemoDatasetStats,
} from "./types";

/** Destructive operations require an explicit, typed confirmation. */
export type { ConfirmedRequest };

export type DemoOperation =
  | "initialize"
  | "reset"
  | "import-sample"
  | "reset-clean"
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
    if (!result.ok && result.reason === "demo-disabled") {
      // The contract of this method is "created or already there"; after the
      // production lock neither holds, so the call itself is rejected — loudly,
      // with the stable code, rather than reported as a no-op success.
      throw new DemoDisabledError("initialize");
    }
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
    if (!isDemoCapabilityAvailable()) return this.demoDisabled("reset");
    return this.applyDataset("reset", createSeedDataset(), request, "دادهٔ دمو به حالت اولیه بازگردانده شد.", "sample");
  }

  /**
   * Operator Import on the fixture graph.
   *
   * The only payload is `createSeedDataset()`, validated before any write.
   * Uninitialized, a pristine empty envelope, and a proven demo envelope may
   * receive it. A customer envelope that is no longer the empty contract, and
   * any unproven envelope, are not written. An empty envelope is not treated
   * as customer-owned for this refusal.
   */
  importSample(request: ConfirmedRequest, actor?: PermissionHolder | null): DemoOperationResult {
    const refused = this.operatorGate("import-sample", request, actor);
    if (refused) return refused;

    const dataset = createSeedDataset();
    const issues = validateDataset(dataset);
    if (issues.length > 0) {
      return {
        ok: false,
        operation: "import-sample",
        issues,
        message: "دادهٔ نمونه معتبر نیست؛ هیچ چیزی نوشته نشد.",
      };
    }

    if (!this.store.isInitialized()) {
      try {
        this.store.initializeEnvironment("sample", dataset);
      } catch (cause) {
        if (!this.store.isInitialized()) this.store.clearLifecycleMarker();
        return this.writeFailed("import-sample", cause);
      }
      setInstrumentCatalog(dataset.instruments);
      return this.success("import-sample", true, "دادهٔ نمونه از سازندهٔ seed وارد شد.");
    }

    const ownership = evaluateDeliveryOwnership(this.store);
    if (ownership.verdict === "unproven") return this.unchanged("import-sample");
    if (ownership.verdict === "customer" && !this.isPristineEmpty()) return this.unchanged("import-sample");

    if (ownership.verdict === "demo" && this.sameRecords(this.store.snapshot(), dataset)) {
      const raw = this.store.peekLifecycleMarkerValue();
      if (raw.readable && raw.value === "demo") {
        markLifecycle("sample", this.store);
        return this.success("import-sample", true, "نشانگر نمونه به شکل کانونیکال نوشته شد.");
      }
      return this.success("import-sample", false, "دادهٔ نمونه از قبل نصب است؛ تغییری انجام نشد.");
    }

    return this.applyDataset(
      "import-sample",
      dataset,
      request,
      "دادهٔ نمونه از سازندهٔ seed وارد شد.",
      "sample",
    );
  }

  /**
   * Operator Reset. Ownership is `evaluateDeliveryOwnership()` only.
   *
   *   demo        → delete demo-owned blobs, then empty environment
   *   customer    → no write
   *   unproven    → no write
   *   pristine empty / uninitialized → no-op
   *
   * Blob deletion failure stops before the dataset is touched.
   */
  async resetToClean(request: ConfirmedRequest, actor?: PermissionHolder | null): Promise<DemoOperationResult> {
    const refused = this.operatorGate("reset-clean", request, actor);
    if (refused) return refused;

    if (!this.store.isInitialized() || readLifecycleState(this.store) === "uninitialized") {
      return this.noop("reset-clean");
    }
    if (this.isPristineEmpty()) return this.noop("reset-clean");

    const ownership = evaluateDeliveryOwnership(this.store);
    if (ownership.verdict !== "demo") return this.unchanged("reset-clean");

    const blobs = getBlobStore();
    for (const id of demoOwnedBlobIds()) {
      try {
        await blobs.remove(id);
      } catch {
        return {
          ok: false,
          operation: "reset-clean",
          issues: [{ code: "OPERATION_BLOCKED", message: "حذف فایل‌های نمونه کامل نشد؛ دادهٔ محیط دست نخورده ماند." }],
          message: "حذف فایل‌های نمونه شکست خورد؛ دادهٔ محیط نوشته نشد.",
        };
      }
    }
    return this.applyDataset(
      "reset-clean",
      createEmptyEnvironment(),
      request,
      "محیط نمونه به محیط خالی بازنشانی شد.",
      "empty",
    );
  }

  /** Alias with distinct intent: importing the canonical seed. Also marks DEMO. */
  importSeed(request: ConfirmedRequest): DemoOperationResult {
    if (!isDemoCapabilityAvailable()) return this.demoDisabled("import-seed");
    return this.applyDataset("import-seed", createSeedDataset(), request, "دیتاست کانونیکال وارد شد.", "sample");
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
    // While a delivery attempt is pending, EVERY destructive operation is
    // frozen: recovery must observe a stable dataset. After delivery `clear`
    // remains a customer operation (it empties the customer's own records) —
    // it is not "Clear Demo", which no longer exists.
    if (!isDestructiveOperationAllowed()) return this.operationBlocked("clear");
    return this.applyDataset("clear", createEmptyDataset(), request, "همهٔ رکوردهای دمو حذف شد.");
  }

  /**
   * Replaces the demo state with an externally supplied dataset.
   *
   * Post-delivery this is rejected: an externally supplied payload has no
   * provable ownership, and installing an unprovable dataset into a locked
   * deployment violates the same fail-closed rule that keeps delivery from
   * deleting one. Pre-delivery it behaves exactly as before.
   */
  importDataset(dataset: DemoDataset, request: ConfirmedRequest): DemoOperationResult {
    if (!isDestructiveOperationAllowed()) return this.operationBlocked("import-dataset");
    if (!isDemoCapabilityAvailable()) return this.demoDisabled("import-dataset");
    return this.applyDataset("import-dataset", dataset, request, "دیتاست وارد شد.");
  }

  /* ---------------- backup / restore ---------------- */

  exportBackup(exportedAt: Date = new Date()): DemoBackup {
    // Stamp the envelope with the CURRENT environment: a customer environment
    // exports as `empty` (restorable after delivery); a sample environment
    // exports as `demo`. The envelope token stays `demo` — that is the portable
    // backup contract (`demo` | `empty`). A locked restore rejects `demo`.
    // Writing `sample` into the envelope would make the file a foreign backup.
    const environment = this.lifecycleState() === "empty" ? "empty" : "demo";
    return createBackup(this.store.snapshot(), exportedAt, environment);
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
    if (!isDestructiveOperationAllowed()) return this.operationBlocked("restore-backup");
    if (!request?.confirm) return this.needsConfirmation("restore-backup");

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      return { ok: false, operation: "restore-backup", issues: parsed.issues, message: "فایل پشتیبان معتبر نیست؛ دادهٔ فعلی تغییر نکرد." };
    }
    if (!isDemoCapabilityAvailable() && parsed.backup.environment === "demo") {
      // Locked deployments accept customer (`empty`) backups only — a
      // demo-stamped envelope is demo capability by another name.
      return {
        ok: false,
        operation: "restore-backup",
        issues: [{ code: "WRONG_ENVIRONMENT", message: DEMO_DISABLED_MESSAGE }],
        message: DEMO_DISABLED_MESSAGE,
      };
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
      // An operation that records the mode (reset/import of canonical data)
      // also re-establishes OWNSERSHIP: the payload being installed IS that
      // mode's data, so its stamp must land with it — otherwise an EMPTY
      // environment reset to the seed would carry a customer stamp over demo
      // records and delivery would (correctly) refuse to delete them.
      const stamp = mode ? provenanceForLifecycle(mode) : null;
      this.store.replace(
        stamp ? stampDatasetProvenance(dataset, stamp.owner, stamp.origin) : dataset,
      );
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
    // session reference is safe: LocalAuthRepository re-validates on restore and
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

  private demoDisabled(operation: DemoOperation): DemoOperationFailure {
    return {
      ok: false,
      operation,
      issues: [{ code: "DEMO_DISABLED", message: DEMO_DISABLED_MESSAGE }],
      message: DEMO_DISABLED_MESSAGE,
    };
  }

  private operationBlocked(operation: DemoOperation): DemoOperationFailure {
    return {
      ok: false,
      operation,
      issues: [{ code: "OPERATION_BLOCKED", message: DELIVERY_PENDING_MESSAGE }],
      message: DELIVERY_PENDING_MESSAGE,
    };
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

  /** Empty or uninitialized Reset: success, no write. */
  private noop(operation: DemoOperation): DemoOperationSuccess {
    return this.success(operation, false, "محیط خالی یا مقداردهی‌نشده است؛ هیچ تغییری انجام نشد.");
  }

  /** Customer or unproven: refusal, no write. */
  private unchanged(operation: DemoOperation): DemoOperationFailure {
    return {
      ok: false,
      operation,
      issues: [{ code: "OPERATION_BLOCKED", message: "مالکیت این محیط اجازهٔ این عملیات را نمی‌دهد." }],
      message: "مالکیت این محیط اجازهٔ تغییر نمی‌دهد؛ هیچ چیزی نوشته نشد.",
    };
  }

  /**
   * Service-layer authorization. Hiding the button is not this check.
   * `demo.manage` is the existing permission; no new one is introduced.
   */
  private operatorGate(
    operation: DemoOperation,
    request: ConfirmedRequest,
    actor: PermissionHolder | null | undefined,
  ): DemoOperationFailure | null {
    if (!can(actor, "demo.manage")) {
      return {
        ok: false,
        operation,
        issues: [{ code: "OPERATION_BLOCKED", message: "مجوز demo.manage برای این عملیات لازم است." }],
        message: "مجوز demo.manage برای این عملیات لازم است؛ هیچ چیزی نوشته نشد.",
      };
    }
    if (!isDestructiveOperationAllowed()) return this.operationBlocked(operation);
    if (!isDemoCapabilityAvailable()) return this.demoDisabled(operation);
    if (!request?.confirm) return this.needsConfirmation(operation);
    return null;
  }

  private writeFailed(operation: DemoOperation, cause: unknown): DemoOperationFailure {
    return {
      ok: false,
      operation,
      issues: [{ code: "INVALID_COLLECTION", message: cause instanceof Error ? cause.message : "خطای ذخیره‌سازی." }],
      message: "ذخیرهٔ داده ناموفق بود؛ دادهٔ فعلی تغییر نکرد.",
    };
  }

  /** Empty contract, not a customer envelope that has acquired its own records. */
  private isPristineEmpty(): boolean {
    if (!this.store.isInitialized() || this.store.readLifecycleMarker() !== "empty") return false;
    return this.sameRecords(this.store.snapshot(), createEmptyEnvironment());
  }

  /** Record identity, ignoring the provenance stamp the store adds on write. */
  private sameRecords(left: DemoDataset, right: DemoDataset): boolean {
    const view = (dataset: DemoDataset) => {
      const { provenance: _provenance, ...records } = dataset as DemoDataset & { provenance?: unknown };
      return JSON.stringify(records);
    };
    return view(left) === view(right);
  }
}

export const demoDataManager = new DemoDataManager();
