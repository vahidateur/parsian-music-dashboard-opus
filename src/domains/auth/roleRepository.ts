/**
 * Role administration — the access matrix an academy edits itself.
 *
 * WHY A REPOSITORY
 *
 * `rolePermissions` in `./permissions` is the shipped default: a sane starting
 * matrix compiled into the bundle. An academy that cannot change it cannot adapt
 * the panel to how it actually works — a head of department who needs financial
 * read access, a receptionist who must not see invoices. So the matrix is data:
 * one row per role, persisted with the dataset, read and written here.
 *
 * The default table stays the fallback. A role with no stored row (or one stored
 * before editing existed) resolves to `rolePermissions`, and "reset to default"
 * is literally deleting the override — nothing has to be back-filled.
 *
 * FRONTEND RBAC IS UX ONLY. Editing this matrix changes what the panel shows and
 * enables. The server must enforce the same matrix on every endpoint, or the
 * edit is decorative (docs/security.md).
 */
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import type { ApiClient } from "@/api/client";
import { demoStore, type DemoStore } from "@/services/demoStore";
import {
  isPermission,
  isRoleId,
  permissionsForRole,
  roleLabels,
  ROLES,
  rolePermissions,
  type Permission,
  type RoleId,
  type RolePolicyRecord,
} from "./permissions";

/** The scope line each role ships with; an edit replaces it per role. */
const DEFAULT_SCOPES: Record<RoleId, string> = {
  administrator: "دسترسی کامل به همهٔ بخش‌ها",
  manager: "مدیریت آموزشی، برنامه‌ریزی و گزارش‌ها",
  teacher: "کلاس‌های خود، حضور و غیاب، کتابخانه",
  staff: "هنرجویان، برنامه‌ریزی، پیام‌ها",
  accountant: "فاکتورها، پرداخت‌ها، گزارش مالی",
};

export interface UpdateRoleInput {
  label?: string;
  scope?: string;
  permissions?: Permission[];
}

export interface RoleRepository {
  /** Every role, with its current access — edited values or shipped defaults. */
  list(signal?: AbortSignal): Promise<Page<RolePolicyRecord>>;
  get(id: RoleId, signal?: AbortSignal): Promise<RolePolicyRecord>;
  update(id: RoleId, input: UpdateRoleInput): Promise<RolePolicyRecord>;
  /** Returns the role to the matrix the product ships with. */
  reset(id: RoleId): Promise<RolePolicyRecord>;
}

/** The record a role has when nothing has been edited. */
export function defaultRoleRecord(id: RoleId): RolePolicyRecord {
  return {
    id,
    label: roleLabels[id],
    scope: DEFAULT_SCOPES[id],
    permissions: [...(rolePermissions[id] ?? [])],
    customized: false,
  };
}

function sameAsDefault(id: RoleId, record: RolePolicyRecord): boolean {
  const base = rolePermissions[id] ?? [];
  return (
    record.label === roleLabels[id] &&
    record.scope === DEFAULT_SCOPES[id] &&
    record.permissions.length === base.length &&
    record.permissions.every((p) => base.includes(p))
  );
}

