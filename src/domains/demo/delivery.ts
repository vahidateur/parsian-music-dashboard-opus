/**
 * Remove Demo / Deliver Production — the ownership-scoped delivery operation.
 *
 * ```text
 *   DEMO_ACTIVE ── deliverProduction ──► REMOVING ──► DELIVERED ──► LOCKED
 * ```
 *
 * THE THREE RULES THIS MODULE EXISTS TO ENFORCE
 *
 * 1. ONLY PROVEN DEMO DATA IS REMOVED. Ownership is evaluated explicitly
 *    (`evaluateDeliveryOwnership`) from persisted metadata — the lifecycle
 *    marker plus the dataset provenance record — never from names, emails,
 *    timestamps or row counts:
 *      - marker `demo` + (matching-or-absent) provenance  → demo-owned
 *      - marker `empty` + matching-or-absent provenance   → customer-owned
 *      - anything else (missing/corrupt marker, unreadable
 *        payload, corrupt/conflicting provenance)        → UNPROVEN
 *    Unproven ⇒ nothing is deleted, the state parks in `removing` (pending),
 *    and a retry is always safe. Fail closed.
 *
 * 2. NO BLANKET STORAGE WIPE. This operation touches only: its own two state
 *    keys, the dataset/lifecycle/provenance keys of a PROVEN demo environment,
 *    the demo-scoped credential/session keys of that environment, and blobs
 *    whose ids come from the canonical seed (provably demo bytes). It never
 *    calls `localStorage.clear()`, `sessionStorage.clear()` or
 *    `indexedDB.deleteDatabase()`; a blob whose ownership is unknown (an
 *    upload that happened to land in a demo environment) is PRESERVED.
 *
 * 3. IDEMPOTENT + RESUMABLE. The `removing` waypoint is persisted BEFORE any
 *    destructive step, and every step is safe to re-run: a completed delivery
 *    short-circuits with no destructive work; an interrupted one re-evaluates
 *    ownership from scratch — the freshly created production environment is
 *    customer-owned, so a second run can never re-delete it.
 *
 * The final transition (delivered → locked) persists the terminal lock that
 * `src/api/deploymentLock.ts` enforces at every demo service entry point.
 */
import { isUsableDatasetPayload, demoStore, type DemoStore } from "@/services/demoStore";
import {
  clearDeliveryPending,
  readDeliveryState,
  writeDeliveryPending,
  writeDeliveryState,
  type DeliveryPendingReason,
} from "@/api/deploymentLock";
import { DEMO_CREDENTIALS_KEY } from "@/domains/auth/demoCredentials";
import { AUTH_SESSION_KEY } from "@/domains/auth/localAuthRepository";
import { getBlobStore } from "@/domains/media/blobStore";
import { createEmptyEnvironment, type ConfirmedRequest } from "./lifecycle";
import { createSeedDataset } from "./seed";

/** Why an ownership evaluation refuses to call anything demo-owned. */
export type UnprovenReason = Extract<
  DeliveryPendingReason,
  "ownership-unproven" | "dataset-unreadable" | "ownership-conflict" | "provenance-unreadable"
>;

export type DeliveryOwnership =
  | { verdict: "demo" }
  | { verdict: "customer" }
  /** Nothing persisted under the dataset key (marker-only payloads included). */
  | { verdict: "no-environment" }
  | { verdict: "unproven"; reason: UnprovenReason };

/**
 * Pure ownership evaluation — reads raw storage probes only, writes nothing.
 * Called before AND during delivery; safe to call from tests and the UI.
 */
export function evaluateDeliveryOwnership(store: DemoStore = demoStore): DeliveryOwnership {
  const datasetPeek = store.peekDatasetPayload();
  if (!datasetPeek.readable) return { verdict: "unproven", reason: "dataset-unreadable" };

  if (datasetPeek.value === null) {
    // No records at all. A leftover marker (of either kind) carries no
    // customer data and is replaced by the production environment below.
    return { verdict: "no-environment" };
  }

  if (!isUsableDatasetPayload(datasetPeek.value)) {
    // Bytes exist but cannot be parsed/validated: ownership of their content
    // cannot be established. Preserve; retry after recovery.
    return { verdict: "unproven", reason: "dataset-unreadable" };
  }

  const markerPeek = store.peekLifecycleMarkerValue();
  if (!markerPeek.readable) return { verdict: "unproven", reason: "ownership-unproven" };
  const marker = store.readLifecycleMarker(); // null when absent OR corrupt
  if (marker === null) return { verdict: "unproven", reason: "ownership-unproven" };

  const provenance = store.readProvenance();
  if (provenance.kind === "corrupt") return { verdict: "unproven", reason: "provenance-unreadable" };
  if (provenance.kind === "valid") {
    const expected = marker === "demo" ? "demo" : "customer";
    if (provenance.value.owner !== expected) {
      return { verdict: "unproven", reason: "ownership-conflict" };
    }
  }

  return { verdict: marker === "demo" ? "demo" : "customer" };
}

