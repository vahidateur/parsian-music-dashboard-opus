import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  can,
  canAccessView,
  canAll,
  canAny,
  defaultViewFor,
  isPermission,
  isRoleId,
  permissionsForRole,
  rolePermissions,
  viewPermissions,
} from "@/domains/auth/permissions";
import { viewTitles } from "@/data/academy";

const holder = (role: (typeof ROLES)[number]) => ({ permissions: permissionsForRole(role) });

describe("permission matrix", () => {
  it("administrator holds every permission", () => {
    expect(new Set(permissionsForRole("administrator"))).toEqual(new Set(PERMISSIONS));
  });

  it("only administrator may manage users, roles and demo data", () => {
    for (const role of ROLES) {
      const privileged = ["users.write", "roles.write", "demo.manage"] as const;
      const expected = role === "administrator";
      for (const p of privileged) expect(can(holder(role), p)).toBe(expected);
    }
  });

  it("teacher cannot read or write finance", () => {
    expect(can(holder("teacher"), "finance.read")).toBe(false);
    expect(can(holder("teacher"), "finance.write")).toBe(false);
  });

  it("accountant can write finance but not attendance", () => {
    expect(can(holder("accountant"), "finance.write")).toBe(true);
    expect(can(holder("accountant"), "attendance.write")).toBe(false);
  });

  it("write access always implies the matching read access", () => {
    for (const role of ROLES) {
      for (const permission of permissionsForRole(role)) {
        if (!permission.endsWith(".write")) continue;
        const read = permission.replace(/\.write$/, ".read");
        if (!isPermission(read)) continue;
        expect(can(holder(role), read)).toBe(true);
      }
    }
  });

  it("every declared permission is reachable by at least one role", () => {
    const granted = new Set(ROLES.flatMap((r) => permissionsForRole(r)));
    for (const p of PERMISSIONS) expect(granted.has(p)).toBe(true);
  });

  it("no role references an unknown permission", () => {
    for (const role of ROLES) {
      for (const p of rolePermissions[role]) expect(isPermission(p)).toBe(true);
    }
  });

  it("canAny / canAll behave correctly", () => {
    const teacher = holder("teacher");
    expect(canAny(teacher, ["finance.read", "attendance.read"])).toBe(true);
    expect(canAll(teacher, ["finance.read", "attendance.read"])).toBe(false);
    expect(canAll(teacher, ["attendance.read", "attendance.write"])).toBe(true);
  });

  it("guards against a null holder", () => {
    expect(can(null, "students.read")).toBe(false);
    expect(canAny(undefined, ["students.read"])).toBe(false);
  });

  it("every view has a declared permission", () => {
    for (const view of Object.keys(viewTitles)) {
      expect(viewPermissions[view as keyof typeof viewPermissions]).toBeDefined();
    }
  });

  it("view access follows the matrix", () => {
    expect(canAccessView(holder("teacher"), "finance")).toBe(false);
    expect(canAccessView(holder("accountant"), "finance")).toBe(true);
    expect(canAccessView(holder("administrator"), "settings")).toBe(true);
    expect(canAccessView(holder("teacher"), "settings")).toBe(false);
  });

  it("defaultViewFor returns a view the holder may actually open", () => {
    for (const role of ROLES) {
      const view = defaultViewFor(holder(role));
      expect(canAccessView(holder(role), view)).toBe(true);
    }
  });

  it("role/permission type guards reject unknown values", () => {
    expect(isRoleId("administrator")).toBe(true);
    expect(isRoleId("root")).toBe(false);
    expect(isPermission("students.read")).toBe(true);
    expect(isPermission("students.destroy")).toBe(false);
  });
});
