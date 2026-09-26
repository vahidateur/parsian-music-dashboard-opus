/**
 * Central permission model.
 *
 * FRONTEND RBAC IS UX ONLY. It decides what a user is *shown* and which
 * controls are enabled. It is not a security boundary: anything reachable from
 * the browser can be bypassed by the user. Real authorization MUST be enforced
 * server-side on every endpoint (see docs/architecture/security.md).
 */

/** Permission ids are `<domain>.<action>` — matching the planned API contract. */
export const PERMISSIONS = [
  "students.read",
  "students.write",
  "teachers.read",
  "teachers.write",
  "classes.read",
  "classes.write",
  "schedule.read",
  "schedule.write",
  "attendance.read",
  "attendance.write",
  "finance.read",
  "finance.write",
  "messages.read",
  "messages.write",
  "library.read",
  "library.write",
  "reports.read",
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
  "roles.write",
  "demo.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Roles mirror the academy's existing access roles in `src/data/records.ts`. */
export const ROLES = ["administrator", "manager", "teacher", "staff", "accountant"] as const;
export type RoleId = (typeof ROLES)[number];

export const roleLabels: Record<RoleId, string> = {
  administrator: "مدیر ارشد",
  manager: "مدیر آموزشگاه",
  teacher: "مدرس",
  staff: "پذیرش",
  accountant: "مالی",
};

const READ_ONLY_CORE: Permission[] = [
  "students.read",
  "teachers.read",
  "classes.read",
  "schedule.read",
  "library.read",
];

/**
 * Role → permission matrix. This is the single source of truth; no component
 * may test a role id directly.
 */
export const rolePermissions: Record<RoleId, readonly Permission[]> = {
  administrator: [...PERMISSIONS],
  manager: [
    ...READ_ONLY_CORE,
    "students.write",
    "teachers.write",
    "classes.write",
    "schedule.write",
    "attendance.read",
    "attendance.write",
    "finance.read",
    "messages.read",
    "messages.write",
    "library.write",
    "reports.read",
    "settings.read",
    "users.read",
  ],
  teacher: [
    ...READ_ONLY_CORE,
    "attendance.read",
    "attendance.write",
    "messages.read",
    "messages.write",
  ],
  staff: [
    ...READ_ONLY_CORE,
    "students.write",
    "schedule.write",
    "attendance.read",
    "messages.read",
    "messages.write",
    "reports.read",
  ],
  accountant: [
    "students.read",
    "classes.read",
    "finance.read",
    "finance.write",
    "reports.read",
    "messages.read",
  ],
};

/* ------------------------------------------------------------------ */
/* Live role policy — what an administrator edited in Settings          */
/* ------------------------------------------------------------------ */

/**
 * One role as the academy currently defines it.
 *
 * `rolePermissions` and `roleLabels` above are the SHIPPED DEFAULTS: they are
 * what a role means before anyone edits it, and they stay the answer whenever no
 * policy record exists. A policy record is what an administrator saved — the
 * same shape, persisted with the dataset (`DemoRole`), and read back through
 * `RoleRepository`.
 */
export interface RolePolicyRecord {
  id: RoleId;
  label: string;
  scope: string;
  permissions: Permission[];
  /** True when this record differs from the shipped default for the role. */
  customized: boolean;
  /** ISO-8601 of the last edit, when the record carries one. */
  updatedAt?: string;
}

let policy = new Map<RoleId, RolePolicyRecord>();
let policyVersion = 0;
const policyListeners = new Set<() => void>();

function emitPolicy(): void {
  policyVersion += 1;
  policyListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one broken subscriber must not stop the rest */
    }
  });
}

/**
 * Replaces the live policy with the records a repository answered.
 *
 * Called by `useRolePolicySync` (mounted once in the shell) after each read, the
 * same read-through projection the instrument catalogue uses: the repository
 * stays the only writer, and the cache holds nothing that cannot be rebuilt by
 * reading it again. An empty list clears the policy, so a failed or empty read
 * falls back to the shipped defaults instead of locking everybody out.
 */
