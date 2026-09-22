/**
 * ROLE POLICY — the matrix is data, and the data reaches the product.
 *
 * Three claims are worth locking down, because each one has an obvious way to
 * be half-built:
 *
 *   1. A role with no stored row resolves to the shipped default, and "reset"
 *      means deleting the override rather than copying the default into it.
 *   2. An administrator's edit is written through the repository and becomes the
 *      answer `permissionsForRole` / `roleLabel` give — the projection is not a
 *      second, staler copy of the truth.
 *   3. The one reduction the panel refuses is the one that would lock everybody
 *      out: `administrator` keeps `roles.write`. Every other reduction, including
 *      taking finance away from an administrator, is a legitimate choice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { ApiClient } from "@/api/client";
import { ApiRoleRepository, DemoRoleRepository, defaultRoleRecord } from "@/domains/auth/roleRepository";
import {
  PERMISSIONS,
  ROLES,
  getRolePolicy,
  getRolePolicyVersion,
  permissionsForRole,
  roleLabel,
  roleLabels,
  rolePermissions,
  setRolePolicies,
  subscribeRolePolicy,
} from "@/domains/auth/permissions";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";
import { asFetch, createFetchMock, jsonResponse, requestOf } from "@/test/fetchMock";

function ctx() {
  const store = new DemoStoreImpl(memoryStorage());
  const manager = new DemoDataManager(store);
  manager.initialize();
  return { store, manager, repo: new DemoRoleRepository(store) };
}

/** Loads a repository's answer into the projection the gates read. */
async function project(repo: DemoRoleRepository) {
  const page = await repo.list();
  setRolePolicies(page.data);
  return page.data;
}

beforeEach(() => {
  setRolePolicies([]);
});

describe("the shipped default", () => {
  it("is what every role resolves to before anybody edits anything", () => {
    const c = ctx();
    for (const role of ROLES) {
      const record = defaultRoleRecord(role);
      expect(record.id).toBe(role);
      expect(record.label).toBe(roleLabels[role]);
      expect(record.customized).toBe(false);
      expect(record.permissions).toEqual([...rolePermissions[role]]);
      // A default is a copy, not a live reference into the shipped table.
      expect(record.permissions).not.toBe(rolePermissions[role]);
    }
    /*
      The dataset ships one row per role carrying its NAME and SCOPE — those are
      academy wording, so they are data from day one — and deliberately no
      `permissions` key. An absent override is what makes "reset to default"
      cheap and honest: there is nothing to back-fill.
    */
    const seeded = c.store.roles.all();
    expect(seeded.map((row) => row.id)).toEqual([...ROLES]);
    for (const row of seeded) {
      expect(row.permissions).toBeUndefined();
      expect(row.label).toBe(roleLabels[row.id as (typeof ROLES)[number]]);
    }
  });

  it("lists every role the product knows, in order, with a scope line", async () => {
    const c = ctx();
    const page = await c.repo.list();
    expect(page.data.map((r) => r.id)).toEqual([...ROLES]);
    expect(page.meta.total).toBe(ROLES.length);
    for (const record of page.data) expect(record.scope.length).toBeGreaterThan(4);
  });

  it("refuses an unknown role rather than inventing one", async () => {
    const c = ctx();
    const error = (await c.repo.get("root" as never).catch((e) => e)) as ApiError;
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("ROLE_NOT_FOUND");
  });
});

describe("an administrator's edit", () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => {
    c = ctx();
  });

  it("adds an access a role did not have, and the gate sees it", async () => {
    const before = permissionsForRole("teacher");
    expect(before).not.toContain("finance.read");

    const granted = [...before, "finance.read" as (typeof PERMISSIONS)[number]];
    await c.repo.update("teacher", { permissions: granted });
    await project(c.repo);

    expect(permissionsForRole("teacher")).toContain("finance.read");
    expect(getRolePolicy("teacher")?.customized).toBe(true);
  });

  it("takes an access away, and the gate stops granting it", async () => {
    const before = permissionsForRole("staff");
    expect(before).toContain("students.write");

    await c.repo.update("staff", { permissions: before.filter((p) => p !== "students.write") });
    await project(c.repo);

    expect(permissionsForRole("staff")).not.toContain("students.write");
    // The rest of the role is untouched — a reduction is not a rebuild.
    for (const permission of before.filter((p) => p !== "students.write")) {
      expect(permissionsForRole("staff")).toContain(permission);
    }
  });

  it("renames a role everywhere the name is read from", async () => {
    expect(roleLabel("manager")).toBe(roleLabels.manager);
    await c.repo.update("manager", { label: "سرپرست آموزشی" });
    await project(c.repo);
    expect(roleLabel("manager")).toBe("سرپرست آموزشی");
    // The shipped table is not edited — the projection is what changed.
    expect(roleLabels.manager).not.toBe("سرپرست آموزشی");
  });

  it("persists across a fresh repository reading the same dataset", async () => {
    await c.repo.update("accountant", { label: "امور مالی آموزشگاه", scope: "فقط فاکتورها" });
    const reopened = new DemoRoleRepository(c.store);
    const record = await reopened.get("accountant");
    expect(record.label).toBe("امور مالی آموزشگاه");
    expect(record.scope).toBe("فقط فاکتورها");
    expect(record.customized).toBe(true);
  });

  it("marks an edit that lands back on the default as not customized", async () => {
    const shipped = [...rolePermissions.teacher];
    await c.repo.update("teacher", { permissions: [...shipped, "library.write"] });
    expect((await c.repo.get("teacher")).customized).toBe(true);

    await c.repo.update("teacher", { permissions: shipped });
    const record = await c.repo.get("teacher");
    expect(record.customized).toBe(false);
    // And the override is dropped from the dataset, not merely flagged.
    expect(c.store.roles.find("teacher")?.permissions).toBeUndefined();
  });

  it("rejects a permission the product does not define", async () => {
    const error = (await c.repo
      .update("staff", { permissions: ["students.read", "launch.missiles" as never] })
      .catch((e) => e)) as ApiError;
    expect(error.kind).toBe("validation");
    expect(error.code).toBe("ROLE_INVALID");
    expect(error.fields?.permissions?.[0]).toContain("launch.missiles");
  });

  it("rejects a role name too short to read", async () => {
    const error = (await c.repo.update("staff", { label: "ک" }).catch((e) => e)) as ApiError;
    expect(error.fields?.label).toBeDefined();
  });
});

