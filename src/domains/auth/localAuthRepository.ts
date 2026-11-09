import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { SESSION_TTL_MS } from "./session";
import { isDemoMode } from "@/api/config";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { demoCredentialStore, type DemoCredentialStore } from "./demoCredentials";
import { LocalRoleRepository, rolePolicyInvalid, rolePolicyUnavailable, ROLE_POLICY_INVALID, ROLE_POLICY_UNAVAILABLE } from "./localRoleRepository";
import { isPermission, isRoleId, type RoleId, type RolePolicyRecord } from "./permissions";
import type { RoleRepository } from "./roleRepository";
import type { AuthRepository } from "./repository";
import type { AuthUser, LoginInput, Session } from "./types";

/**
 * ============================ DEMO AUTH ============================
 * This is NOT authentication in any security sense.
 *
 *  - The passphrase below is a PUBLIC, non-secret string shipped in the client
 *    bundle. Anyone can read it. It exists only to make the demo login screen
 *    behave like a real form.
 *  - No password, hash or salt is stored anywhere in the demo database.
 *  - The issued "token" is a random reference with zero cryptographic meaning.
 *  - Session state lives in localStorage and can be edited by the user, so a
 *    determined user can grant themselves any role. That is acceptable ONLY
 *    because the demo has no protected server-side data.
 *
 * The real implementation is `ApiAuthRepository`, where the server issues and
 * validates the session and enforces authorization.
 * ===================================================================
 */

/** Public demo passphrase — intentionally not a secret. */
export const DEMO_PASSPHRASE = "arena-demo";

export const AUTH_SESSION_KEY = "ava:demo:session";

/**
 * Demo token lifetime. Defined in the neutral session module so the shared
 * auth path (`AuthContext`) never imports this demo implementation — and
 * re-exported here so this module's public surface is unchanged. The client-
 * side session clock derives when a restored session actually began from it,
 * instead of trusting a localStorage value the user can delete.
 */
export { SESSION_TTL_MS } from "./session";

interface PersistedSession {
  userId: string;
  token: string;
  expiresAt: string;
}

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): SessionStorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function memory(): SessionStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * Non-cryptographic reference id. Explicitly NOT a security token.
 *
 * Fails loudly when no CSPRNG is available rather than silently falling back
 * to `Math.random()`. The old fallback downgraded randomness invisibly, which
 * is the worst failure mode: the value still looked like a token. WebCrypto is
 * present in every browser this panel supports and in Node 18+, so the throw
 * signals a genuinely broken environment, not a supported one.
 */