/**
 * Blob ids that are provably demo-owned: exactly the media rows of the
 * canonical seed (the demo library file + the bundled showcase photographs).
 *
 * Deliberately NOT "every blob referenced by the current dataset": an upload
 * made while browsing a demo environment has unknown ownership, and unknown
 * ⇒ preserved (§ fail-closed). Because this list is derived from the static
 * seed, it stays valid even AFTER the dataset key has been removed — which is
 * what makes an interrupted cleanup resumable.
 */
export function demoOwnedBlobIds(): string[] {
  return createSeedDataset().media.map((row) => row.id);
}

export interface DeliverySuccess {
  ok: true;
  operation: "deliver-production";
  state: "locked";
  /** False when delivery had already completed (idempotent re-run). */
  changed: boolean;
  /** The ownership verdict this run acted on (`none` = already delivered). */
  ownership: DeliveryOwnership["verdict"] | "none";
  message: string;
}

export interface DeliveryPending {
  ok: false;
  pending: true;
  operation: "deliver-production";
  state: "removing";
  reason: DeliveryPendingReason;
  message: string;
}

export interface DeliveryRefused {
  ok: false;
  pending: false;
  operation: "deliver-production";
  reason: "not-confirmed";
  state: string;
  message: string;
}

export type DeliveryOutcome = DeliverySuccess | DeliveryPending | DeliveryRefused;

const PENDING_MESSAGES: Record<DeliveryPendingReason, string> = {
  "in-progress": "عملیات حذف دمو نیمه‌کاره مانده است؛ داده‌ها دست‌نخورده حفظ شده‌اند. با اجرای دوباره از همان‌جا ادامه می‌یابد.",
  "ownership-unproven":
    "مالکیت دادهٔ موجود قابل اثبات نیست؛ هیچ چیزی حذف نشد و داده‌ها حفظ شدند. نشانگر محیط را ترمیم کنید یا پشتیبان بگیرید، سپس دوباره تلاش کنید.",
  "dataset-unreadable":
    "دیتاست ذخیره‌شده خواندنی نیست؛ برای حفظ دادهٔ مشتری هیچ حذفی انجام نشد. پس از بازیابی فضای ذخیره‌سازی، دوباره تلاش کنید.",
  "ownership-conflict":
    "نشانگر محیط و اطلاعات مالکیت دیتاست با هم هم‌خوانی ندارند؛ هیچ چیزی حذف نشد. وضعیت برای بازبینی باقی می‌ماند.",
  "provenance-unreadable":
    "اطلاعات هویت دیتاست خراب است؛ هیچ چیزی حذف نشد و داده‌ها حفظ شدند.",
  "blob-cleanup-incomplete":
    "بخشی از فایل‌های دمو پاک نشدند؛ دیتاست و داده‌ها دست‌نخورده مانده‌اند. با اجرای دوباره، پاک‌سازی از همان‌جا ادامه می‌یابد.",
  "credential-cleanup-incomplete":
    "حذف اطلاعات ورود دمو ناموفق بود؛ داده‌ها حذف نشدند. با اجرای دوباره ادامه دهید.",
};

/**
 * Removes demo data (proven only) and activates the production lock.
 *
 * Confirm-gated like every destructive operation. See the module contract
 * above for the ownership/idempotency rules; `demoDataManager` and the
 * `ProductionDeliveryGate` are the sanctioned callers.
 */
