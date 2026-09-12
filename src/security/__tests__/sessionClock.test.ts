// @vitest-environment jsdom
/**
 * Absolute session lifetime anchoring.
 *
 * THE BUG THIS COVERS: the absolute lifetime lived only in `localStorage`, so
 * a user who cleared site data kept a still-valid repository token but got a
 * fresh 10-hour window. The ceiling was resettable by the party it constrains.
 *
 * The fix derives the session start from the token's own `expiresAt`, which is
 * issued with the session. These tests pin that behaviour.
 *
 * This is DEMO-SIDE only. Production session expiry is the server's job.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { anchorSessionClock, clearSessionClock, resetSessionClock } from "../useIdleTimeout";

const START_KEY = "ava:session:start";
const ACTIVITY_KEY = "ava:session:activity";
const TTL = 12 * 60 * 60 * 1000; // matches SESSION_TTL_MS

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

/** ISO expiry for a token issued `agoMs` before now. */
function expiryForTokenIssued(agoMs: number): string {
  return new Date(Date.now() - agoMs + TTL).toISOString();
}

function storedStart(): number | null {
  const raw = localStorage.getItem(START_KEY);
  return raw === null ? null : Number(raw);
}

describe("resetSessionClock", () => {
  it("starts the clock at the moment of sign-in", () => {
    const before = Date.now();
    resetSessionClock();
    const start = storedStart();
    expect(start).not.toBeNull();
    expect(start!).toBeGreaterThanOrEqual(before - 50);
  });

  it("accepts an explicit session start", () => {
    const past = Date.now() - 3 * HOUR;
    resetSessionClock(past);
    expect(storedStart()).toBe(past);
  });
});

describe("anchorSessionClock — the security fix", () => {
  it("rebuilds the start time when localStorage was cleared", () => {
    // The exact attack: token still valid, but the clock is gone.
    const issuedAgo = 8 * HOUR;
    expect(storedStart()).toBeNull();

    anchorSessionClock(expiryForTokenIssued(issuedAgo), TTL);

    const start = storedStart();
    expect(start).not.toBeNull();
    // Reconstructed as ~8h ago, NOT "now".
    const ageHours = (Date.now() - start!) / HOUR;
    expect(ageHours).toBeGreaterThan(7.9);
    expect(ageHours).toBeLessThan(8.1);
  });

  it("does not grant a fresh lifetime to an old session", () => {
    anchorSessionClock(expiryForTokenIssued(9 * HOUR), TTL);
    const start = storedStart()!;
    // With a 10h absolute ceiling, a 9h-old session has ~1h left, not 10.
    const remaining = 10 * HOUR - (Date.now() - start);
    expect(remaining).toBeLessThan(1.2 * HOUR);
    expect(remaining).toBeGreaterThan(0.8 * HOUR);
  });

  it("overwrites a start time forged into the future", () => {
    // A user editing localStorage to postpone expiry.
    localStorage.setItem(START_KEY, String(Date.now() + 5 * HOUR));
    anchorSessionClock(expiryForTokenIssued(6 * HOUR), TTL);

    const start = storedStart()!;
    expect(start).toBeLessThanOrEqual(Date.now());
  });

  it("overwrites a start time newer than the token's issue time", () => {
    // The precise reset attack: delete the key, reload, get "now" written.
    const issuedAgo = 7 * HOUR;
    localStorage.setItem(START_KEY, String(Date.now())); // pretend it just started
    anchorSessionClock(expiryForTokenIssued(issuedAgo), TTL);

    const ageHours = (Date.now() - storedStart()!) / HOUR;
    expect(ageHours).toBeGreaterThan(6.9);
  });

  it("keeps a plausible stored start rather than churning it", () => {
    const issuedAgo = 4 * HOUR;
    const honest = Date.now() - issuedAgo;
    localStorage.setItem(START_KEY, String(honest));

    anchorSessionClock(expiryForTokenIssued(issuedAgo), TTL);
    expect(storedStart()).toBe(honest);
  });

  it("refreshes activity so a restore does not immediately idle out", () => {
    anchorSessionClock(expiryForTokenIssued(2 * HOUR), TTL);
    const activity = Number(localStorage.getItem(ACTIVITY_KEY));
    expect(Date.now() - activity).toBeLessThan(1000);
  });

  it("ignores an unparseable expiry instead of throwing", () => {
    expect(() => anchorSessionClock("not-a-date", TTL)).not.toThrow();
    expect(storedStart()).toBeNull();
  });
});

describe("clearSessionClock", () => {
  it("removes both timestamps on sign-out", () => {
    resetSessionClock();
    clearSessionClock();
    expect(localStorage.getItem(START_KEY)).toBeNull();
    expect(localStorage.getItem(ACTIVITY_KEY)).toBeNull();
  });
});
