/**
 * Role policy — the React binding for the access matrix.
 *
 * `permissionsForRole()` has to answer SYNCHRONOUSLY: a session is built during
 * login, and every gated control asks during render. The repository is async. So
 * the matrix is projected into the read-through cache in `./permissions` by
 * `useRolePolicySync()`, mounted once in the shell — exactly the seam the
 * instrument catalogue uses for the same reason, with the same rule: the
 * repository is the only writer, and the cache holds nothing that a re-read
 * cannot rebuild.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { apiErrorFromThrown, ApiError } from "@/api/errors";
import { getRoleRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import {
  beginRolePolicyRequest,
  commitRolePolicy,
  failRolePolicy,
  getRolePolicies,
  getRolePolicyState,
  getRolePolicyVersion,
  invalidateRolePolicy,
  isRolePolicyProjectionValid,
  isRolePolicyTicketCurrent,
  registerRolePolicyRefresh,
  requestRolePolicyRefresh,
  subscribeRolePolicy,
  subscribeRolePolicyState,
  type Permission,
  type RoleId,
  type RolePolicyRecord,
  type RolePolicySyncState,
  type RolePolicyTicket,
} from "./permissions";
import type { UpdateRoleInput } from "./roleRepository";

/** Re-renders the caller whenever the live policy changes. */
export function useRolePolicyVersion(): number {
  return useSyncExternalStore(subscribeRolePolicy, getRolePolicyVersion, getRolePolicyVersion);
}

/** Subscribes to the projection lifecycle (loading/fresh/stale/unavailable). */
export function useRolePolicyState(): RolePolicySyncState {
  return useSyncExternalStore(subscribeRolePolicyState, getRolePolicyState, getRolePolicyState);
}

interface SyncFlight {
  key: string;
  controller: AbortController;
  ticket: RolePolicyTicket;
  promise: Promise<void>;
}

let syncFlight: SyncFlight | null = null;

function invalidPolicyError(message: string): ApiError {
  return new ApiError({ kind: "server", code: "ROLE_POLICY_INVALID", message });
}

/**
 * One in-flight synchronization per session+data version.
 *
 * The first caller starts the read; duplicate consumers/refresh clicks share
 * that promise. A newer session/data version aborts the old controller and the
 * ticket generation rejects any response that still resolves.
 */
function syncRolePolicy(sessionKey: string, dataVersion: number): Promise<void> {
  const key = `${sessionKey}:${dataVersion}`;
  if (
    syncFlight?.key === key &&
    !syncFlight.controller.signal.aborted &&
    isRolePolicyTicketCurrent(syncFlight.ticket)
  ) {
    return syncFlight.promise;
  }
  if (syncFlight) syncFlight.controller.abort();

  const ticket = beginRolePolicyRequest(sessionKey);
  if (!ticket) return Promise.resolve();

  const controller = new AbortController();
  const flight: SyncFlight = { key, controller, ticket, promise: Promise.resolve() };
  flight.promise = getRoleRepository()
    .list(controller.signal)
    .then((page) => {
      if (!isRolePolicyProjectionValid(page.data)) {
        throw invalidPolicyError("قواعد دسترسی نقش‌ها معتبر نیست.");
      }
      commitRolePolicy(ticket, page.data);
    })
    .catch((cause: unknown) => {
      const normalized = apiErrorFromThrown(cause);
      // A superseded/aborted request is the newer request's problem. A
      // cancellation that is still the latest (a custom repository aborted on
      // its own) must settle the lifecycle instead of leaving it refreshing.
      if (normalized.kind === "cancelled" && !isRolePolicyTicketCurrent(ticket)) return;
      failRolePolicy(ticket, normalized);
    })
    .finally(() => {
      if (syncFlight === flight) syncFlight = null;
    });

  syncFlight = flight;
  return flight.promise;
}

/**
 * The single global synchronization owner.
 *
 * `sessionKey` is the authenticated session token. The hook subscribes to the
 * central lifecycle and exposes a refresh callback used by the shell banner.
 * `useRoles` is a panel-local read and never publishes this projection.
 */
export function useRolePolicySync(sessionKey?: string | null): {
  state: RolePolicySyncState;
  refresh: () => void;
} {
  const dataVersion = useDataVersion();
  const state = useRolePolicyState();
  const key = sessionKey === undefined ? state.sessionKey : sessionKey;

  const refresh = useCallback(() => {
    if (key) void syncRolePolicy(key, dataVersion);
  }, [key, dataVersion]);

  useEffect(() => {
    if (key) void syncRolePolicy(key, dataVersion);
  }, [key, dataVersion]);

  useEffect(() => registerRolePolicyRefresh(refresh), [refresh]);

  return { state, refresh };
}

export interface RolesState {
  roles: RolePolicyRecord[];
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  saving: boolean;
  update: (id: RoleId, input: UpdateRoleInput) => Promise<ApiError | null>;
  reset: (id: RoleId) => Promise<ApiError | null>;
}