describe("the one lockout it refuses", () => {
  it("will not let the administrator role lose access to the matrix itself", async () => {
    const c = ctx();
    const without = permissionsForRole("administrator").filter((p) => p !== "roles.write");
    const error = (await c.repo.update("administrator", { permissions: without }).catch((e) => e)) as ApiError;
    expect(error.kind).toBe("validation");
    expect(error.fields?.permissions?.[0]).toContain("مدیریت نقش‌ها");
    // Nothing was written: the refusal leaves the role exactly as it was.
    expect(permissionsForRole("administrator")).toContain("roles.write");
    expect(c.store.roles.find("administrator")?.permissions).toBeUndefined();
  });

  it("does allow every other reduction of the administrator role", async () => {
    const c = ctx();
    const reduced = permissionsForRole("administrator").filter((p) => p !== "finance.write");
    const record = await c.repo.update("administrator", { permissions: reduced });
    expect(record.permissions).not.toContain("finance.write");
    expect(record.permissions).toContain("roles.write");
  });
});

describe("reset", () => {
  it("returns a role to the shipped matrix and clears the stored override", async () => {
    const c = ctx();
    await c.repo.update("teacher", { label: "استاد", permissions: ["attendance.write"] });
    const record = await c.repo.reset("teacher");
    expect(record.label).toBe(roleLabels.teacher);
    expect(record.permissions).toEqual([...rolePermissions.teacher]);
    expect(record.customized).toBe(false);
    await project(c.repo);
    expect(permissionsForRole("teacher")).toEqual([...rolePermissions.teacher]);
    expect(roleLabel("teacher")).toBe(roleLabels.teacher);
  });
});

describe("the projection itself", () => {
  it("falls back to the shipped table when nothing has been read", () => {
    expect(getRolePolicy("teacher")).toBeUndefined();
    expect(permissionsForRole("teacher")).toEqual([...rolePermissions.teacher]);
    expect(roleLabel("teacher")).toBe(roleLabels.teacher);
  });

  it("bumps its version and wakes subscribers on every change", async () => {
    const c = ctx();
    const listener = vi.fn();
    const unsubscribe = subscribeRolePolicy(listener);
    const before = getRolePolicyVersion();

    await project(c.repo);
    expect(getRolePolicyVersion()).toBeGreaterThan(before);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    const same = getRolePolicyVersion();
    // Re-reading identical records is not a change; a gate must not re-render.
    setRolePolicies((await c.repo.list()).data);
    expect(getRolePolicyVersion()).toBe(same);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("only ever holds records for roles the product defines", () => {
    setRolePolicies([
      { id: "ghost" as never, label: "روح", scope: "-", permissions: [], customized: true },
      defaultRoleRecord("staff"),
    ]);
    expect(getRolePolicy("ghost" as never)).toBeUndefined();
    expect(getRolePolicy("staff")).toBeDefined();
  });
});

describe("ApiRoleRepository", () => {
  const client = (mock: ReturnType<typeof createFetchMock>) =>
    new ApiClient({ baseUrl: "https://x.test/api/v1", fetchImpl: asFetch(mock) });

  it("reads the matrix from the server that owns authorization", async () => {
    const mock = createFetchMock(() =>
      jsonResponse({ data: [defaultRoleRecord("staff")], meta: { page: 1, per_page: 1, total: 1 } }),
    );
    const page = await new ApiRoleRepository(client(mock)).list();
    expect(page.data[0].id).toBe("staff");
    expect(requestOf(mock).url).toBe("https://x.test/api/v1/roles");
    expect(requestOf(mock).init.method).toBe("GET");
  });

  it("PATCHes an edit and POSTs a reset — the two verbs the server needs", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: defaultRoleRecord("staff") }));
    const repo = new ApiRoleRepository(client(mock));

    await repo.update("staff", { label: "دفتر" });
    expect(requestOf(mock, 0).url).toBe("https://x.test/api/v1/roles/staff");
    expect(requestOf(mock, 0).init.method).toBe("PATCH");

    await repo.reset("staff");
    expect(requestOf(mock, 1).url).toBe("https://x.test/api/v1/roles/staff/reset");
    expect(requestOf(mock, 1).init.method).toBe("POST");
  });

  it("validates locally before spending a request", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: defaultRoleRecord("administrator") }));
    const repo = new ApiRoleRepository(client(mock));
    await expect(repo.update("administrator", { permissions: [] })).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
});
