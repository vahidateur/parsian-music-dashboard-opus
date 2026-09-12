/**
 * Data lifecycle — the ONE boundary that decides what kind of environment this is.
 *
 * ```
 *                 UNINITIALIZED
 *                       │  explicit first-run choice (or explicit operation)
 *            ┌──────────┴──────────┐
 *            ▼                     ▼
 *          EMPTY                 DEMO
 *   real/customer data     showcase/QA dataset
 * ```
 *
 * WHY THIS MODULE EXISTS
 *
 * The product is delivered to real academies. Demo data is for development, QA
 * and showcase environments only, and it must never be inserted into a
 * customer's environment implicitly. Before this, `DemoStore.snapshot()` seeded
 * the canonical demo dataset the first time anything read it — so *every*
 * browser that opened the app became a demo environment without being asked.
 *
 * THE RULES ENCODED HERE
 *
 * 1. The mode is an explicit, persisted FACT (`ava:demo:lifecycle`), never
 *    inferred from row counts. An EMPTY academy with zero students is still
 *    EMPTY; a DEMO dataset emptied during testing is still DEMO.
 * 2. Reading never decides anything. `readLifecycleState` is a pure read; the
 *    only write it can be paired with is `persistLifecycleAdoption`, which
 *    records a marker for a payload that predates this module and touches no
 *    record.
 * 3. Initialization is refused once an environment exists. Choosing DEMO can
 *    never overwrite a customer's dataset, and choosing EMPTY can never erase
 *    one; replacing data requires the explicit, confirm-gated operations
 *    (`demoDataManager.resetToSeed` / `clear` / `restoreBackup`) or
 *    `uninitializeEnvironment`.
 * 4. Demo-only side effects are gated on this state — see
 *    `isDemoEnvironment()`, used by the demo library file provisioning and by
 *    `DemoNote`.
 */
import { isDemoMode } from "@/api/config";
import { getBlobStore } from "@/domains/media/blobStore";
import type { AuthUser } from "@/domains/auth/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { createEmptyDataset, createSeedDataset, deriveRoles } from "./seed";
import type { DataLifecycleMode, DataLifecycleState, DemoDataset } from "./types";

/**
 * Destructive operations require an explicit, typed confirmation.
 *
 * Defined here (the module that owns explicit operations) and re-exported by
 * `demoDataManager` so its existing public surface is unchanged.
 */
export interface ConfirmedRequest {
  confirm: true;
}

/* ------------------------------------------------------------------ */
/* EMPTY environment bootstrap                                         */
/* ------------------------------------------------------------------ */

/**
 * The one account an EMPTY environment ships with, so a customer can sign in
 * and start entering their own data.
 *
 * This is ACCESS bootstrap, not academy content: `createEmptyDataset()` stays
 * empty in every collection (pinned by `seed.test.ts`), and the account is added
 * here, at environment-initialization level. Without it an EMPTY environment
 * would be a dead end — demo authentication resolves the signed-in user against
 * `users`, so zero users means nobody can ever get in to create the first
 * student. It is an `administrator` so the customer can rename it, add staff and
 * delete it from Settings → Users; it carries no credential material (demo auth
 * has none — see `auth/demoAuthRepository.ts`).
 */
const ENVIRONMENT_EPOCH = "2026-09-01T00:00:00.000Z";

export const BOOTSTRAP_ADMIN_EMAIL = "admin@academy.local";

export const BOOTSTRAP_ADMIN: AuthUser = {
  id: "usr_owner",
  name: "مدیر آموزشگاه",
  email: BOOTSTRAP_ADMIN_EMAIL,
  role: "administrator",
  status: "active",
  createdAt: ENVIRONMENT_EPOCH,
  updatedAt: ENVIRONMENT_EPOCH,
};

/**
 * A valid EMPTY environment: zero academy records, plus the access bootstrap.
 *
 * `roles` is the RBAC projection (`deriveRoles()`), not content — the same
 * category as the organization settings and branding that an empty dataset
 * already keeps, and required for the dataset to validate (`users[].role` must
 * resolve), so a customer's own backup of an EMPTY environment can be restored.
 */
export function createEmptyEnvironment(): DemoDataset {
  return {
    ...createEmptyDataset(),
    users: [{ ...BOOTSTRAP_ADMIN }],
    roles: deriveRoles(),
  };
}

/* ------------------------------------------------------------------ */
/* Reading the state                                                   */
/* ------------------------------------------------------------------ */

/**
 * The environment's lifecycle state. Pure: writes nothing.
 *
 * Resolution order:
 *  - a valid marker WITH a dataset → that mode;
 *  - a marker with NO dataset → UNINITIALIZED. Only an interrupted creation or
 *    manual tampering produces this, and re-offering the choice is the safe
 *    recovery: there is nothing to overwrite and nothing to lose.
 *  - NO marker but a dataset → **legacy adoption as DEMO** (documented below);
 *  - neither → UNINITIALIZED.
 *
 * LEGACY ADOPTION (§ migration / existing users)
 *
 * A dataset persisted before the marker existed has no lifecycle state. It is
 * adopted as DEMO, because:
 *  - every dataset any previous build could write came from `createSeedDataset()`
 *    or from the Demo Data Manager's demo-stamped operations — this store has
 *    never held anything but demo-sourced data;
 *  - adoption preserves the visitor's records: showing the first-run chooser
 *    over an existing environment would offer exactly two choices, and both of
 *    them (EMPTY / DEMO) would replace or erase what is already there;
 *  - it never converts an existing environment into EMPTY, which is the failure
 *    mode the requirement rules out.
 *
 * The decision is recorded once by `persistLifecycleAdoption`, so it is not
 * re-taken on every boot.
 */
