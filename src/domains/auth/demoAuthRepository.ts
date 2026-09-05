import { ApiError } from "@/api/errors";
import { isDemoMode } from "@/api/config";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { permissionsForRole } from "./permissions";
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

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

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

/** Non-cryptographic reference id. Explicitly NOT a security token. */
function demoToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
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

export class DemoAuthRepository implements AuthRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly storage: SessionStorageLike = browserStorage() ?? memory(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async login({ email, password }: LoginInput): Promise<Session> {
    const target = normalizeEmail(email);
    if (!target || !password) {
      throw new ApiError({ kind: "validation", code: "AUTH_MISSING_FIELDS", message: "ایمیل و گذرواژه الزامی است." });
    }
    if (password !== DEMO_PASSPHRASE) {
      throw invalidCredentials();
    }

    const user = this.store.snapshot().users.find((u) => normalizeEmail(u.email) === target);
    if (!user) throw invalidCredentials();
    if (user.status !== "active") {
      throw new ApiError({ kind: "authorization", code: "AUTH_USER_DISABLED", message: "این حساب غیرفعال است." });
    }

    const session = this.sessionFor(user, demoToken(), new Date(this.now() + SESSION_TTL_MS).toISOString());
    this.persist({ userId: user.id, token: session.token, expiresAt: session.expiresAt });
    return session;
  }

  async logout(): Promise<void> {
    this.storage.removeItem(AUTH_SESSION_KEY);
  }

  async restore(): Promise<Session | null> {
    const persisted = this.readPersisted();
    if (!persisted) return null;

    if (Date.parse(persisted.expiresAt) <= this.now()) {
      this.storage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    // The user list is authoritative: a user deleted/disabled since login
    // must not keep a working session.
    const user = this.store.snapshot().users.find((u) => u.id === persisted.userId);
    if (!user || user.status !== "active") {
      this.storage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return this.sessionFor(user, persisted.token, persisted.expiresAt);
  }

  async me(): Promise<Session> {
    const session = await this.restore();
    if (!session) throw new ApiError({ kind: "authentication", code: "AUTH_NO_SESSION", message: "نشست معتبری وجود ندارد." });
    return session;
  }

  private sessionFor(user: AuthUser, token: string, expiresAt: string): Session {
    return { user, permissions: permissionsForRole(user.role), token, expiresAt };
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
