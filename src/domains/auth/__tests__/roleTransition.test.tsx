// @vitest-environment jsdom
/**
 * Role policy at session transitions.
 *
 * The role-policy projection is module-scoped so synchronous gates can read it,
 * which means it outlives a session unless someone clears it. Without
 * `clearRolePolicies()` at the auth boundary, the frames between "a new session is
 * known" and "the new policy has been read" are answered from the *previous*
 * user's edits — and `useRolePolicySync` deliberately keeps the previous
 * projection on a failed read, so a role-service outage makes that leak durable
 * rather than momentary.
 *
 * These cases pin the three properties that make the difference observable:
 *  1. a cached policy from the previous session never renders under the new one;
 *  2. a failed policy read falls back to the permissions THIS session was issued;
 *  3. the route resolves without waiting for a policy read at all.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { rolePermissions, setRolePolicies } from "@/domains/auth/permissions";
import { defaultRoleRecord, type RoleRepository } from "@/domains/auth/roleRepository";
import type { AuthRepository } from "@/domains/auth/repository";
import type { AuthUser, Session } from "@/domains/auth/types";
import { useRolePolicySync } from "@/domains/auth/useRoles";
import { resetRegistry, setRoleRepository } from "@/domains/registry";
import type { Page } from "@/api/types";
import type { RolePolicyRecord } from "@/domains/auth/permissions";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function session(id: string, role: AuthUser["role"]): Session {
  const now = new Date("2026-09-24T09:00:00.000Z");
  return {
    user: {
      id,
      name: role,
      email: `${role}@test.local`,
      role,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    permissions: [...rolePermissions[role]],
    token: `token-${id}`,
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  };
}

class TransitionAuthRepository implements AuthRepository {
  private current = session("manager-1", "manager");

  restore = vi.fn(async () => this.current);

  login = vi.fn(async () => {
    this.current = session("teacher-1", "teacher");
    return this.current;
  });

  logout = vi.fn(async () => undefined);

  me = vi.fn(async () => this.current);
}

function rolePage(records: RolePolicyRecord[]): Page<RolePolicyRecord> {
  return { data: records, meta: { page: 1, per_page: records.length, total: records.length } };
}

function Probe() {
  useRolePolicySync();
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="role">{auth.user?.role ?? "-"}</span>
      <span data-testid="library-route">{String(auth.canAccess("library"))}</span>
      <span data-testid="gallery-route">{String(auth.canAccess("gallery"))}</span>
      <span data-testid="library-write">{String(auth.can("library.write"))}</span>
      <button onClick={() => void auth.login({ email: "teacher@test.local", password: "irrelevant" })}>teacher</button>
    </div>
  );
}

function staleTeacherPolicy(): RolePolicyRecord {
  return {
    ...defaultRoleRecord("teacher"),
    // A previous session's edited policy deliberately removes read and grants
    // write, which makes stale-cache leakage observable in both directions.
    permissions: ["library.write"],
    customized: true,
  };
}

beforeEach(() => {
  setRolePolicies([]);
  resetRegistry();
});

afterEach(() => {
  cleanup();
  setRolePolicies([]);
  resetRegistry();
});

describe("role policy at session transitions", () => {
  it("does not render a previous user's cached teacher policy during a delayed refresh", async () => {
    const policyRead = deferred<Page<RolePolicyRecord>>();
    const roles: RoleRepository = {
      list: vi.fn(() => policyRead.promise),
      get: vi.fn(),
      update: vi.fn(),
      reset: vi.fn(),
    } as unknown as RoleRepository;
    setRoleRepository(roles);

    const auth = new TransitionAuthRepository();
    render(<AuthProvider repository={auth}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));

    // The manager session is the previous user. Simulate its already-loaded
    // module projection before switching to teacher.
    setRolePolicies([staleTeacherPolicy()]);
    fireEvent.click(screen.getByText("teacher"));

    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("teacher"));
    expect(screen.getByTestId("library-route").textContent).toBe("true");
    expect(screen.getByTestId("gallery-route").textContent).toBe("true");
    expect(screen.getByTestId("library-write").textContent).toBe("false");

    policyRead.resolve(rolePage([defaultRoleRecord("teacher")]));
    await waitFor(() => expect(screen.getByTestId("library-route").textContent).toBe("true"));
    expect(screen.getByTestId("library-write").textContent).toBe("false");
  });

  it("falls back to the new teacher session permissions when policy loading fails", async () => {
    const policyRead = deferred<Page<RolePolicyRecord>>();
    const roles: RoleRepository = {
      list: vi.fn(() => policyRead.promise),
      get: vi.fn(),
      update: vi.fn(),
      reset: vi.fn(),
    } as unknown as RoleRepository;
    setRoleRepository(roles);

    const auth = new TransitionAuthRepository();
    render(<AuthProvider repository={auth}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));
    setRolePolicies([staleTeacherPolicy()]);
    fireEvent.click(screen.getByText("teacher"));

    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("teacher"));
    policyRead.reject(new Error("role service unavailable"));
    await waitFor(() => expect(screen.getByTestId("library-route").textContent).toBe("true"));
    expect(screen.getByTestId("gallery-route").textContent).toBe("true");
    expect(screen.getByTestId("library-write").textContent).toBe("false");
  });

  it("does not require a cached policy to resolve the teacher route", async () => {
    const roles: RoleRepository = {
      list: vi.fn(async () => rolePage([defaultRoleRecord("teacher")])),
      get: vi.fn(),
      update: vi.fn(),
      reset: vi.fn(),
    } as unknown as RoleRepository;
    setRoleRepository(roles);

    const auth = new TransitionAuthRepository();
    render(<AuthProvider repository={auth}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));
    fireEvent.click(screen.getByText("teacher"));

    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("teacher"));
    expect(screen.getByTestId("library-route").textContent).toBe("true");
    expect(screen.getByTestId("gallery-route").textContent).toBe("true");
    expect(screen.getByTestId("library-write").textContent).toBe("false");
  });
});