export function setRolePolicies(records: readonly RolePolicyRecord[]): void {
  const next = new Map<RoleId, RolePolicyRecord>();
  for (const record of records) {
    if (isRoleId(record.id)) next.set(record.id, record);
  }
  const same =
    next.size === policy.size &&
    [...next.entries()].every(([id, record]) => {
      const previous = policy.get(id);
      return (
        previous !== undefined &&
        previous.label === record.label &&
        previous.scope === record.scope &&
        previous.customized === record.customized &&
        previous.updatedAt === record.updatedAt &&
        previous.permissions.length === record.permissions.length &&
        previous.permissions.every((p, i) => p === record.permissions[i])
      );
    });
  if (same) return;
  policy = next;
  emitPolicy();
}

/**
 * Clears the projection at an authentication boundary.
 *
 * Role policy is shared by the shell, but it is not a session credential. Keeping
 * a previous user's edited role matrix while a new session is being restored can
 * transiently grant or revoke the wrong controls. The next role-policy read may
 * repopulate it; until then AuthContext uses the current session's issued set.
 */
export function clearRolePolicies(): void {
  if (policy.size === 0) return;
  policy = new Map<RoleId, RolePolicyRecord>();
  emitPolicy();
}

/** The edited record for a role, or undefined when it runs on defaults. */
export function getRolePolicy(role: RoleId): RolePolicyRecord | undefined {
  return policy.get(role);
}

/** Bumped on every policy change — the identity `useSyncExternalStore` watches. */
export function getRolePolicyVersion(): number {
  return policyVersion;
}

export function subscribeRolePolicy(listener: () => void): () => void {
  policyListeners.add(listener);
  return () => {
    policyListeners.delete(listener);
  };
}

/**
 * The display name of a role: the academy's own if it renamed one, the shipped
 * label otherwise. Read this instead of `roleLabels` wherever a role is shown to
 * a person — `roleLabels` is the default table, not the current answer.
 */
export function roleLabel(role: RoleId): string {
  return policy.get(role)?.label ?? roleLabels[role] ?? String(role);
}

/**
 * Role → permissions, honouring an administrator's edits.
 *
 * This is the single resolution point: the demo session builder, the API session
 * normalizer and the live session in `AuthContext` all ask here, so a permission
 * added in Settings takes effect everywhere at once instead of in whichever
 * surface happened to re-read the matrix.
 */
export function permissionsForRole(role: RoleId): Permission[] {
  const edited = policy.get(role);
  if (edited) return [...edited.permissions];
  return [...(rolePermissions[role] ?? [])];
}

export function isRoleId(value: string): value is RoleId {
  return (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Policy helpers                                                      */
/* ------------------------------------------------------------------ */

export interface PermissionHolder {
  permissions: readonly Permission[];
}

export function can(holder: PermissionHolder | null | undefined, permission: Permission): boolean {
  return (holder?.permissions as readonly Permission[] | undefined)?.includes(permission) ?? false;
}

export function canAny(holder: PermissionHolder | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(holder, p));
}

export function canAll(holder: PermissionHolder | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(holder, p));
}

/* ------------------------------------------------------------------ */
/* View access policy                                                  */
/* ------------------------------------------------------------------ */

import type { ViewId } from "@/lib/viewContracts";

/** Minimum permission required to open each view. */
export const viewPermissions: Record<ViewId, Permission> = {
  dashboard: "students.read",
  students: "students.read",
  teachers: "teachers.read",
  classes: "classes.read",
  schedule: "schedule.read",
  attendance: "attendance.read",
  // Compensation reads the schedule and writes sessions through scheduling's own
  // verbs, so it borrows scheduling's permission pair rather than inventing one.
  compensation: "schedule.read",
  finance: "finance.read",
  reports: "reports.read",
  messages: "messages.read",
  library: "library.read",
  // The gallery shows the library's media; managing it stays library.write in Settings.
  gallery: "library.read",
  settings: "settings.read",
  "design-system": "settings.read",
};

export function canAccessView(holder: PermissionHolder | null | undefined, view: ViewId): boolean {
  return can(holder, viewPermissions[view]);
}

/** First view the given holder is allowed to open — used after login. */
export function defaultViewFor(holder: PermissionHolder | null | undefined): ViewId {
  const order: ViewId[] = ["dashboard", "students", "schedule", "attendance", "finance", "messages", "library", "settings"];
  return order.find((v) => canAccessView(holder, v)) ?? "dashboard";
}