function validate(id: string, input: UpdateRoleInput): void {
  const fields: Record<string, string[]> = {};
  if (!isRoleId(id)) fields.id = ["نقش نامعتبر است."];
  if (input.label !== undefined && input.label.trim().length < 2) fields.label = ["نام نقش باید حداقل ۲ نویسه باشد."];
  if (input.permissions !== undefined) {
    const unknown = input.permissions.filter((p) => !isPermission(p));
    if (unknown.length > 0) fields.permissions = [`دسترسی نامعتبر: ${unknown.join(", ")}`];
    /*
      The one lockout the panel refuses to write: an administrator role without
      `roles.write` cannot be edited back, and nobody else may edit it either.
      Every other reduction is a legitimate choice, including removing an
      administrator's access to finance.
    */
    if (id === "administrator" && !input.permissions.includes("roles.write")) {
      fields.permissions = ["نقش مدیر ارشد باید دسترسی «مدیریت نقش‌ها» را نگه دارد، وگرنه راه بازگشتی به این صفحه نمی‌ماند."];
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError({ kind: "validation", code: "ROLE_INVALID", message: "تغییرات نقش معتبر نیست.", fields });
  }
}

/** Demo implementation — the roles collection of the one dataset. */
export class DemoRoleRepository implements RoleRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(): Promise<Page<RolePolicyRecord>> {
    const data = ROLES.map((id) => this.record(id));
    return { data, meta: { page: 1, per_page: data.length, total: data.length } };
  }

  async get(id: RoleId): Promise<RolePolicyRecord> {
    if (!isRoleId(id)) throw notFound(id);
    return this.record(id);
  }

  async update(id: RoleId, input: UpdateRoleInput): Promise<RolePolicyRecord> {
    validate(id, input);
    const current = this.record(id);
    const next: RolePolicyRecord = {
      id,
      label: (input.label ?? current.label).trim(),
      scope: (input.scope ?? current.scope).trim(),
      permissions: input.permissions ? [...input.permissions] : current.permissions,
      customized: true,
      updatedAt: new Date().toISOString(),
    };
    next.customized = !sameAsDefault(id, next);
    this.write(next);
    return next;
  }

  async reset(id: RoleId): Promise<RolePolicyRecord> {
    if (!isRoleId(id)) throw notFound(id);
    const fresh = defaultRoleRecord(id);
    this.write(fresh);
    return fresh;
  }

  /** One row per role, edited values where they exist, defaults elsewhere. */
  private record(id: RoleId): RolePolicyRecord {
    const row = this.store.roles.find(id);
    if (!row) return defaultRoleRecord(id);
    const permissions = (row.permissions ?? permissionsForRole(id)).filter(isPermission);
    const record: RolePolicyRecord = {
      id,
      label: row.label?.trim() ? row.label : roleLabels[id],
      scope: row.scope?.trim() ? row.scope : DEFAULT_SCOPES[id],
      permissions,
      customized: Boolean(row.permissions) || row.label !== roleLabels[id] || row.scope !== DEFAULT_SCOPES[id],
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
    };
    record.customized = !sameAsDefault(id, record);
    return record;
  }

  private write(record: RolePolicyRecord): void {
    const existing = this.store.roles.find(record.id);
    if (existing) {
      this.store.roles.update(record.id, {
        label: record.label,
        scope: record.scope,
        permissions: record.customized ? record.permissions : undefined,
        updatedAt: record.updatedAt,
      });
      return;
    }
    this.store.roles.create({
      id: record.id,
      label: record.label,
      scope: record.scope,
      ...(record.customized ? { permissions: record.permissions } : {}),
      ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
    });
  }
}

/** REST implementation. BACKEND REQUIRED — the server owns authorization. */
export class ApiRoleRepository implements RoleRepository {
  constructor(private readonly client: ApiClient) {}

  list(signal?: AbortSignal): Promise<Page<RolePolicyRecord>> {
    return this.client.getPage<RolePolicyRecord>("roles", { signal });
  }

  get(id: RoleId, signal?: AbortSignal): Promise<RolePolicyRecord> {
    return this.client.get<RolePolicyRecord>(`roles/${encodeURIComponent(id)}`, { signal });
  }

  /*
    `async`, not merely Promise-returning: `validate` throws synchronously, and a
    synchronous throw out of a function whose type says `Promise<…>` escapes
    `await`-free callers — `.catch()` on it is a TypeError, and a form that
    guards with `.then/.catch` sees a crash instead of a field error. Declaring
    the method `async` turns the same throw into the rejection the contract
    promises.
  */
  async update(id: RoleId, input: UpdateRoleInput): Promise<RolePolicyRecord> {
    validate(id, input);
    return this.client.patch<RolePolicyRecord>(`roles/${encodeURIComponent(id)}`, input);
  }

  reset(id: RoleId): Promise<RolePolicyRecord> {
    return this.client.post<RolePolicyRecord>(`roles/${encodeURIComponent(id)}/reset`);
  }
}

function notFound(id: string): ApiError {
  return new ApiError({ kind: "not_found", code: "ROLE_NOT_FOUND", message: `نقش «${id}» وجود ندارد.` });
}
