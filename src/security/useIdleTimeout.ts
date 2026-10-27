/**
 * Idle timeout and absolute session lifetime.
 *
 * WHY BOTH
 *
 * An idle timeout protects the common real-world failure: a receptionist walks
 * away from an unlocked machine at a front desk that students and parents
 * stand next to. An absolute lifetime bounds the damage from a stolen session
 * that is being kept alive by an attacker's activity — idle timeout alone
 * never fires in that case.
 *
 * SCOPE
 *
 * This signs the user out in the BROWSER. It is a usability control, not the
 * security boundary: the server enforces its own idle (30 min) and absolute
 * (10 h) ceilings independently and rejects expired tokens afterwards, so an
 * attacker who copied a token cannot keep using it past those ceilings. The
 * browser countdown exists so a human is warned first and never loses work
 * to a surprise sign-out.
 *
 * Cross-tab: every tab polls the shared localStorage clock each second, so
 * activity in one tab is visible to the others within a second; session END
 * is pushed immediately through a `storage` event (see notifySessionEnded)
 * so all tabs sign out together instead of waiting for their next poll.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Inactivity before automatic sign-out. Mirrors the server idle ceiling. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Warning shown this long before the timeout fires. */
export const IDLE_WARNING_MS = 2 * 60 * 1000;

/**
 * Hard ceiling on a session regardless of activity.
 *
 * A working day plus a margin. Anyone still on shift re-authenticates once.
 */
export const ABSOLUTE_SESSION_MS = 10 * 60 * 60 * 1000;

const ACTIVITY_KEY = "ava:session:activity";
const START_KEY = "ava:session:start";

/** Broadcast when a session ends, so every tab signs out together at once. */
export const SESSION_ENDED_KEY = "ava:session:ended";

export type SessionEndReason = "idle" | "absolute" | "logout";

/**
 * Announces a session end to every other tab of this browser. `storage`
 * events do not fire in the tab that wrote the key, so the writer never
 * double-handles its own broadcast; receivers whose stored value is missing
 * or unreadable ignore it (their next clock poll ends the session anyway).
 */
export function notifySessionEnded(reason: SessionEndReason): void {
  try {
    localStorage.setItem(SESSION_ENDED_KEY, JSON.stringify({ at: Date.now(), reason }));
  } catch {
    /* private mode or quota — the local poll still signs this tab out */
  }
}

/** Reads a session-end broadcast; null when absent or tampered. */
export function readSessionEnded(): SessionEndReason | null {
  try {
    const raw = localStorage.getItem(SESSION_ENDED_KEY);
    if (!raw) return null;
    const reason = (JSON.parse(raw) as { reason?: unknown }).reason;
    return reason === "idle" || reason === "absolute" || reason === "logout" ? reason : null;
  } catch {
    return null;
  }
}

/** Events that count as the user being present. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "visibilitychange"] as const;

/** Writes are coalesced: a keystroke should not hit storage 60×/second. */
const WRITE_THROTTLE_MS = 5_000;

function readTimestamp(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeTimestamp(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode or quota — the in-memory timer still runs */
  }
}

export interface IdleState {
  /** True while the pre-expiry warning should be shown. */
  warning: boolean;
  /** Milliseconds until automatic sign-out; null when not warning. */
  remainingMs: number | null;
  /** Dismisses the warning and restarts the countdown. */
  stayActive: () => void;
}

export function useIdleTimeout({
  enabled,
  onTimeout,
  idleMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  absoluteMs = ABSOLUTE_SESSION_MS,
}: {
  enabled: boolean;
  onTimeout: (reason: "idle" | "absolute") => void;
  idleMs?: number;
  warningMs?: number;
  absoluteMs?: number;
}): IdleState {
  const [warning, setWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastWrite = useRef(0);
  // Held in a ref so the polling effect never needs to re-subscribe.
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  const markActive = useCallback(() => {
    const now = Date.now();
    if (now - lastWrite.current < WRITE_THROTTLE_MS) return;
    lastWrite.current = now;
    writeTimestamp(ACTIVITY_KEY, now);
    setWarning(false);
    setRemainingMs(null);
  }, []);

  const stayActive = useCallback(() => {
    lastWrite.current = 0;
    markActive();
  }, [markActive]);

  useEffect(() => {
    if (!enabled) {
      setWarning(false);
      setRemainingMs(null);
      return;
    }

    // Establish the session start once; a reload must not extend it, or the
    // absolute lifetime becomes meaningless.
    if (readTimestamp(START_KEY) === null) writeTimestamp(START_KEY, Date.now());
    writeTimestamp(ACTIVITY_KEY, Date.now());

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    // One-second poll rather than a chain of setTimeouts: a laptop that sleeps
    // does not fire pending timers, and on wake we must notice immediately
    // that the session should already have ended.
    const tick = window.setInterval(() => {
      const now = Date.now();

      const start = readTimestamp(START_KEY);
      if (start !== null && now - start >= absoluteMs) {
        timeoutRef.current("absolute");
        return;
      }

      const last = readTimestamp(ACTIVITY_KEY) ?? now;
      const idleFor = now - last;

      if (idleFor >= idleMs) {
        timeoutRef.current("idle");
        return;
      }
      if (idleFor >= idleMs - warningMs) {
        setWarning(true);
        setRemainingMs(idleMs - idleFor);
      } else if (idleFor < idleMs - warningMs) {
        setWarning(false);
        setRemainingMs(null);
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
      window.clearInterval(tick);
    };
  }, [enabled, idleMs, warningMs, absoluteMs, markActive]);

  return { warning, remainingMs, stayActive };
}

/**
 * Starts a fresh session clock. Called on sign-in.
 *
 * `sessionStart` should be the moment the SESSION began, not the moment this
 * function ran. On restore the two differ, and using "now" would hand a
 * restored session a brand-new absolute lifetime.
 */
export function resetSessionClock(sessionStart: number = Date.now()): void {
  writeTimestamp(START_KEY, sessionStart);
  writeTimestamp(ACTIVITY_KEY, Date.now());
}

/**
 * Re-anchors the absolute clock for a session restored from storage.
 *
 * THE BUG THIS FIXES: the absolute lifetime lived only in `localStorage`. A
 * user who cleared site data (or an attacker who deleted that one key) kept a
 * still-valid repository token but got a fresh 10-hour window — the ceiling
 * was trivially resettable by the party it constrains.
 *
 * The fix anchors to the token's own `expiresAt`, which is issued with the
 * session and is not editable without invalidating it in demo mode. When the
 * stored start is missing or implausible (in the future, or older than the
 * token allows) it is rebuilt by working backwards from that expiry.
 *
 * DEMO-SIDE ONLY. In production the server owns session expiry and must reject
 * the token itself; this merely stops the browser-side ceiling being a lie.
 */
export function anchorSessionClock(expiresAtIso: string, tokenTtlMs: number): void {
  const expiresAt = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAt)) return;

  const issuedAt = expiresAt - tokenTtlMs;
  const stored = readTimestamp(START_KEY);
  const now = Date.now();

  // Trust the stored value only if it is consistent with the token: not in the
  // future, and not newer than the token's issue time (which would mean the
  // clock was restarted after the session began).
  const plausible = stored !== null && stored <= now && stored <= issuedAt + 1000;
  if (!plausible) writeTimestamp(START_KEY, issuedAt);

  writeTimestamp(ACTIVITY_KEY, now);
}

export function clearSessionClock(): void {
  try {
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(START_KEY);
    localStorage.removeItem(SESSION_ENDED_KEY);
  } catch {
    /* nothing to clean up */
  }
}
