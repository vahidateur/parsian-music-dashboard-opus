import type { ApiClient } from "@/api/client";
import { ApiError, isApiError } from "@/api/errors";
import { isPermission, permissionsForRole, isRoleId, type Permission } from "./permissions";
import { defaultTokenStore, isExpired, type TokenStore } from "./tokenStore";
import type { AuthRepository } from "./repository";
import type { AuthUser, LoginInput, Session } from "./types";

/**
 * Real authentication against a REST backend.
 *
 *   POST /api/v1/auth/login    → { data: { user, permissions, token, expires_at } }
 *   POST /api/v1/auth/logout
 *   GET  /api/v1/auth/me
 *
 * The server is the only authority for identity AND authorization; the
 * permissions returned here drive UI affordances only.
 *
 * SESSION PERSISTENCE. The bearer token (and its expiry — nothing else) is kept in a
 * `TokenStore` (sessionStorage by default) so a page reload can restore the
 * session: `restore()` replays the stored token against `GET /auth/me`, and the
 * server decides whether it is still valid. An unreadable, expired or rejected
 * token is cleared and the caller is unauthenticated — it fails closed. See
 * `tokenStore.ts` for what is stored and the recorded security trade-off.
 *
 * It is selected only when VITE_DATA_SOURCE=api (or in the client composition).
 */

interface WireSession {
  user?: unknown;
  permissions?: unknown;
  token?: unknown;
  expires_at?: unknown;
  expiresAt?: unknown;
}

export class ApiAuthRepository implements AuthRepository {
  constructor(
    private readonly client: ApiClient,
    /** Lets the composition root learn about a new token. */
    private readonly onSession: (session: Session | null) => void = () => {},
    /** Where the token survives a reload. Injectable so tests never touch real storage. */
    private readonly store: TokenStore = defaultTokenStore,
  ) {}

  async login(input: LoginInput): Promise<Session> {
    const raw = await this.client.post<WireSession>("auth/login", { email: input.email, password: input.password });
    const session = toSession(raw);
    this.onSession(session);
    this.persist(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post("auth/logout");
    } finally {
      // Whatever the server said, this browser no longer holds a session.
      this.store.clear();
      this.onSession(null);
    }
  }

  /**
   * Restores the session a previous page load left behind.
   *
   * No stored token, or one whose expiry has passed, means there is nothing to
   * restore — and no request is made. Otherwise the stored token is replayed
   * against `/auth/me`; the server, not this browser, decides whether it is still
   * good. A rejection clears the stored token. A transport failure (network,
   * timeout, 5xx) rethrows WITHOUT clearing it, so a flaky connection does not
   * sign the user out for good; the caller still ends up unauthenticated.
   */
  async restore(): Promise<Session | null> {
    const stored = this.store.read();
    if (stored === null) return null;
    if (isExpired(stored.expiresAt)) {
      this.discard();
      return null;
    }
    try {
      // The in-memory token is empty after a reload, so present the stored one
      // explicitly for this single request.
      const raw = await this.client.get<WireSession>("auth/me", {
        headers: { Authorization: `Bearer ${stored.token}` },
      });
      // `/auth/me` never re-issues a token; the one that just proved itself stays.
      const session: Session = { ...toSession(raw), token: stored.token };
      this.onSession(session);
      this.persist(session);
      return session;
    } catch (error) {
      if (isApiError(error) && (error.kind === "authentication" || error.kind === "authorization")) {
        this.discard();
        return null;
      }
      throw error;
    }
  }

  async me(): Promise<Session> {
    const session = toSession(await this.client.get<WireSession>("auth/me"));
    // `/auth/me` returns an empty token; keep the one already in use rather than
    // overwriting it with "" (which would silently drop the Authorization header).
    if (!session.token) session.token = this.store.read()?.token ?? "";
    this.onSession(session);
    return session;
  }

  /** Persists only what a reload needs: the token and its expiry. */
  private persist(session: Session): void {
    if (session.token) this.store.write({ token: session.token, expiresAt: session.expiresAt });
  }

  private discard(): void {
    this.store.clear();
    this.onSession(null);
  }
}

/** Validates the wire payload; the server response is untrusted input. */
export function toSession(raw: WireSession): Session {
  const user = toUser(raw.user);
  const expiresRaw = raw.expires_at ?? raw.expiresAt;
  return {
    user,
    permissions: toPermissions(raw.permissions, user),
    token: typeof raw.token === "string" ? raw.token : "",
    expiresAt: typeof expiresRaw === "string" ? expiresRaw : new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function toUser(value: unknown): AuthUser {
  if (typeof value !== "object" || value === null) {
    throw new ApiError({ kind: "server", code: "AUTH_BAD_PAYLOAD", message: "پاسخ سرور برای کاربر معتبر نیست." });
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const role = typeof raw.role === "string" && isRoleId(raw.role) ? raw.role : "staff";
  if (!id) {
    throw new ApiError({ kind: "server", code: "AUTH_BAD_PAYLOAD", message: "پاسخ سرور برای کاربر معتبر نیست." });
  }
  const now = new Date().toISOString();
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "",
    email: typeof raw.email === "string" ? raw.email : "",
    role,
    status: raw.status === "disabled" ? "disabled" : "active",
    createdAt: typeof raw.created_at === "string" ? raw.created_at : now,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : now,
  };
}

/** Server-provided permissions win; fall back to the local matrix if absent. */
function toPermissions(value: unknown, user: AuthUser): Permission[] {
  if (Array.isArray(value)) {
    return value.filter((p): p is Permission => typeof p === "string" && isPermission(p));
  }
  return permissionsForRole(user.role);
}