/** The Settings surface's own read + writes over the role matrix. */
export function useRoles(): RolesState {
  const dataVersion = useDataVersion();
  const policyState = useRolePolicyState();
  useRolePolicyVersion();
  const globalRoles = getRolePolicies();
  const [roles, setRoles] = useState<RolePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    getRoleRepository()
      .list(controller.signal)
      .then((page) => {
        if (ticket !== latest.current) return;
        setRoles(page.data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (ticket !== latest.current) return;
        const normalized = apiErrorFromThrown(cause);
        if (normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [nonce, dataVersion]);

  const reload = useCallback(() => {
    setNonce((n) => n + 1);
    requestRolePolicyRefresh();
  }, []);

  const update = useCallback(async (id: RoleId, input: UpdateRoleInput): Promise<ApiError | null> => {
    setSaving(true);
    try {
      const saved = await getRoleRepository().update(id, input);
      setRoles((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      // A mutation invalidates the projection until the authoritative re-read
      // succeeds; it never publishes the partial write as a fresh matrix.
      invalidateRolePolicy();
      requestRolePolicyRefresh();
      return null;
    } catch (cause) {
      return apiErrorFromThrown(cause);
    } finally {
      setSaving(false);
    }
  }, []);

  const reset = useCallback(async (id: RoleId): Promise<ApiError | null> => {
    setSaving(true);
    try {
      const saved = await getRoleRepository().reset(id);
      setRoles((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      invalidateRolePolicy();
      requestRolePolicyRefresh();
      return null;
    } catch (cause) {
      return apiErrorFromThrown(cause);
    } finally {
      setSaving(false);
    }
  }, []);

  /*
   * Once the global projection is usable, the panel reads it instead of
   * maintaining a second, potentially contradictory copy. The local read is
   * only a fallback for the first frame / when the global projection is
   * loading or unavailable; it never writes the projection.
   */
  const useGlobal =
    (policyState.status === "fresh" || policyState.status === "stale") && globalRoles.length > 0;
  const effectiveRoles = useGlobal ? globalRoles : roles;
  const effectiveLoading = useGlobal ? false : loading;
  const effectiveError = useGlobal ? null : error;

  return useMemo(
    () => ({
      roles: effectiveRoles,
      loading: effectiveLoading,
      error: effectiveError,
      reload,
      saving,
      update,
      reset,
    }),
    [effectiveRoles, effectiveLoading, effectiveError, reload, saving, update, reset],
  );
}

/** Permission ids grouped for the editor, so the whole matrix is not one wall. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "هنرجویان و مدرسین", permissions: ["students.read", "students.write", "teachers.read", "teachers.write"] },
  { label: "کلاس‌ها و زمان‌بندی", permissions: ["classes.read", "classes.write", "schedule.read", "schedule.write"] },
  { label: "حضور و غیاب", permissions: ["attendance.read", "attendance.write"] },
  { label: "پیشرفت هنرجو", permissions: ["progress.read", "progress.write"] },
  { label: "مالی و گزارش", permissions: ["finance.read", "finance.write", "finance.pay", "reports.read"] },
  { label: "ارتباط و منابع", permissions: ["messages.read", "messages.write", "library.read", "library.write"] },
  { label: "سازها", permissions: ["instruments.read", "instruments.write"] },
  { label: "مسیر یادگیری", permissions: ["learning.read", "learning.write"] },
  { label: "اتاق‌ها", permissions: ["rooms.read", "rooms.write"] },
  { label: "گالری", permissions: ["gallery.read", "gallery.write", "gallery.details"] },
  { label: "هویت آموزشگاه", permissions: ["branding.read", "branding.write"] },
  { label: "سامانه", permissions: ["settings.read", "settings.write", "users.read", "users.write", "roles.write", "demo.manage"] },
];

/** Persian name of one permission, for the matrix editor. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "students.read": "مشاهدهٔ هنرجویان",
  "students.write": "ویرایش هنرجویان",
  "teachers.read": "مشاهدهٔ مدرسین",
  "teachers.write": "ویرایش مدرسین",
  "classes.read": "مشاهدهٔ کلاس‌ها",
  "classes.write": "ویرایش کلاس‌ها",
  "schedule.read": "مشاهدهٔ برنامه",
  "schedule.write": "ویرایش برنامه",
  "attendance.read": "مشاهدهٔ حضور و غیاب",
  "attendance.write": "ثبت حضور و غیاب",
  "finance.read": "مشاهدهٔ مالی",
  "finance.write": "صدور فاکتور",
  "finance.pay": "ثبت پرداخت",
  "messages.read": "مشاهدهٔ پیام‌ها",
  "messages.write": "ارسال پیام",
  "library.read": "مشاهدهٔ کتابخانه",
  "library.write": "مدیریت کتابخانه",
  "progress.read": "مشاهدهٔ پیشرفت هنرجو",
  "progress.write": "ثبت و تخصیص پیشرفت",
  "instruments.read": "مشاهدهٔ سازها",
  "instruments.write": "مدیریت سازها",
  "learning.read": "مشاهدهٔ مسیر یادگیری",
  "learning.write": "مدیریت مسیر یادگیری",
  "rooms.read": "مشاهدهٔ اتاق‌ها",
  "rooms.write": "مدیریت اتاق‌ها",
  "gallery.read": "مشاهدهٔ گالری",
  "gallery.write": "مدیریت گالری",
  "gallery.details": "مشاهدهٔ شناسنامهٔ تصویر",
  "branding.read": "مشاهدهٔ هویت آموزشگاه",
  "branding.write": "مدیریت هویت آموزشگاه",
  "reports.read": "مشاهدهٔ گزارش‌ها",
  "settings.read": "مشاهدهٔ تنظیمات",
  "settings.write": "ویرایش تنظیمات",
  "users.read": "مشاهدهٔ کاربران",
  "users.write": "مدیریت کاربران",
  "roles.write": "مدیریت نقش‌ها و دسترسی‌ها",
  "demo.manage": "مدیریت دادهٔ نمایشی",
};