function demoToken(): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new ApiError({
      kind: "server",
      code: "AUTH_NO_SECURE_RANDOM",
      message: "این مرورگر از تولید مقدار تصادفی امن پشتیبانی نمی‌کند و ورود ممکن نیست.",
    });
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `demo_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/**
 * Demo accounts offered as one-click sign-in hints on the login screen.
 *
 * Lives here — beside the demo passphrase it belongs to — so that views never
 * import the DemoStore. Returns an empty list outside demo mode.
 */
export function listDemoAccounts(limit = 5, store: DemoStore = demoStore): AuthUser[] {
  if (!isDemoMode()) return [];
  return store.users
    .all()
    .filter((u) => u.status === "active")
    .slice(0, limit);
}

export class LocalAuthRepository implements AuthRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly storage: SessionStorageLike = browserStorage() ?? memory(),
    private readonly now: () => number = () => Date.now(),
    private readonly credentials: DemoCredentialStore = demoCredentialStore(),
    private readonly roles: RoleRepository = new LocalRoleRepository(store),
  ) {}

  async login({ email, password }: LoginInput): Promise<Session> {
    const target = normalizeEmail(email);
    if (!target || !password) {
      throw new ApiError({ kind: "validation", code: "AUTH_MISSING_FIELDS", message: "ایمیل و گذرواژه الزامی است." });
    }
    const user = this.store.snapshot().users.find((u) => normalizeEmail(u.email) === target);
    if (!user) throw invalidCredentials();
    /*
      An account whose passphrase was set in Settings is verified against it;
      every other account still uses the shared, public demo passphrase. The
      unknown-user and wrong-passphrase answers stay identical, so this does not
      become an oracle for which accounts have their own passphrase.
    */
    const expected = this.credentials.get(user.id) ?? DEMO_PASSPHRASE;
    if (password !== expected) {
      throw invalidCredentials();
    }

    if (user.status !== "active") {
      throw new ApiError({ kind: "authorization", code: "AUTH_USER_DISABLED", message: "این حساب غیرفعال است." });
    }

    const session = await this.sessionFor(user, demoToken(), new Date(this.now() + SESSION_TTL_MS).toISOString());
    this.persist({ userId: user.id, token: session.token, expiresAt: session.expiresAt });
    return session;
  }

  async logout(): Promise<void> {
    this.storage.removeItem(AUTH_SESSION_KEY);
  }

  async restore(): Promise<Session | null> {
    const { session, policyError } = await this.restoreDetailed();
    if (policyError) throw policyError;
    return session;
  }

  /**
   * `restore()` plus the expiry reason. The demo TTL is a lifetime ceiling
   * like the server's absolute one, so an outlived TTL names "absolute"; a
   * missing, malformed, or disowned credential stays silent — boot must not
   * distinguish those states.
   */
  async restoreDetailed(): Promise<{
    session: Session | null;
    expiredReason: "idle" | "absolute" | null;
    policyError?: ApiError;
  }> {
    const persisted = this.readPersisted();
    if (!persisted) return { session: null, expiredReason: null };

    if (Date.parse(persisted.expiresAt) <= this.now()) {
      this.storage.removeItem(AUTH_SESSION_KEY);
      return { session: null, expiredReason: "absolute" };
    }
    // The user list is authoritative: a user deleted/disabled since login
    // must not keep a working session.
    const user = this.store.snapshot().users.find((u) => u.id === persisted.userId);
    if (!user || user.status !== "active") {
      this.storage.removeItem(AUTH_SESSION_KEY);
      return { session: null, expiredReason: null };
    }

    try {
      return {
        session: await this.sessionFor(user, persisted.token, persisted.expiresAt),
        expiredReason: null,
      };
    } catch (cause) {
      // Keep the identity and make the policy failure explicit; do not sign a
      // valid session out and do not fabricate a permission set.
      return {
        session: { user, permissions: [], token: persisted.token, expiresAt: persisted.expiresAt },
        expiredReason: null,
        policyError: this.policyErrorFrom(cause),
      };
    }
  }

  async me(): Promise<Session> {
    const session = await this.restore();
    if (!session) throw new ApiError({ kind: "authentication", code: "AUTH_NO_SESSION", message: "نشست معتبری وجود ندارد." });
    return session;
  }

  async reauthorize(session: Session): Promise<Session> {
    const record = await this.roleSnapshot(session.user.role);
    return { ...session, permissions: [...record.permissions] };
  }

  /**
   * The session's permissions are a snapshot of the current LOCAL role record.
   *
   * This deliberately does not read `permissionsForRole`/`getRolePolicy`: the
   * module projection exists for synchronous UI gates, not as an authentication
   * source. A stale projection from a previous session must not become the next
   * session's permissions.
   */
  private async sessionFor(user: AuthUser, token: string, expiresAt: string): Promise<Session> {
    const record = await this.roleSnapshot(user.role);
    return { user, permissions: [...record.permissions], token, expiresAt };
  }

  private async roleSnapshot(role: RoleId): Promise<RolePolicyRecord> {
    try {
      const record = await this.roles.get(role);
      if (
        !record ||
        record.id !== role ||
        !isRoleId(record.id) ||
        !Array.isArray(record.permissions) ||
        record.permissions.some((permission) => !isPermission(permission))
      ) {
        throw rolePolicyInvalid(role);
      }
      return record;
    } catch (cause) {
      throw this.policyErrorFrom(cause, role);
    }
  }

  private policyErrorFrom(cause: unknown, role?: RoleId): ApiError {
    const normalized = apiErrorFromThrown(cause);
    if (normalized.code === ROLE_POLICY_INVALID || normalized.code === ROLE_POLICY_UNAVAILABLE) {
      return normalized;
    }
    if (normalized.code === "ROLE_NOT_FOUND" && role !== undefined) {
      return rolePolicyInvalid(role);
    }
    return rolePolicyUnavailable(normalized);
  }

  private persist(value: PersistedSession): void {
    try {
      this.storage.setItem(AUTH_SESSION_KEY, JSON.stringify(value));
    } catch {
      /* storage full/unavailable — the session stays in memory for this tab */
    }
  }

  /** Defensive parse: never trust localStorage contents. */
  private readPersisted(): PersistedSession | null {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(AUTH_SESSION_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
      const { userId, token, expiresAt } = parsed as Record<string, unknown>;
      if (typeof userId !== "string" || typeof token !== "string" || typeof expiresAt !== "string") return null;
      if (Number.isNaN(Date.parse(expiresAt))) return null;
      return { userId, token, expiresAt };
    } catch {
      return null;
    }
  }
}

function invalidCredentials(): ApiError {
  // Deliberately identical for unknown user and wrong passphrase — no enumeration.
  return new ApiError({ kind: "authentication", code: "AUTH_INVALID_CREDENTIALS", message: "ایمیل یا گذرواژه نادرست است." });
}