export function readLifecycleState(store: DemoStore = demoStore): DataLifecycleState {
  const marker = store.readLifecycleMarker();
  if (marker !== null) return store.isInitialized() ? marker : "uninitialized";
  return store.isInitialized() ? "demo" : "uninitialized";
}

/**
 * Records the marker for a legacy payload, so the adopted state becomes explicit
 * and persistent. Idempotent, and non-destructive: it writes the marker key only
 * — never the dataset, never a record.
 */
export function persistLifecycleAdoption(store: DemoStore = demoStore): DataLifecycleState {
  const state = readLifecycleState(store);
  if (state !== "uninitialized" && store.readLifecycleMarker() === null) {
    store.writeLifecycleMarker(state);
  }
  return state;
}

/**
 * Whether demo-only affordances apply: the demo library file, demo notes in the
 * UI, demo media provisioning.
 *
 * False in `api` mode regardless of the marker — with a real backend there is no
 * DemoStore environment to be demo, and demo bytes must not be written into it.
 */
export function isDemoEnvironment(store: DemoStore = demoStore): boolean {
  if (!isDemoMode()) return false;
  return readLifecycleState(store) === "demo";
}

/* ------------------------------------------------------------------ */
/* Explicit operations                                                 */
/* ------------------------------------------------------------------ */

export interface LifecycleChoiceSuccess {
  ok: true;
  state: DataLifecycleMode;
  changed: true;
  message: string;
}

export interface LifecycleChoiceRefused {
  ok: false;
  /** Why nothing was written. Only one reason exists: an environment is there. */
  reason: "already-initialized";
  state: DataLifecycleState;
  changed: false;
  message: string;
}

export type LifecycleChoiceResult = LifecycleChoiceSuccess | LifecycleChoiceRefused;

function refuseExisting(store: DemoStore): LifecycleChoiceRefused {
  return {
    ok: false,
    reason: "already-initialized",
    state: readLifecycleState(store),
    changed: false,
    message:
      "این محیط از قبل ساخته شده است و دادهٔ موجود بدون عملیات صریح جایگزین یا پاک نمی‌شود.",
  };
}

/**
 * UNINITIALIZED → EMPTY: a real/customer environment with zero academy records.
 *
 * Refuses when a dataset already exists, so choosing EMPTY can never erase a
 * customer's data.
 */
export function initializeEmptyEnvironment(store: DemoStore = demoStore): LifecycleChoiceResult {
  if (store.isInitialized()) return refuseExisting(store);
  store.initializeEnvironment("empty", createEmptyEnvironment());
  return {
    ok: true,
    state: "empty",
    changed: true,
    message: "محیط با دادهٔ خالی ساخته شد؛ آمادهٔ ثبت دادهٔ واقعی آموزشگاه است.",
  };
}

/**
 * UNINITIALIZED → DEMO: the canonical showcase/QA dataset.
 *
 * This is the ONLY path that creates demo data at first run, and it runs only
 * after an explicit choice (or an explicit `demoDataManager.initialize()`).
 * Refuses when a dataset already exists, so choosing DEMO can never overwrite a
 * customer's data.
 */
export function initializeDemoEnvironment(store: DemoStore = demoStore): LifecycleChoiceResult {
  if (store.isInitialized()) return refuseExisting(store);
  store.initializeEnvironment("demo", createSeedDataset());
  return {
    ok: true,
    state: "demo",
    changed: true,
    message: "دادهٔ نمونه بارگذاری شد.",
  };
}

/**
 * Records the mode after an operation that installed demo-sourced data
 * (reset/import of the canonical seed). Kept separate from initialization so the
 * confirm-gated destructive operations in `demoDataManager` stay the only path
 * that can change an existing environment's data.
 */
export function markLifecycle(mode: DataLifecycleMode, store: DemoStore = demoStore): void {
  store.writeLifecycleMarker(mode);
}

export interface UninitializeResult {
  ok: boolean;
  state: DataLifecycleState;
  changed: boolean;
  message: string;
}

/**
 * Removes the environment entirely: dataset, lifecycle marker and stored
 * binaries. The next read reports UNINITIALIZED and the first-run choice is
 * offered again.
 *
 * Confirm-gated like every destructive operation, and distinct from `clear()`:
 * clearing removes RECORDS and keeps the environment (and its mode), while this
 * removes the environment itself.
 *
 * Binaries are removed too, so a DEMO environment's demo blob cannot survive
 * into whatever is created next. A blob store that cannot be cleared does not
 * block the operation — the dataset is already gone — but the failure is
 * reported rather than swallowed.
 */
export async function uninitializeEnvironment(
  request: ConfirmedRequest,
  store: DemoStore = demoStore,
): Promise<UninitializeResult> {
  if (!request?.confirm) {
    return {
      ok: false,
      state: readLifecycleState(store),
      changed: false,
      message: "حذف محیط بدون تأیید صریح انجام نمی‌شود.",
    };
  }

  const existed = store.isInitialized() || store.readLifecycleMarker() !== null;
  store.reset();

  let binaryNote = "";
  try {
    await getBlobStore().clear();
  } catch (cause) {
    binaryNote =
      " دادهٔ محیط حذف شد، اما پاک‌کردن فایل‌های ذخیره‌شده ناموفق بود: " +
      (cause instanceof Error ? cause.message : "خطای ناشناخته");
  }

  return {
    ok: true,
    state: "uninitialized",
    changed: existed,
    message: existed
      ? `محیط حذف شد و هیچ داده‌ای باقی نمانده است.${binaryNote}`
      : `محیطی وجود نداشت.${binaryNote}`,
  };
}
