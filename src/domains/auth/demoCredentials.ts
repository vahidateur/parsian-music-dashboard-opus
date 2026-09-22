/**
 * Demo credentials — deliberately NOT part of the dataset.
 *
 * The panel's local environment can set a per-account passphrase, because an
 * academy that cannot change how its staff sign in is not managing its staff.
 * What it must not do is turn that passphrase into academy DATA: the dataset is
 * what a backup exports, what an import restores and what an inspector reads,
 * and a credential has no business travelling inside any of those.
 *
 * So the value lives under its own key, beside the environment's lifecycle
 * marker rather than beside the records — the same split the store already makes
 * between "what kind of environment is this" and "what does the academy hold".
 * Deleting a user, resetting the environment or restoring a backup never carries
 * a passphrase with it.
 *
 * SECURITY: this is a local, client-side convenience and nothing more. Anyone
 * with the browser can read or edit it, exactly as they can edit the session.
 * Real credential storage — hashing, rotation, lockout — is the server's job
 * (`ApiUserRepository.setPassword` posts to it; see docs/security.md).
 */
import type { StorageLike } from "@/services/demoStore";

export const DEMO_CREDENTIALS_KEY = "ava:demo:credentials";

/** Shortest passphrase the panel accepts. Long enough to not be a formality. */
export const MIN_PASSPHRASE_LENGTH = 6;

interface CredentialMap {
  [userId: string]: string;
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const probe = `${DEMO_CREDENTIALS_KEY}__probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function memory(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** Reads the map defensively: storage is user-editable and may hold garbage. */
function read(storage: StorageLike): CredentialMap {
  try {
    const raw = storage.getItem(DEMO_CREDENTIALS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: CredentialMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && key !== "__proto__") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function write(storage: StorageLike, value: CredentialMap): void {
  try {
    storage.setItem(DEMO_CREDENTIALS_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable — the account keeps the shared demo passphrase */
  }
}

export interface DemoCredentialStore {
  /** The passphrase set for this account, or null when it uses the shared one. */
  get(userId: string): string | null;
  set(userId: string, passphrase: string): void;
  clear(userId: string): void;
  /** True when this account has its own passphrase. */
  has(userId: string): boolean;
}

export function demoCredentialStore(storage: StorageLike = browserStorage() ?? memory()): DemoCredentialStore {
  return {
    get: (userId) => read(storage)[userId] ?? null,
    set: (userId, passphrase) => {
      const map = read(storage);
      map[userId] = passphrase;
      write(storage, map);
    },
    clear: (userId) => {
      const map = read(storage);
      delete map[userId];
      write(storage, map);
    },
    has: (userId) => read(storage)[userId] !== undefined,
  };
}

/** A passphrase must be long enough to be worth calling one. */
export function isAcceptablePassphrase(value: string): boolean {
  return value.trim().length >= MIN_PASSPHRASE_LENGTH;
}
