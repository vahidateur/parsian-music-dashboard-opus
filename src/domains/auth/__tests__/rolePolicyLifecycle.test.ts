/**
 * Stage 15 — the role-policy projection lifecycle.
 *
 * These cases pin the contract of the single synchronization owner:
 * Loading/Fresh/Stale/Unavailable, session isolation, request generations, and
 * the API-mode permission payload (fail closed, never shipped defaults).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { toSession } from "@/domains/auth/apiAuthRepository";
import {
  beginRolePolicyRequest,
  beginRolePolicySession,
  clearRolePolicies,
  commitRolePolicy,
  endRolePolicySession,
  failRolePolicy,
  getRolePolicies,
  getRolePolicy,
  getRolePolicyState,
  invalidateRolePolicy,
  isRolePolicyTicketCurrent,
  markRolePolicyFreshFromSession,
  markRolePolicyUnavailable,
  type Permission,
  type RolePolicyRecord,
} from "@/domains/auth/permissions";
import { defaultRoleRecord } from "@/domains/auth/roleRepository";

const offline = () => new ApiError({ kind: "network", message: "offline" });

function teacher(): RolePolicyRecord {
  return defaultRoleRecord("teacher");
}

function grantedTeacher(): RolePolicyRecord {
  return { ...defaultRoleRecord("teacher"), permissions: ["library.write"], customized: true };
}

beforeEach(() => {
  clearRolePolicies();
});

afterEach(() => {
  clearRolePolicies();
  vi.restoreAllMocks();
});

describe("projection lifecycle", () => {
  it("starts a new session in Loading with no policy", () => {
    beginRolePolicySession("session-a", false);

    expect(getRolePolicyState()).toMatchObject({
      status: "loading",
      sessionKey: "session-a",
      lastSuccessfulSyncAt: null,
    });
    expect(getRolePolicies()).toEqual([]);
  });

  it("enters Fresh only after a successful validated read", () => {
    beginRolePolicySession("session-a", true);
    const ticket = beginRolePolicyRequest("session-a");
    expect(ticket).not.toBeNull();
    expect(getRolePolicyState().status).toBe("loading");

    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    expect(commitRolePolicy(ticket!, [teacher()])).toBe(true);

    expect(getRolePolicyState()).toMatchObject({
      status: "fresh",
      lastSuccessfulSyncAt: 1_000,
      error: null,
      sessionKey: "session-a",
    });
    expect(getRolePolicy("teacher")?.permissions).toEqual([...teacher().permissions]);
    now.mockRestore();
  });

  it("updates lastSuccessfulSyncAt on an unchanged successful refresh", () => {
    beginRolePolicySession("session-a", true);
    const first = beginRolePolicyRequest("session-a")!;
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    commitRolePolicy(first, [teacher()]);

    now.mockReturnValue(2_000);
    const second = beginRolePolicyRequest("session-a")!;
    expect(commitRolePolicy(second, [teacher()])).toBe(true);

    expect(getRolePolicyState()).toMatchObject({
      status: "fresh",
      lastSuccessfulSyncAt: 2_000,
    });
    expect(getRolePolicies()).toHaveLength(1);
    now.mockRestore();
  });

  it("enters Stale when a refresh fails but a last-known-good policy exists", () => {
    beginRolePolicySession("session-a", true);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    commitRolePolicy(beginRolePolicyRequest("session-a")!, [grantedTeacher()]);

    const failed = beginRolePolicyRequest("session-a")!;
    expect(failRolePolicy(failed, offline())).toBe(true);

    expect(getRolePolicyState()).toMatchObject({
      status: "stale",
      lastSuccessfulSyncAt: 1_000,
      sessionKey: "session-a",
    });
    expect(getRolePolicy("teacher")?.permissions).toEqual(["library.write"]);
    now.mockRestore();
  });

  it("enters Unavailable when the initial read fails with no snapshot", () => {
    beginRolePolicySession("session-a", false);
    const failed = beginRolePolicyRequest("session-a")!;

    expect(failRolePolicy(failed, offline())).toBe(true);

    expect(getRolePolicyState()).toMatchObject({
      status: "unavailable",
      lastSuccessfulSyncAt: null,
      sessionKey: "session-a",
    });
    expect(getRolePolicies()).toEqual([]);
  });

  it("restores Fresh from both Stale and Unavailable on a successful retry", () => {
    beginRolePolicySession("session-a", true);
    commitRolePolicy(beginRolePolicyRequest("session-a")!, [teacher()]);
    failRolePolicy(beginRolePolicyRequest("session-a")!, offline());
    expect(getRolePolicyState().status).toBe("stale");

    commitRolePolicy(beginRolePolicyRequest("session-a")!, [grantedTeacher()]);
    expect(getRolePolicyState().status).toBe("fresh");

    markRolePolicyUnavailable(offline(), "session-a");
    expect(getRolePolicyState().status).toBe("unavailable");

    commitRolePolicy(beginRolePolicyRequest("session-a")!, [teacher()]);
    expect(getRolePolicyState().status).toBe("fresh");
  });

  it("preserves Stale or Unavailable after a failed retry", () => {
    beginRolePolicySession("session-a", true);
    commitRolePolicy(beginRolePolicyRequest("session-a")!, [teacher()]);
    failRolePolicy(beginRolePolicyRequest("session-a")!, offline());
    failRolePolicy(beginRolePolicyRequest("session-a")!, offline());
    expect(getRolePolicyState().status).toBe("stale");

    markRolePolicyUnavailable(offline(), "session-a");
    failRolePolicy(beginRolePolicyRequest("session-a")!, offline());
    expect(getRolePolicyState().status).toBe("unavailable");
  });

  it("treats a session-level rebuild as last-known-good and invalidates in-flight reads", () => {
    beginRolePolicySession("session-a", true);
    const inFlight = beginRolePolicyRequest("session-a")!;

    markRolePolicyFreshFromSession("session-a");

    expect(getRolePolicyState()).toMatchObject({
      status: "fresh",
      sessionKey: "session-a",
    });
    expect(isRolePolicyTicketCurrent(inFlight)).toBe(false);
    expect(commitRolePolicy(inFlight, [grantedTeacher()])).toBe(false);
  });

  it("refuses to commit a projection outside the permission vocabulary", () => {
    beginRolePolicySession("session-a", false);
    const ticket = beginRolePolicyRequest("session-a")!;

    expect(
      commitRolePolicy(ticket, [
        { ...teacher(), permissions: ["ghost.write" as Permission] },
      ]),
    ).toBe(false);
    expect(getRolePolicies()).toEqual([]);
  });
});

describe("session isolation", () => {
  it("clears one session's policy before another session can read it", () => {
    beginRolePolicySession("session-a", true);
    commitRolePolicy(beginRolePolicyRequest("session-a")!, [grantedTeacher()]);
    expect(getRolePolicy("teacher")?.permissions).toEqual(["library.write"]);

    beginRolePolicySession("session-b", true);

    expect(getRolePolicies()).toEqual([]);
    expect(getRolePolicyState()).toMatchObject({
      status: "loading",
      sessionKey: "session-b",
      lastSuccessfulSyncAt: null,
    });
  });

  it("logout invalidates a pending request", () => {
    beginRolePolicySession("session-a", true);
    const pending = beginRolePolicyRequest("session-a")!;

    endRolePolicySession();

    expect(commitRolePolicy(pending, [grantedTeacher()])).toBe(false);
    expect(failRolePolicy(pending, offline())).toBe(false);
    expect(getRolePolicies()).toEqual([]);
    expect(getRolePolicyState()).toMatchObject({ status: "loading", sessionKey: null });
  });

  it("session expiry uses the same invalidation boundary as logout", () => {
    beginRolePolicySession("session-a", true);
    const pending = beginRolePolicyRequest("session-a")!;

    // AuthContext's expiry path calls endRolePolicySession().
    endRolePolicySession();

    expect(isRolePolicyTicketCurrent(pending)).toBe(false);
    expect(getRolePolicyState().sessionKey).toBeNull();
  });

  it("account replacement rejects the old session's late response", () => {
    beginRolePolicySession("session-a", true);
    const oldTicket = beginRolePolicyRequest("session-a")!;

    beginRolePolicySession("session-b", true);
    const newTicket = beginRolePolicyRequest("session-b")!;

    expect(commitRolePolicy(oldTicket, [grantedTeacher()])).toBe(false);
    expect(commitRolePolicy(newTicket, [teacher()])).toBe(true);
    expect(getRolePolicyState().sessionKey).toBe("session-b");
    expect(getRolePolicy("teacher")?.permissions).toEqual([...teacher().permissions]);
  });

  it("a late failure from an old request cannot downgrade a newer Fresh state", () => {
    beginRolePolicySession("session-a", true);
    const oldTicket = beginRolePolicyRequest("session-a")!;

    beginRolePolicySession("session-b", true);
    const newTicket = beginRolePolicyRequest("session-b")!;
    commitRolePolicy(newTicket, [teacher()]);

    expect(failRolePolicy(oldTicket, offline())).toBe(false);
    expect(getRolePolicyState().status).toBe("fresh");
    expect(getRolePolicyState().sessionKey).toBe("session-b");
  });
});

describe("request generations", () => {
  it("a superseded response cannot overwrite a newer response", () => {
    beginRolePolicySession("session-a", true);
    const older = beginRolePolicyRequest("session-a")!;
    const newer = beginRolePolicyRequest("session-a")!;

    expect(commitRolePolicy(newer, [grantedTeacher()])).toBe(true);
    expect(commitRolePolicy(older, [teacher()])).toBe(false);
    expect(getRolePolicy("teacher")?.permissions).toEqual(["library.write"]);
  });

  it("a stale failure cannot overwrite a newer success", () => {
    beginRolePolicySession("session-a", true);
    const older = beginRolePolicyRequest("session-a")!;
    const newer = beginRolePolicyRequest("session-a")!;
    commitRolePolicy(newer, [teacher()]);

    expect(failRolePolicy(older, offline())).toBe(false);
    expect(getRolePolicyState()).toMatchObject({ status: "fresh", error: null });
  });

  it("a mutation invalidation makes the in-flight ticket obsolete", () => {
    beginRolePolicySession("session-a", true);
    commitRolePolicy(beginRolePolicyRequest("session-a")!, [teacher()]);
    const inFlight = beginRolePolicyRequest("session-a")!;

    invalidateRolePolicy();

    expect(isRolePolicyTicketCurrent(inFlight)).toBe(false);
    expect(commitRolePolicy(inFlight, [grantedTeacher()])).toBe(false);
    expect(getRolePolicyState().status).toBe("stale");
  });

  it("deduplicates only while a ticket is still the latest for the session", () => {
    beginRolePolicySession("session-a", true);
    const ticket = beginRolePolicyRequest("session-a")!;

    expect(isRolePolicyTicketCurrent(ticket)).toBe(true);
    invalidateRolePolicy();
    expect(isRolePolicyTicketCurrent(ticket)).toBe(false);
  });
});

describe("API permission parsing", () => {
  const wire = (permissions: unknown) => ({
    user: {
      id: "usr_1",
      name: "API User",
      email: "api@test.local",
      role: "administrator",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    permissions,
    token: "token-1",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });

  it("fails closed when the server omits permissions (no shipped defaults)", () => {
    expect(() => toSession(wire(undefined))).toThrowError(
      expect.objectContaining({ code: "AUTH_BAD_PAYLOAD" }),
    );
    expect(() => toSession(wire(null))).toThrowError(
      expect.objectContaining({ code: "AUTH_BAD_PAYLOAD" }),
    );
  });

  it("keeps an explicit empty permission array empty", () => {
    expect(toSession(wire([])).permissions).toEqual([]);
  });

  it("accepts valid permission ids", () => {
    expect(toSession(wire(["students.read", "finance.write"])).permissions).toEqual([
      "students.read",
      "finance.write",
    ]);
  });

  it("drops unknown permission ids instead of granting them", () => {
    expect(toSession(wire(["students.read", "ghost.write", 42])).permissions).toEqual([
      "students.read",
    ]);
    expect(toSession(wire(["ghost.write"])).permissions).toEqual([]);
  });
});
