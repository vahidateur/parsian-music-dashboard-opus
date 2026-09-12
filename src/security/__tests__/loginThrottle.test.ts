// @vitest-environment jsdom
/**
 * Login throttling.
 *
 * Time is injected everywhere so these tests are deterministic — a throttle
 * tested with real timers is a slow, flaky test that eventually gets deleted.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  FREE_ATTEMPTS,
  LOCKOUT_MS,
  LOCKOUT_THRESHOLD,
  checkThrottle,
  clearAttempts,
  describeWait,
  recordFailure,
} from "../loginThrottle";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  sessionStorage.clear();
  clearAttempts();
});

describe("free attempts", () => {
  it("allows the first attempt with no delay", () => {
    const verdict = checkThrottle(T0);
    expect(verdict.allowed).toBe(true);
    expect(verdict.waitMs).toBe(0);
  });

  it("does not delay a user who mistypes a couple of times", () => {
    for (let i = 0; i < FREE_ATTEMPTS; i += 1) recordFailure(T0 + i);
    expect(checkThrottle(T0 + FREE_ATTEMPTS).allowed).toBe(true);
  });
});

describe("exponential backoff", () => {
  it("starts delaying once the free attempts are spent", () => {
    for (let i = 0; i <= FREE_ATTEMPTS; i += 1) recordFailure(T0);
    const verdict = checkThrottle(T0);
    expect(verdict.allowed).toBe(false);
    expect(verdict.waitMs).toBeGreaterThan(0);
  });

  it("doubles the wait with each further failure", () => {
    for (let i = 0; i <= FREE_ATTEMPTS; i += 1) recordFailure(T0);
    const first = checkThrottle(T0).waitMs;

    recordFailure(T0);
    const second = checkThrottle(T0).waitMs;

    expect(second).toBeGreaterThan(first);
    expect(second).toBe(Math.min(30_000, first * 2));
  });

  it("caps the wait so a legitimate user is never stuck for minutes", () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i += 1) recordFailure(T0);
    expect(checkThrottle(T0).waitMs).toBeLessThanOrEqual(30_000);
  });

  it("allows the attempt once the wait has elapsed", () => {
    for (let i = 0; i <= FREE_ATTEMPTS; i += 1) recordFailure(T0);
    const { waitMs } = checkThrottle(T0);
    expect(checkThrottle(T0 + waitMs).allowed).toBe(true);
  });
});

describe("hard lockout", () => {
  it("locks out after the threshold", () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) recordFailure(T0);
    const verdict = checkThrottle(T0);
    expect(verdict.lockedOut).toBe(true);
    expect(verdict.allowed).toBe(false);
  });

  it("expires the lockout on schedule", () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) recordFailure(T0);
    expect(checkThrottle(T0 + LOCKOUT_MS - 1).lockedOut).toBe(true);
    // Once the window passes the attempt history is also outside its own
    // window, so the user starts clean.
    expect(checkThrottle(T0 + LOCKOUT_MS + 1).allowed).toBe(true);
  });
});

describe("recovery", () => {
  it("forgets failures older than the tracking window", () => {
    for (let i = 0; i <= FREE_ATTEMPTS; i += 1) recordFailure(T0);
    expect(checkThrottle(T0).allowed).toBe(false);

    // 31 minutes later the history has aged out.
    expect(checkThrottle(T0 + 31 * 60 * 1000).allowed).toBe(true);
  });

  it("resets completely after a successful sign-in", () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) recordFailure(T0);
    expect(checkThrottle(T0).lockedOut).toBe(true);

    clearAttempts();
    const verdict = checkThrottle(T0);
    expect(verdict.allowed).toBe(true);
    expect(verdict.failures).toBe(0);
  });
});

describe("resilience", () => {
  it("treats corrupt stored state as no history rather than crashing", () => {
    sessionStorage.setItem("ava:login:attempts", "{not json");
    expect(() => checkThrottle(T0)).not.toThrow();
    expect(checkThrottle(T0).allowed).toBe(true);
  });

  it("ignores tampered fields", () => {
    // A user editing sessionStorage can only ever unlock themselves, which is
    // fine: the server-side limit is the real control.
    sessionStorage.setItem("ava:login:attempts", JSON.stringify({ failures: "lots", lockedUntil: "forever" }));
    expect(checkThrottle(T0).allowed).toBe(true);
  });

  it("does not persist a lockout across browser sessions", () => {
    // sessionStorage, not localStorage — asserted so a future change to
    // localStorage is a deliberate decision, not an accident.
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) recordFailure(T0);
    expect(sessionStorage.getItem("ava:login:attempts")).not.toBeNull();
    expect(localStorage.getItem("ava:login:attempts")).toBeNull();
  });
});

describe("messaging", () => {
  it("describes waits in Persian-friendly units", () => {
    expect(describeWait(4000)).toBe("4 ثانیه");
    expect(describeWait(90_000)).toBe("2 دقیقه");
  });
});
