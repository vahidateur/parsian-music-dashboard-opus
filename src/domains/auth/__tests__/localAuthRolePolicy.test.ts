/**
 * Demo/Local session permissions come from the local role store, not from the
 * module-scoped UI projection.
 *
 * The projection exists so synchronous gates can answer during render. The local
 * session builder must not use it: a stale projection from a previous session
 * must not become the next session's permissions, and a missing/invalid local
 * policy must fail explicitly rather than falling back to a broad default.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalRoleRepository } from "@/domains/auth/localRoleRepository";
import {
  clearRolePolicies,
  rolePermissions,
  setRolePolicies,
  type Permission,
  type RoleId,
  type RolePolicyRecord,
} from "@/domains/auth/permissions";
import { defaultRoleRecord, type RoleRepository } from "@/domains/auth/roleRepository";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

const TEACHER = "teacher1@demo.local";

function ctx() {
  const store = new DemoStoreImpl(memoryStorage());
  new DemoDataManager(store).initialize();
  const storage = memoryStorage();
  const auth = new LocalAuthRepository(store, storage);
  return { store, storage, auth, roles: new LocalRoleRepository(store) };
}

function staleTeacher(): RolePolicyRecord {
  return {
    ...defaultRoleRecord("teacher"),
    permissions: ["library.write"],
    customized: true,
  };
}

function failingRoles(): RoleRepository {
  return {
    list: async () => ({ data: [], meta: { page: 1, per_page: 0, total: 0 } }),
    get: async () => {
      throw new Error("local role store unavailable");
    },
    update: async () => {
      throw new Error("not used");
    },
    reset: async () => {
      throw new Error("not used");
    },
  } as unknown as RoleRepository;
}

beforeEach(() => {
  setRolePolicies([]);
});

afterEach(() => {
  clearRolePolicies();
});

describe("LocalAuthRepository — role policy source of truth", () => {
  it("does not let a stale module projection influence a new session", async () => {
    const c = ctx();
    setRolePolicies([staleTeacher()]);

    const session = await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });

    expect(session.permissions).toEqual([...rolePermissions.teacher]);
    expect(session.permissions).not.toContain("library.write");
  });

  it("reflects a custom local role revocation in the next session", async () => {
    const c = ctx();
    const revoked = rolePermissions.teacher.filter((permission) => permission !== "library.read");
    await c.roles.update("teacher", { permissions: revoked });

    const session = await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });

    expect(session.permissions).not.toContain("library.read");
    expect(session.permissions).toEqual(revoked);
  });

  it("reflects a custom local role grant in the next session", async () => {
    const c = ctx();
    const granted = [...rolePermissions.teacher, "finance.read" as Permission];
    await c.roles.update("teacher", { permissions: granted });

    const session = await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });

    expect(session.permissions).toContain("finance.read");
    expect(session.permissions).toEqual(granted);
  });

  it("uses shipped defaults for a built-in role with no explicit override", async () => {
    const c = ctx();

    const session = await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });

    expect(session.permissions).toEqual([...rolePermissions.teacher]);
  });

  it("does not give a built-in default to an unknown role", async () => {
    const c = ctx();
    const teacher = c.store.users.all().find((user) => user.email === TEACHER)!;
    c.store.users.update(teacher.id, { role: "ghost" as never });

    const error = (await c.auth
      .login({ email: TEACHER, password: DEMO_PASSPHRASE })
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("ROLE_POLICY_INVALID");
  });

  it("rejects an explicit local policy containing an unknown permission", async () => {
    const c = ctx();
    c.store.roles.update("teacher", {
      permissions: ["students.read", "not.a.permission" as never],
    });

    const error = (await c.auth
      .login({ email: TEACHER, password: DEMO_PASSPHRASE })
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("ROLE_POLICY_INVALID");
  });

  it("does not silently use defaults when the local role read fails", async () => {
    const c = ctx();
    const auth = new LocalAuthRepository(
      c.store,
      c.storage,
      () => Date.now(),
      undefined,
      failingRoles(),
    );

    const error = (await auth
      .login({ email: TEACHER, password: DEMO_PASSPHRASE })
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("ROLE_POLICY_UNAVAILABLE");
    expect(error.code).not.toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("rebuilds restoration permissions from the current local role store", async () => {
    const c = ctx();
    await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });
    const granted = [...rolePermissions.teacher, "finance.read" as Permission];
    await c.roles.update("teacher", { permissions: granted });
    setRolePolicies([staleTeacher()]);

    const outcome = await c.auth.restoreDetailed();
    const policyError = (outcome as { policyError?: ApiError }).policyError;

    expect(outcome.session?.permissions).toContain("finance.read");
    expect(outcome.session?.permissions).not.toContain("library.write");
    expect(policyError).toBeUndefined();
  });

  it("keeps the identity but exposes a policy-unavailable restore result when the local read fails", async () => {
    const c = ctx();
    let fail = false;
    const roles: RoleRepository = {
      list: async () => ({ data: [], meta: { page: 1, per_page: 0, total: 0 } }),
      get: async (id: RoleId) => {
        if (fail) throw new Error("local role store unavailable");
        return c.roles.get(id);
      },
      update: async () => {
        throw new Error("not used");
      },
      reset: async () => {
        throw new Error("not used");
      },
    } as unknown as RoleRepository;
    const auth = new LocalAuthRepository(c.store, c.storage, () => Date.now(), undefined, roles);
    await auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });
    fail = true;

    const outcome = await auth.restoreDetailed();
    const policyError = (outcome as { policyError?: ApiError }).policyError;

    expect(outcome.session?.user.email).toBe(TEACHER);
    expect(outcome.session?.permissions).toEqual([]);
    expect(policyError).toBeInstanceOf(ApiError);
    expect(policyError?.code).toBe("ROLE_POLICY_UNAVAILABLE");
    await expect(auth.restore()).rejects.toMatchObject({ code: "ROLE_POLICY_UNAVAILABLE" });
  });

  it("cannot inherit a different user's previous projection", async () => {
    const c = ctx();
    setRolePolicies([
      {
        ...defaultRoleRecord("administrator"),
        permissions: ["students.read"],
        customized: true,
      },
    ]);

    const session = await c.auth.login({ email: TEACHER, password: DEMO_PASSPHRASE });

    expect(session.user.role).toBe("teacher");
    expect(session.permissions).toEqual([...rolePermissions.teacher]);
    expect(session.permissions).not.toEqual(["students.read"]);
  });
});