export async function deliverProduction(
  request: ConfirmedRequest,
  store: DemoStore = demoStore,
): Promise<DeliveryOutcome> {
  const before = readDeliveryState();
  if (before === "delivered" || before === "locked") {
    // Idempotent re-run: no destructive step executes, ever.
    // Finish an interrupted delivered→locked transition, if any.
    if (before === "delivered") writeDeliveryState("locked");
    clearDeliveryPending();
    return {
      ok: true,
      operation: "deliver-production",
      state: "locked",
      changed: false,
      ownership: "none",
      message: "تحویل پیش‌تر انجام شده بود؛ هیچ عملیات مخربی تکرار نشد و داده‌های مشتری دست‌نخورده ماند.",
    };
  }

  if (!request?.confirm) {
    return {
      ok: false,
      pending: false,
      operation: "deliver-production",
      reason: "not-confirmed",
      state: before,
      message: "حذف دمو بدون تأیید صریح انجام نمی‌شود.",
    };
  }

  // Persist the waypoint BEFORE anything destructive: a refresh from here on
  // resumes as `removing` (demo rejected, customer data preserved, retry safe).
  writeDeliveryState("removing");
  writeDeliveryPending("in-progress");

  const ownership = evaluateDeliveryOwnership(store);

  if (ownership.verdict === "unproven") {
    writeDeliveryPending(ownership.reason);
    return {
      ok: false,
      pending: true,
      operation: "deliver-production",
      state: "removing",
      reason: ownership.reason,
      message: PENDING_MESSAGES[ownership.reason],
    };
  }

  if (ownership.verdict === "demo") {
    // 1. Proven demo blobs first — least-coupled step. If this fails the
    //    dataset is still intact, so the environment stays consistent and the
    //    retry is trivial.
    const blobFailures: unknown[] = [];
    for (const id of demoOwnedBlobIds()) {
      try {
        await getBlobStore().remove(id);
      } catch (cause) {
        blobFailures.push(cause);
      }
    }
    if (blobFailures.length > 0) {
      writeDeliveryPending("blob-cleanup-incomplete");
      return {
        ok: false,
        pending: true,
        operation: "deliver-production",
        state: "removing",
        reason: "blob-cleanup-incomplete",
        message: PENDING_MESSAGES["blob-cleanup-incomplete"],
      };
    }

    // 2. The dataset, its lifecycle marker and its provenance — all three keys
    //    belong to the proven demo environment. (store.reset() clears exactly
    //    these and notifies subscribers.)
    store.reset();

    // 3. Demo-scoped credential + session keys. In a proven demo environment
    //    these hold the showcase accounts' material — spec post-conditions.
    if (!removeKey(DEMO_CREDENTIALS_KEY) || !removeKey(AUTH_SESSION_KEY)) {
      writeDeliveryPending("credential-cleanup-incomplete");
      return {
        ok: false,
        pending: true,
        operation: "deliver-production",
        state: "removing",
        reason: "credential-cleanup-incomplete",
        message: PENDING_MESSAGES["credential-cleanup-incomplete"],
      };
    }
  } else {
    // `customer` or `no-environment`: the dataset (if any) is NOT demo-owned —
    // it is preserved byte-for-byte. Demo sample credentials cannot exist
    // without a demo dataset, and the local credential/session keys in a
    // customer environment are the CUSTOMER's own access material — deleting
    // them would destroy customer state, so ownership says: preserve.
    if (ownership.verdict === "no-environment") {
      // Nothing to preserve under the dataset key; a leftover demo session/
      // credential map would reference accounts that do not exist.
      if (!removeKey(DEMO_CREDENTIALS_KEY) || !removeKey(AUTH_SESSION_KEY)) {
        writeDeliveryPending("credential-cleanup-incomplete");
        return {
          ok: false,
          pending: true,
          operation: "deliver-production",
          state: "removing",
          reason: "credential-cleanup-incomplete",
          message: PENDING_MESSAGES["credential-cleanup-incomplete"],
        };
      }
    }
  }

  // 4. Guarantee a runnable production environment. In the demo path this is
  //    the fresh EMPTY environment; in the customer path the existing one was
  //    never touched; with no environment this creates the production boot
  //    state. A second run afterwards evaluates this customer-owned env and
  //    preserves it — that is the idempotency guarantee, by construction.
  const after = store.peekDatasetPayload();
  if (after.readable && after.value === null) {
    // demo path (reset removed the dataset) or no-environment: install the
    // production boot state. The customer path still holds its dataset and
    // skips this branch entirely — its bytes are never rewritten.
    store.initializeEnvironment("empty", createEmptyEnvironment());
  }

  // 5. Terminal transition: delivered → locked. Both reject demo operations.
  writeDeliveryState("delivered");
  clearDeliveryPending();
  writeDeliveryState("locked");

  const message =
    ownership.verdict === "demo"
      ? "داده‌های دمو حذف شد، محیط تولیدی خالی ساخته شد و قفل تولید فعال شد."
      : ownership.verdict === "customer"
        ? "قفل تولید فعال شد؛ داده‌های شما دست‌نخورده ماند و هیچ عملیات مخربی روی آن انجام نشد."
        : "قفل تولید فعال شد؛ دادهٔ دمویی برای حذف وجود نداشت.";

  return {
    ok: true,
    operation: "deliver-production",
    state: "locked",
    changed: true,
    ownership: ownership.verdict,
    message,
  };
}

/** Removes one of OUR demo-scoped keys. false = the removal itself failed. */
function removeKey(key: string): boolean {
  try {
    if (typeof localStorage === "undefined") return true; // nothing persisted
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
