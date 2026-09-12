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

export function permissionsForRole(role: RoleId): Permission[] {
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
  return holder?.permissions.includes(permission) ?? false;
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

import type { ViewId } from "@/data/academy";

/** Minimum permission required to open each view. */
export const viewPermissions: Record<ViewId, Permission> = {
  dashboard: "students.read",
  students: "students.read",
  teachers: "teachers.read",
  classes: "classes.read",
  schedule: "schedule.read",
  attendance: "attendance.read",
  finance: "finance.read",
  reports: "reports.read",
  messages: "messages.read",
  library: "library.read",
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
