/**
 * Client-side login throttling and lockout.
 *
 * ⚠️ A CLIENT-SIDE THROTTLE IS NOT A SECURITY CONTROL.
 *
 * An attacker running a script does not execute this code — they POST to the
 * API directly. Everything here is defence in depth for the honest path:
 *
 *   - it stops a shared office machine being hammered by a confused user;
 *   - it makes an in-browser credential-stuffing attempt (via devtools or a
 *     malicious extension) slow and obvious;
 *   - it gives the user a truthful, calm message rather than a wall of
 *     "wrong password".
 *
 * The ENFORCING throttle is at the edge (`limit_req` in deploy/nginx.conf) and
 * in the backend, which must apply per-account and per-IP limits with an
 * exponential backoff and account lockout. That is documented as a hard
 * backend requirement in docs/security.md.
 *
 * DESIGN NOTES
 *
 * State lives in `sessionStorage`, not `localStorage`: a lockout should not
 * outlive the browser session, because the real enforcement is server-side and
 * a stale client lockout would just annoy a legitimate user on a shared PC.
 * The state is also deliberately NOT secret — a user can clear it, which is
 * fine, because it was never the thing standing between them and the account.
 */

const STORAGE_KEY = "ava:login:attempts";

/** Attempts allowed before the first delay kicks in. */
export const FREE_ATTEMPTS = 3;

/** Attempts before a hard lockout window. */
export const LOCKOUT_THRESHOLD = 8;

/** How long a hard lockout lasts. */
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Attempt history older than this is forgotten. */
const WINDOW_MS = 30 * 60 * 1000;

interface AttemptState {
  /** Epoch ms of each failed attempt inside the window. */
  failures: number[];
  /** Epoch ms when a hard lockout expires, if any. */
  lockedUntil?: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const fallback = memoryStorage();

function storage(): StorageLike {
  try {
    if (typeof sessionStorage === "undefined") return fallback;
    // Touch it: Safari in private mode throws on write, not on access.
    sessionStorage.setItem("ava:probe", "1");
    sessionStorage.removeItem("ava:probe");
    return sessionStorage;
  } catch {
    return fallback;
  }
}

function read(now: number): AttemptState {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return { failures: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { failures: [] };

    const candidate = parsed as Partial<AttemptState>;
    const failures = Array.isArray(candidate.failures)
      ? candidate.failures.filter((t): t is number => typeof t === "number" && now - t < WINDOW_MS)
      : [];
    const lockedUntil =
      typeof candidate.lockedUntil === "number" && candidate.lockedUntil > now ? candidate.lockedUntil : undefined;

    return { failures, lockedUntil };
  } catch {
    // Corrupt or tampered state must never crash the login screen.
    return { failures: [] };
  }
}

function write(state: AttemptState): void {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — throttling is best-effort by design */
  }
}

export interface ThrottleVerdict {
  /** True when an attempt may proceed right now. */
  allowed: boolean;
  /** Milliseconds the caller must wait before retrying. */
  waitMs: number;
  /** Failures recorded in the current window. */
  failures: number;
  /** True when the hard lockout window is active. */
  lockedOut: boolean;
}

/**
 * Exponential backoff after the free attempts are used.
 *
 * 4th failure → 2s, 5th → 4s, 6th → 8s, 7th → 16s, then lockout. Slow enough
 * to make scripted guessing pointless, short enough that a real person who
 * mistyped twice barely notices.
 */
function backoffFor(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const step = failures - FREE_ATTEMPTS;
  return Math.min(30_000, 2 ** step * 1000);
}

export function checkThrottle(now: number = Date.now()): ThrottleVerdict {
  const state = read(now);

  if (state.lockedUntil && state.lockedUntil > now) {
    return { allowed: false, waitMs: state.lockedUntil - now, failures: state.failures.length, lockedOut: true };
  }

  const failures = state.failures.length;
  if (failures === 0) return { allowed: true, waitMs: 0, failures: 0, lockedOut: false };

  const last = Math.max(...state.failures);
  const required = backoffFor(failures);
  const elapsed = now - last;

  if (elapsed < required) {
    return { allowed: false, waitMs: required - elapsed, failures, lockedOut: false };
  }
  return { allowed: true, waitMs: 0, failures, lockedOut: false };
}

/** Records a failed attempt and returns the verdict for the NEXT attempt. */
export function recordFailure(now: number = Date.now()): ThrottleVerdict {
  const state = read(now);
  state.failures = [...state.failures, now];

  if (state.failures.length >= LOCKOUT_THRESHOLD) {
    state.lockedUntil = now + LOCKOUT_MS;
  }
  write(state);

  return checkThrottle(now);
}

/** Clears history after a successful sign-in. */
export function clearAttempts(): void {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Persian, human wait description. */
export function describeWait(waitMs: number): string {
  const seconds = Math.ceil(waitMs / 1000);
  if (seconds < 60) return `${seconds} ثانیه`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقیقه`;
}
