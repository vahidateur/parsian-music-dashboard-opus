/**
 * A tiny in-process auth server and a "page load" factory for the persistence
 * tests. Not a test file (no `.test.`), so vitest does not collect it.
 *
 * A "page load" is a fresh in-memory token over a SHARED storage: that is exactly
 * what a browser reload does to the application — module state is lost, the
 * tab's sessionStorage is kept.
 */
import { ApiClient } from "@/api/client";
import { ApiAuthRepository } from "@/domains/auth/apiAuthRepository";
import { PERMISSIONS } from "@/domains/auth/permissions";
import { createTokenStore, type StorageLike } from "@/domains/auth/tokenStore";

export const RIGHT_PASSWORD = "right-password";

export interface FakeStorage extends StorageLike {
  dump(): Record<string, string>;
}

export function fakeStorage(seed: Record<string, string> = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

export interface RecordedCall {
  path: string;
  method: string;
  authorization: string | undefined;
}

export function createFakeServer() {
  const valid = new Set<string>();
  const calls: RecordedCall[] = [];
  let issued = 0;
  let networkDown = false;
  /** Tokens the server has revoked for age, mapped to the 401 code /auth/me answers. */
  const expiredAs = new Map<string, string>();

  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const unauthenticated = (): Response =>
    json(401, { error: { code: "AUTH_UNAUTHENTICATED", message: "unauthenticated" } });

  const session = (token: string) => ({
    user: {
      id: "usr_admin",
      name: "Admin",
      email: "admin@demo.local",
      role: "administrator",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    permissions: [...PERMISSIONS],
    token,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (networkDown) throw new TypeError("Failed to fetch");
    const path = String(input).replace(/^.*\/api\/v1/, "").replace(/\?.*$/, "");
    const method = init?.method ?? "GET";
    const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ path, method, authorization });
    const bearer = authorization?.replace(/^Bearer /, "");

    if (path === "/auth/login" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { password?: string };
      if (body.password !== RIGHT_PASSWORD) {
        return json(401, { error: { code: "AUTH_INVALID_CREDENTIALS", message: "bad credentials" } });
      }
      issued += 1;
      const token = `token-${issued}`;
      valid.add(token);
      return json(200, { data: session(token) });
    }
    if (path === "/auth/me") {
      if (!bearer || !valid.has(bearer)) return unauthenticated();
      const code = expiredAs.get(bearer);
      if (code) return json(401, { error: { code, message: "session ended" } });
      return json(200, { data: session("") }); // the real backend never re-issues on /me
    }
    if (path === "/auth/logout" && method === "POST") {
      if (!bearer || !valid.has(bearer)) return unauthenticated();
      valid.delete(bearer);
      return new Response(null, { status: 204 });
    }
    if (!bearer || !valid.has(bearer)) return unauthenticated();
    return json(200, { data: [], meta: { page: 1, per_page: 25, total: 0 } });
  }) as typeof fetch;

  return {
    valid,
    calls,
    fetchImpl,
    expiredAs,
    setNetworkDown(down: boolean) {
      networkDown = down;
    },
  };
}

export type FakeServer = ReturnType<typeof createFakeServer>;

/** One page load: fresh module state (no in-memory token) over the given storage. */
export function pageLoad(server: FakeServer, storage: StorageLike) {
  let inMemoryToken: string | null = null;
  const client = new ApiClient({
    baseUrl: "/api/v1",
    getToken: () => inMemoryToken,
    fetchImpl: server.fetchImpl,
  });
  const repository = new ApiAuthRepository(
    client,
    (session) => {
      inMemoryToken = session?.token ? session.token : null;
    },
    createTokenStore(storage),
  );
  return { repository, client, inMemoryToken: () => inMemoryToken };
}