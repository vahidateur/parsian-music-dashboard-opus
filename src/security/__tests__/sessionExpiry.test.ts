// @vitest-environment jsdom
/**
 * Idle policy constants and the cross-tab session-end broadcast.
 *
 * The approved policy is 30 minutes idle with a 2-minute warning and a
 * 10-hour absolute ceiling (server-enforced; the browser countdown is UX).
 * These tests pin the numbers and the broadcast contract: a reasoned,
 * parseable payload the AuthProvider's storage listener consumes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  ABSOLUTE_SESSION_MS,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  notifySessionEnded,
  readSessionEnded,
  SESSION_ENDED_KEY,
} from "../useIdleTimeout";

beforeEach(() => {
  localStorage.clear();
});

describe("idle policy constants", () => {
  it("waits 30 minutes of inactivity with a 2-minute warning", () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
    expect(IDLE_WARNING_MS).toBe(2 * 60 * 1000);
  });

  it("caps a session at 10 hours regardless of activity", () => {
    expect(ABSOLUTE_SESSION_MS).toBe(10 * 60 * 60 * 1000);
  });
});

describe("session-end broadcast", () => {
  it("writes a reasoned payload other tabs can read", () => {
    notifySessionEnded("absolute");
    expect(readSessionEnded()).toBe("absolute");
    expect(localStorage.getItem(SESSION_ENDED_KEY)).toContain("absolute");
  });

  it("reads back every reason", () => {
    notifySessionEnded("idle");
    expect(readSessionEnded()).toBe("idle");
    notifySessionEnded("logout");
    expect(readSessionEnded()).toBe("logout");
  });

  it("treats a missing or tampered broadcast as nothing", () => {
    expect(readSessionEnded()).toBeNull();
    localStorage.setItem(SESSION_ENDED_KEY, "not-json");
    expect(readSessionEnded()).toBeNull();
    localStorage.setItem(SESSION_ENDED_KEY, JSON.stringify({ reason: "bogus" }));
    expect(readSessionEnded()).toBeNull();
  });
});
