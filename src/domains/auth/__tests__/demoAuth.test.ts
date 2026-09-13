import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AUTH_SESSION_KEY, DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { permissionsForRole } from "@/domains/auth/permissions";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage, type StorageLike } from "@/services/demoStore";

const ADMIN = "admin@demo.local";

function ctx(now: () => number = () => Date.now()) {
  const store = new DemoStoreImpl(memoryStorage());
  const session: StorageLike = memoryStorage();
  const auth = new DemoAuthRepository(store, session, now);
  return { store, session, auth, manager: new DemoDataManager(store) };
}

describe("demo login", () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => {
    c = ctx();
    c.manager.initialize();
  });

  it("authenticates a seeded user with the demo passphrase", async () => {
    const session = await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    expect(session.user.email).toBe(ADMIN);
    expect(session.user.role).toBe("administrator");
    expect(session.permissions).toEqual(permissionsForRole("administrator"));
    expect(session.token).toMatch(/^demo_[0-9a-f]{32}$/);
  });

  it("is case- and whitespace-insensitive for the email", async () => {
    await expect(c.auth.login({ email: "  ADMIN@Demo.Local ", password: DEMO_PASSPHRASE })).resolves.toBeTruthy();
  });

  it("rejects a wrong passphrase", async () => {
    const error = (await c.auth.login({ email: ADMIN, password: "nope" }).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("authentication");
    expect(error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("does not leak whether an account exists", async () => {
    const unknown = (await c.auth.login({ email: "ghost@demo.local", password: DEMO_PASSPHRASE }).catch((e) => e)) as ApiError;
    const wrongPass = (await c.auth.login({ email: ADMIN, password: "x" }).catch((e) => e)) as ApiError;
    expect(unknown.message).toBe(wrongPass.message);
    expect(unknown.code).toBe(wrongPass.code);
  });

  it("rejects empty input as a validation error", async () => {
    const error = (await c.auth.login({ email: "", password: "" }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("validation");
  });

  it("refuses a disabled account", async () => {
    const admin = c.store.users.all().find((u) => u.email === ADMIN)!;
    c.store.users.update(admin.id, { status: "disabled" });
    const error = (await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("authorization");
    expect(error.code).toBe("AUTH_USER_DISABLED");
  });

  it("never persists credential material", async () => {
    await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    const raw = c.session.getItem(AUTH_SESSION_KEY) ?? "";
    expect(raw.toLowerCase()).not.toContain(DEMO_PASSPHRASE);
    expect(raw.toLowerCase()).not.toMatch(/password|hash|secret/);
    expect(JSON.stringify(c.store.snapshot().users).toLowerCase()).not.toMatch(/password|hash|secret/);
  });
});

describe("session restoration", () => {
  it("restores a live session", async () => {
    const c = ctx();
    c.manager.initialize();
    await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    const restored = await c.auth.restore();
    expect(restored?.user.email).toBe(ADMIN);
  });

  it("returns null with no session", async () => {
    const c = ctx();
    c.manager.initialize();
    await expect(c.auth.restore()).resolves.toBeNull();
  });

  it("expires a stale session and clears it", async () => {
    let now = Date.now();
    const c = ctx(() => now);
    c.manager.initialize();
    await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    now += 13 * 60 * 60 * 1000; // past the 12h TTL
    await expect(c.auth.restore()).resolves.toBeNull();
    expect(c.session.getItem(AUTH_SESSION_KEY)).toBeNull();
  });

  it("drops the session when the user was deleted", async () => {
    const c = ctx();
    c.manager.initialize();
    const session = await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    c.store.users.remove(session.user.id);
    await expect(c.auth.restore()).resolves.toBeNull();
  });

  it("drops the session when the user was disabled", async () => {
    const c = ctx();
    c.manager.initialize();
    const session = await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    c.store.users.update(session.user.id, { status: "disabled" });
    await expect(c.auth.restore()).resolves.toBeNull();
  });

  it("re-reads permissions from the matrix, not from storage", async () => {
    const c = ctx();
    c.manager.initialize();
    const session = await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    c.store.users.update(session.user.id, { role: "teacher" });
    const restored = await c.auth.restore();
    expect(restored?.permissions).toEqual(permissionsForRole("teacher"));
    expect(restored?.permissions).not.toContain("users.write");
  });

  it("ignores malformed or tampered session payloads", async () => {
    for (const payload of ["{{{", "null", "[]", '{"userId":123}', '{"userId":"x","token":"t","expiresAt":"nope"}']) {
      const c = ctx();
      c.manager.initialize();
      c.session.setItem(AUTH_SESSION_KEY, payload);
      await expect(c.auth.restore()).resolves.toBeNull();
    }
  });

  it("me() throws when unauthenticated", async () => {
    const c = ctx();
    c.manager.initialize();
    const error = (await c.auth.me().catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("authentication");
  });
});

describe("logout", () => {
  it("removes the persisted session", async () => {
    const c = ctx();
    c.manager.initialize();
    await c.auth.login({ email: ADMIN, password: DEMO_PASSPHRASE });
    await c.auth.logout();
    expect(c.session.getItem(AUTH_SESSION_KEY)).toBeNull();
    await expect(c.auth.restore()).resolves.toBeNull();
  });
});
