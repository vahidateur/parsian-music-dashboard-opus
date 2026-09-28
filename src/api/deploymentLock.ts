/**
 * Deployment lock — the production-delivery lifecycle state machine.
 *
 * ```text
 *   DEMO_ACTIVE ──► REMOVE_DEMO ──► PRODUCTION_DELIVERED ──► LOCKED
 *   (default)       ("removing")     ("delivered")          ("locked")
 * ```
 *
 * WHY A SEPARATE MODULE, NOT A UI FLAG
 * Hiding a button is not a security boundary. Every demo capability in the
 * product funnels through `assertDemoOperationAllowed` / the guard helpers, so
 * a hand-invoked service call after delivery is rejected exactly like the
 * button it never saw. The state is persisted under its own key — independent
 * of the dataset and of the lifecycle marker — so it survives reloads, dataset
 * deletion and first-run re-initialisation.
 *
 * FAIL-CLOSED READING
 * The persisted value is user-editable storage, so it is never trusted:
 *   - absent            → demo capability available (nothing has been delivered)
 *   - recognised value  → that state
 *   - UNRECOGNISED      → treated as LOCKED. A corrupted marker cannot be
 *                         allowed to re-enable demo; customer reads/writes are
 *                         unaffected, and the delivery op is still idempotent.
 *
 * The "removing" state is the pending/recovery waypoint: ownership could not
 * be proven or cleanup stopped halfway. Demo operations are rejected there
 * too (fail closed), customer data is untouched, and `deliverProduction` may
 * be retried safely — it re-evaluates from scratch and never repeats a
 * destructive step it already completed.
 *
 * DELIBERATELY NOT HERE: any dataset/storage deletion. This module only reads
 * and writes its own two keys; the ownership-scoped removal lives in
 * `domains/demo/delivery.ts`.
 */

export const DELIVERY_STORAGE_KEY = "ava:delivery:state";
export const DELIVERY_PENDING_KEY = "ava:delivery:pending";

export type DeliveryState = "demo_active" | "removing" | "delivered" | "locked";

const DELIVERY_STATES: readonly DeliveryState[] = ["demo_active", "removing", "delivered", "locked"];

/** Why a delivery attempt is parked in `removing` (pending / recovery). */
export type DeliveryPendingReason =
  | "in-progress"
  | "ownership-unproven"
  | "dataset-unreadable"
  | "ownership-conflict"
  | "provenance-unreadable"
  | "blob-cleanup-incomplete"
  | "credential-cleanup-incomplete";

export interface DeliveryPending {
  reason: DeliveryPendingReason;
  at: string;
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const probe = `${DELIVERY_STORAGE_KEY}__probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/** In-memory fallback for SSR/tests — behaviour is identical. */
export function memoryDeliveryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

let storage: KeyValueStorage = browserStorage() ?? memoryDeliveryStorage();

/** Test/bootstrap seam — swap the backing storage (returns the previous one). */
export function setDeliveryStorage(next: KeyValueStorage): KeyValueStorage {
  const previous = storage;
  storage = next;
  return previous;
}

/**
 * The persisted delivery state. Pure read — writes nothing, migrates nothing.
 * An unrecognised non-absent value answers `locked` (see the fail-closed rule
 * above); `readDeliveryStateInfo` reports the raw value for diagnostics.
 */
export function readDeliveryState(): DeliveryState {
  return readDeliveryStateInfo().state;
}

export function readDeliveryStateInfo(): {
  state: DeliveryState;
  /** The raw persisted value, for diagnostics. `null` when absent. */
  raw: string | null;
  /** True when a value was present but not a known state (fail-closed → locked). */
  corrupt: boolean;
} {
  const raw = safeGet(DELIVERY_STORAGE_KEY);
  if (raw === null) return { state: "demo_active", raw: null, corrupt: false };
  if ((DELIVERY_STATES as readonly string[]).includes(raw)) {
    return { state: raw as DeliveryState, raw, corrupt: false };
  }
  return { state: "locked", raw, corrupt: true };
}

export function writeDeliveryState(next: DeliveryState): void {
  safeSet(DELIVERY_STORAGE_KEY, next);
}

/**
 * Whether demo capabilities may run. TRUE only in `demo_active` — every other
 * state (including pending `removing` and a corrupt marker) rejects.
 */
export function isDemoCapabilityAvailable(): boolean {
  return readDeliveryState() === "demo_active";
}

/** True once delivery completed (delivered or locked). */
export function isProductionDelivered(): boolean {
  const state = readDeliveryState();
  return state === "delivered" || state === "locked";
}

/** True while a delivery attempt is pending/recovering. */
export function isDeliveryPending(): boolean {
  return readDeliveryState() === "removing";
}

/** The pending marker for a delivery in `removing`, or null. */
export function readDeliveryPending(): DeliveryPending | null {
  const raw = safeGet(DELIVERY_PENDING_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" || parsed === null) {
      const record = parsed as { reason?: unknown; at?: unknown };
      if (record && typeof record.reason === "string" && typeof record.at === "string") {
        return { reason: record.reason as DeliveryPendingReason, at: record.at };
      }
    }
  } catch {
    /* unparsable pending marker: report none — the state itself still says removing */
  }
  return null;
}

export function writeDeliveryPending(reason: DeliveryPendingReason): void {
  safeSet(DELIVERY_PENDING_KEY, JSON.stringify({ reason, at: new Date().toISOString() }));
}

export function clearDeliveryPending(): void {
  safeRemove(DELIVERY_PENDING_KEY);
}

/**
 * The error every demo capability throws/returns after delivery.
 * `code` is stable so callers and tests can identify it without matching copy.
 */
export class DemoDisabledError extends Error {
  readonly code = "DEMO_DISABLED";
  constructor(readonly operation: string) {
    super(
      `عملیات دمو «${operation}» پس از تحویل تولید غیرفعال است و اجرا نمی‌شود.`,
    );
    this.name = "DemoDisabledError";
  }
}

export const DEMO_DISABLED_MESSAGE =
  "دمو پس از تحویل نسخهٔ تولید به‌صورت دائمی غیرفعال شده است؛ این عملیات اجرا نمی‌شود.";

export const DELIVERY_PENDING_MESSAGE =
  "عملیات حذف دمو نیمه‌کاره مانده است. داده‌ها دست‌نخورده حفظ شده‌اند؛ می‌توانید عملیات را با خیال راحت دوباره اجرا کنید.";

/**
 * Service-level gate: throws `DemoDisabledError` unless the deployment is in
 * `demo_active`. Call this at the TOP of every operation that could install,
 * restore, re-seed or re-create demo data — never only in the UI.
 */
export function assertDemoOperationAllowed(operation: string): void {
  if (!isDemoCapabilityAvailable()) throw new DemoDisabledError(operation);
}

/** Whether an operation may mutate persisted data at all right now.
 *
 *  `removing` blocks EVERY destructive operation (recovery must observe a
 *  stable dataset); `delivered`/`locked` keep customer-data operations
 *  available while demo-installing ones stay rejected by
 *  `assertDemoOperationAllowed`. */
export function isDestructiveOperationAllowed(): boolean {
  return readDeliveryState() !== "removing";
}

function safeGet(key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    /* storage unreadable: treat as absent for reads of OUR keys — the demo
       gates elsewhere fail closed on their own probes. */
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* storage unavailable: the state simply cannot be persisted this session */
  }
}

function safeRemove(key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* best-effort cleanup of our own marker */
  }
}
