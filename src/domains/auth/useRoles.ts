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
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getRoleRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import {
  getRolePolicyVersion,
  setRolePolicies,
  subscribeRolePolicy,
  type Permission,
  type RoleId,
  type RolePolicyRecord,
} from "./permissions";
import type { UpdateRoleInput } from "./roleRepository";

/** Re-renders the caller whenever the live policy changes. */
export function useRolePolicyVersion(): number {
  return useSyncExternalStore(subscribeRolePolicy, getRolePolicyVersion, getRolePolicyVersion);
}

/**
 * Keeps the policy cache in step with the repository.
 *
 * Refreshes on every persisted write (`dataVersion`), so an administrator who
 * edits a role sees the panel change under their own session without signing out
 * and back in — which is the point of the feature.
 *
 * A failed read leaves the previous projection in place rather than clearing it:
 * silently dropping everybody to the shipped defaults would revoke access an
 * academy granted, and a stale matrix is the smaller wrong.
 */
export function useRolePolicySync(): void {
  const dataVersion = useDataVersion();

  useEffect(() => {
    const controller = new AbortController();
    getRoleRepository()
      .list(controller.signal)
      .then((page) => setRolePolicies(page.data))
      .catch(() => {
        /* keep the previous projection; the panel says so where roles are shown */
      });
    return () => controller.abort();
  }, [dataVersion]);
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
  useRolePolicyVersion();
  const [roles, setRoles] = useState<RolePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getRoleRepository()
      .list(controller.signal)
      .then((page) => {
        setRoles(page.data);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const update = useCallback(async (id: RoleId, input: UpdateRoleInput): Promise<ApiError | null> => {
    setSaving(true);
    try {
      const saved = await getRoleRepository().update(id, input);
      setRoles((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
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
      return null;
    } catch (cause) {
      return apiErrorFromThrown(cause);
    } finally {
      setSaving(false);
    }
  }, []);

  return useMemo(
    () => ({ roles, loading, error, reload, saving, update, reset }),
    [roles, loading, error, reload, saving, update, reset],
  );
}

/** Permission ids grouped for the editor, so 23 checkboxes are not one wall. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "هنرجویان و مدرسین", permissions: ["students.read", "students.write", "teachers.read", "teachers.write"] },
  { label: "کلاس‌ها و زمان‌بندی", permissions: ["classes.read", "classes.write", "schedule.read", "schedule.write"] },
  { label: "حضور و غیاب", permissions: ["attendance.read", "attendance.write"] },
  { label: "مالی و گزارش", permissions: ["finance.read", "finance.write", "reports.read"] },
  { label: "ارتباط و منابع", permissions: ["messages.read", "messages.write", "library.read", "library.write"] },
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
  "finance.write": "ثبت مالی",
  "messages.read": "مشاهدهٔ پیام‌ها",
  "messages.write": "ارسال پیام",
  "library.read": "مشاهدهٔ کتابخانه",
  "library.write": "مدیریت کتابخانه",
  "reports.read": "مشاهدهٔ گزارش‌ها",
  "settings.read": "مشاهدهٔ تنظیمات",
  "settings.write": "ویرایش تنظیمات",
  "users.read": "مشاهدهٔ کاربران",
  "users.write": "مدیریت کاربران",
  "roles.write": "مدیریت نقش‌ها و دسترسی‌ها",
  "demo.manage": "مدیریت دادهٔ نمایشی",
};
