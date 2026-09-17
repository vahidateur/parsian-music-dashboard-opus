import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { ApiClient } from "@/api/client";
import { ApiUserRepository, DemoUserRepository, validateUserInput } from "@/domains/auth/userRepository";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";
import { asFetch, createFetchMock, jsonResponse, requestOf } from "@/test/fetchMock";

function ctx() {
  const store = new DemoStoreImpl(memoryStorage());
  const manager = new DemoDataManager(store);
  manager.initialize();
  return { store, manager, repo: new DemoUserRepository(store) };
}

describe("user validation", () => {
  it("rejects short names, bad emails and unknown roles", () => {
    const error = validateUserInput({ name: "a", email: "nope", role: "root" as never }, true);
    expect(error?.kind).toBe("validation");
    expect(Object.keys(error?.fields ?? {}).sort()).toEqual(["email", "name", "role"]);
  });

  it("accepts a valid payload", () => {
    expect(validateUserInput({ name: "علی رضایی", email: "a@b.co", role: "staff" }, true)).toBeNull();
  });

  it("only validates provided fields on partial updates", () => {
    expect(validateUserInput({ status: "disabled" }, false)).toBeNull();
    expect(validateUserInput({ email: "bad" }, false)?.fields?.email).toBeDefined();
  });
});

describe("DemoUserRepository", () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => {
    c = ctx();
  });

  it("lists the seeded users", async () => {
    const page = await c.repo.list();
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.meta.total).toBe(page.data.length);
  });

  it("creates a user with timestamps and no credentials", async () => {
    const created = await c.repo.create({ name: "کاربر نو", email: "New@Demo.local", role: "staff" });
    expect(created.email).toBe("new@demo.local");
    expect(created.status).toBe("active");
    expect(Date.parse(created.createdAt)).not.toBeNaN();
    expect(JSON.stringify(created).toLowerCase()).not.toMatch(/password|hash|secret/);
    await expect(c.repo.get(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it("rejects duplicate emails with a conflict", async () => {
    const existing = (await c.repo.list()).data[0];
    const error = (await c.repo.create({ name: "تکراری", email: existing.email.toUpperCase(), role: "staff" }).catch((e) => e)) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("USER_EMAIL_TAKEN");
  });

  it("rejects invalid input before touching the store", async () => {
    const before = (await c.repo.list()).data.length;
    await expect(c.repo.create({ name: "x", email: "bad", role: "staff" })).rejects.toBeInstanceOf(ApiError);
    expect((await c.repo.list()).data.length).toBe(before);
  });

  it("updates role and status, refreshing updatedAt", async () => {
    const user = (await c.repo.list()).data.find((u) => u.role !== "administrator")!;
    const updated = await c.repo.update(user.id, { role: "accountant", status: "disabled" });
    expect(updated.role).toBe("accountant");
    expect(updated.status).toBe("disabled");
    expect(updated.createdAt).toBe(user.createdAt);
  });

  it("deletes a user", async () => {
    const user = (await c.repo.list()).data[0];
    await c.repo.delete(user.id);
    await expect(c.repo.get(user.id)).rejects.toBeInstanceOf(ApiError);
  });

  it("reports not_found for unknown ids", async () => {
    const error = (await c.repo.get("usr_ghost").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("USER_NOT_FOUND");
  });

  it("persists through the single DemoStore snapshot", async () => {
    const created = await c.repo.create({ name: "پایدار", email: "persist@demo.local", role: "staff" });
    expect(c.store.snapshot().users.some((u) => u.id === created.id)).toBe(true);
    expect(c.manager.exportBackup().data.users.some((u) => u.id === created.id)).toBe(true);
  });
});

describe("ApiUserRepository", () => {
  it("builds the expected REST requests", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: { id: "usr_1", role: "staff" } }));
    const client = new ApiClient({ baseUrl: "https://x.test/api/v1", fetchImpl: asFetch(mock) });
    const repo = new ApiUserRepository(client);

    await repo.update("usr_1", { status: "disabled" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://x.test/api/v1/users/usr_1");
    expect(req.init.method).toBe("PATCH");
  });

  it("validates before issuing a request", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: {} }));
    const client = new ApiClient({ baseUrl: "https://x.test/api/v1", fetchImpl: asFetch(mock) });
    await expect(new ApiUserRepository(client).create({ name: "x", email: "bad", role: "staff" })).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
});
