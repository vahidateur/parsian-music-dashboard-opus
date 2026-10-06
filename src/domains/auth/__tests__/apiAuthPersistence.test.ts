import { afterEach, describe, expect, it, vi } from "vitest";
import { isApiError } from "@/api/errors";
import { getApiClient, resetRegistry } from "@/domains/registryCore";
import { API_SESSION_STORAGE_KEY, createTokenStore, defaultTokenStore } from "@/domains/auth/tokenStore";
import { RIGHT_PASSWORD, createFakeServer, fakeStorage, pageLoad } from "./fakeAuthServer";

const credentials = { email: "admin@demo.local", password: RIGHT_PASSWORD };

describe("API auth persistence — token persistence after login", () => {
  it("persists exactly the token and its expiry, and never the password or the user", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    await pageLoad(server, storage).repository.login(credentials);

    const dump = storage.dump();
    expect(Object.keys(dump)).toEqual([API_SESSION_STORAGE_KEY]);
    const stored = JSON.parse(dump[API_SESSION_STORAGE_KEY]) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["expiresAt", "token"]);
    expect(stored.token).toBe("token-1");
    expect(dump[API_SESSION_STORAGE_KEY]).not.toContain(RIGHT_PASSWORD);
    expect(dump[API_SESSION_STORAGE_KEY]).not.toContain("admin@demo.local");
  });

  it("does not persist anything when the login is refused", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    const page = pageLoad(server, storage);
    const failure = await page.repository.login({ email: "admin@demo.local", password: "nope" }).catch((e: unknown) => e);
    expect(isApiError(failure) && failure.kind).toBe("authentication");
    expect(storage.dump()).toEqual({});
    expect(page.inMemoryToken()).toBeNull();
  });
});

describe("API auth persistence — restoration after a reload", () => {
  it("restores the session on a fresh page load and presents the stored token", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    await pageLoad(server, storage).repository.login(credentials);

    // RELOAD: new module state (no in-memory token), same tab storage.
    const reloaded = pageLoad(server, storage);
    expect(reloaded.inMemoryToken()).toBeNull();

    const session = await reloaded.repository.restore();
    expect(session?.user.role).toBe("administrator");
    expect(session?.permissions).toHaveLength(25);
    expect(session?.token).toBe("token-1");

    const me = server.calls.filter((c) => c.path === "/auth/me").at(-1);
    expect(me?.authorization).toBe("Bearer token-1");

    // The restored token is now the in-memory one: ordinary calls are authenticated.
    expect(reloaded.inMemoryToken()).toBe("token-1");
    await reloaded.client.get("students");
    expect(server.calls.at(-1)?.authorization).toBe("Bearer token-1");
  });

  it("makes no request at all when nothing is stored", async () => {
    const server = createFakeServer();
    const page = pageLoad(server, fakeStorage());
    expect(await page.repository.restore()).toBeNull();
    expect(server.calls).toHaveLength(0);
  });

  it("me() keeps the token in use instead of overwriting it with the empty one /auth/me returns", async () => {
    const server = createFakeServer();
    const page = pageLoad(server, fakeStorage());
    await page.repository.login(credentials);
    await page.repository.me();
    expect(page.inMemoryToken()).toBe("token-1");
  });
});

describe("API auth persistence — logout clears persisted state", () => {
  it("removes the stored token, revokes it on the server, and the next load is unauthenticated", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    await pageLoad(server, storage).repository.login(credentials);

    const reloaded = pageLoad(server, storage);
    await reloaded.repository.restore();
    await reloaded.repository.logout();

    expect(storage.dump()).toEqual({});
    expect(reloaded.inMemoryToken()).toBeNull();
    expect(server.valid.has("token-1")).toBe(false);

    const callsBefore = server.calls.length;
    const third = pageLoad(server, storage);
    expect(await third.repository.restore()).toBeNull();
    expect(server.calls).toHaveLength(callsBefore); // nothing stored → no request
  });

  it("still clears this browser when the server is unreachable during logout", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    const page = pageLoad(server, storage);
    await page.repository.login(credentials);
    server.setNetworkDown(true);
    await page.repository.logout().catch(() => undefined);
    expect(storage.dump()).toEqual({});
    expect(page.inMemoryToken()).toBeNull();
  });
});

