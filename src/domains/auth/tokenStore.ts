/**
 * Persisted API session — the minimum needed to survive a page reload.
 *
 * WHAT IS STORED. Exactly two strings: the bearer token the backend issued and
 * its expiry. Never a password, never the user record, never the permission set
 * — identity and permissions are re-read from `GET /auth/me` on every restore,
 * so the server stays the only authority for who the caller is and what they may
 * do.
 *
 * WHERE. `sessionStorage`: it survives a reload and in-tab navigation, but it is
 * scoped to the tab and is discarded when the tab closes, so a shared machine is
 * not left signed in. When storage is unavailable (private mode, blocked
 * storage, a non-browser runtime) the store degrades to memory — the session
 * then simply does not survive a reload, which is the previous behaviour and
 * fails closed.
 *
 * TRADE-OFF (recorded, not hidden). Any script that runs in the page origin can
 * read `sessionStorage`. The production CSP (`script-src 'self'`) is the
 * mitigation; the real fix is an httpOnly cookie, which is a backend contract
 * change (governance O-12) and deliberately out of scope here.
 *
 * This module imports nothing: it is shared by the API auth implementation and
 * the registry core, and must never pull a demo module into the client build.
 */

export interface StoredApiSession {
  token: string;
  /** ISO-8601 expiry as issued by the server. */
  expiresAt: string;
}

export interface TokenStore {
  read(): StoredApiSession | null;
  write(session: StoredApiSession): void;
  clear(): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const API_SESSION_STORAGE_KEY = "ava:api:session";

/** A sanity ceiling, not a format rule: refuses absurd values from a tampered store. */
const MAX_TOKEN_LENGTH = 4096;

/** Strict parse: anything that is not exactly `{ token, expiresAt }` strings is rejected. */
function parse(raw: string): StoredApiSession | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const { token, expiresAt } = value as Record<string, unknown>;
    if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
    if (typeof expiresAt !== "string" || expiresAt.length === 0) return null;
    return { token, expiresAt };
  } catch {
    return null;
  }
}

/**
 * True when the stored expiry has passed or cannot be read. An unreadable expiry
 * is treated as expired: the app fails closed rather than trusting a value it
 * cannot interpret. (The server remains authoritative either way.)
 */
export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  const at = Date.parse(expiresAt);
  return !Number.isFinite(at) || at <= now;
}

export function createTokenStore(storage: StorageLike | null): TokenStore {
  // Mirror of the last value written, used only when `storage` is unavailable.
  let memory: StoredApiSession | null = null;

  return {
    read() {
      if (storage === null) return memory;
      try {
        const raw = storage.getItem(API_SESSION_STORAGE_KEY);
        if (raw === null) return null;
        const parsed = parse(raw);
        if (parsed === null) {
          // Corrupt or tampered: drop it so it cannot be retried on every load.
          storage.removeItem(API_SESSION_STORAGE_KEY);
          return null;
        }
        return parsed;
      } catch {
        return memory;
      }
    },
    write(session) {
      memory = { token: session.token, expiresAt: session.expiresAt };
      if (storage === null) return;
      try {
        storage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(memory));
      } catch {
        /* quota or blocked storage: the in-memory token still works for this page */
      }
    },
    clear() {
      memory = null;
      if (storage === null) return;
      try {
        storage.removeItem(API_SESSION_STORAGE_KEY);
      } catch {
        /* nothing to clean up */
      }
    },
  };
}

function browserSessionStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const probe = `${API_SESSION_STORAGE_KEY}__probe`;
    sessionStorage.setItem(probe, "1");
    sessionStorage.removeItem(probe);
    return sessionStorage;
  } catch {
    return null;
  }
}

/** The store the application uses. Tests inject their own through the constructor. */
export const defaultTokenStore: TokenStore = createTokenStore(browserSessionStorage());