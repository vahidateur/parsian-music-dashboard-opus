/**
 * Demo implementation of the role matrix — DEMO DATA, isolated on purpose.
 *
 * Moved verbatim out of `./roleRepository` so the SHARED file (the interface,
 * the shipped defaults and the REST implementation) no longer imports the demo
 * store — the same bundle-boundary reason as `./localUserRepository`: a
 * co-located demo class with a module-scope store singleton dragged the whole
 * demo persistence graph into the CLIENT build.
 *
 * The helpers it shares with the REST implementation (`validate`,
 * `sameAsDefault`, `notFound`, `DEFAULT_SCOPES`) stay single copies in
 * `./roleRepository` and are imported from there.
 */
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { Page } from "@/api/types";
import {
  isPermission,
  isRoleId,
  permissionsForRole,
  roleLabels,
  ROLES,
  type RoleId,
  type RolePolicyRecord,
} from "./permissions";
import {
  DEFAULT_SCOPES,
  defaultRoleRecord,
  notFound,
  sameAsDefault,
  validate,
  type RoleRepository,
  type UpdateRoleInput,
} from "./roleRepository";

/** Demo implementation — the roles collection of the one dataset. */
export class LocalRoleRepository implements RoleRepository {
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