describe("API auth persistence — invalid persisted state fails closed", () => {
  const future = () => new Date(Date.now() + 3_600_000).toISOString();

  it("a token the server rejects is cleared and the caller is unauthenticated", async () => {
    const server = createFakeServer();
    const storage = fakeStorage({ [API_SESSION_STORAGE_KEY]: JSON.stringify({ token: "revoked", expiresAt: future() }) });
    const page = pageLoad(server, storage);
    expect(await page.repository.restore()).toBeNull();
    expect(storage.dump()).toEqual({});
    expect(page.inMemoryToken()).toBeNull();
  });

  it("an expired stored session is discarded without contacting the server", async () => {
    const server = createFakeServer();
    const storage = fakeStorage({
      [API_SESSION_STORAGE_KEY]: JSON.stringify({ token: "token-1", expiresAt: new Date(Date.now() - 1000).toISOString() }),
    });
    expect(await pageLoad(server, storage).repository.restore()).toBeNull();
    expect(server.calls).toHaveLength(0);
    expect(storage.dump()).toEqual({});
  });

  it.each([
    ["not JSON", "{not json"],
    ["an array", "[]"],
    ["a numeric token", JSON.stringify({ token: 42, expiresAt: "2099-01-01T00:00:00Z" })],
    ["an empty token", JSON.stringify({ token: "", expiresAt: "2099-01-01T00:00:00Z" })],
    ["a missing expiry", JSON.stringify({ token: "x" })],
    ["an unreadable expiry", JSON.stringify({ token: "x", expiresAt: "soon" })],
    ["an oversized token", JSON.stringify({ token: "x".repeat(5000), expiresAt: "2099-01-01T00:00:00Z" })],
  ])("a corrupt or tampered store (%s) is dropped and ignored", async (_label, raw) => {
    const server = createFakeServer();
    const storage = fakeStorage({ [API_SESSION_STORAGE_KEY]: raw });
    expect(await pageLoad(server, storage).repository.restore()).toBeNull();
    expect(server.calls).toHaveLength(0);
    expect(storage.dump()).toEqual({});
  });

  it("a transport failure rethrows (caller stays unauthenticated) but keeps the token for the next load", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    await pageLoad(server, storage).repository.login(credentials);
    server.setNetworkDown(true);
    const failure = await pageLoad(server, storage).repository.restore().catch((e: unknown) => e);
    expect(isApiError(failure) && failure.kind).toBe("network");
    expect(Object.keys(storage.dump())).toEqual([API_SESSION_STORAGE_KEY]);

    server.setNetworkDown(false);
    expect((await pageLoad(server, storage).repository.restore())?.user.role).toBe("administrator");
  });
});

describe("token store — storage unavailable", () => {
  it("degrades to memory without throwing", () => {
    const store = createTokenStore(null);
    store.write({ token: "t", expiresAt: "2099-01-01T00:00:00Z" });
    expect(store.read()?.token).toBe("t");
    store.clear();
    expect(store.read()).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createTokenStore(broken);
    expect(() => store.write({ token: "t", expiresAt: "2099-01-01T00:00:00Z" })).not.toThrow();
    expect(store.read()?.token).toBe("t");
    expect(() => store.clear()).not.toThrow();
  });
});

describe("registry — a rejected token is not replayed after the next reload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    defaultTokenStore.clear();
    resetRegistry();
  });

  it("any 401 on the shared ApiClient clears the persisted token", async () => {
    defaultTokenStore.write({ token: "stale", expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ error: { code: "AUTH_UNAUTHENTICATED", message: "x" } }), { status: 401 }),
    );
    await getApiClient().get("students").catch(() => undefined);
    expect(defaultTokenStore.read()).toBeNull();
  });
});