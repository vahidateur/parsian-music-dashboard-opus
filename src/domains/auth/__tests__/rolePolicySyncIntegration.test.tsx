// @vitest-environment jsdom
/**
 * Stage 15 — synchronization ownership, mutation invalidation, and the
 * AuthContext/shell contract. Real hooks + real repository seams; no assertion
 * on internal counters beyond the observable lifecycle and repository calls.
 */
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { PolicyUnavailableBanner } from "@/domains/auth/PolicyUnavailableBanner";
import {
  beginRolePolicyRequest,
  beginRolePolicySession,
  clearRolePolicies,
  commitRolePolicy,
  getRolePolicies,
  getRolePolicyState,
  markRolePolicyUnavailable,
  type Permission,
  type RolePolicyRecord,
} from "@/domains/auth/permissions";
import { defaultRoleRecord, type RoleRepository } from "@/domains/auth/roleRepository";
import type { AuthRepository } from "@/domains/auth/repository";
import type { Session } from "@/domains/auth/types";
import { useRolePolicySync, useRoles } from "@/domains/auth/useRoles";
import { resetRegistry, setRoleRepository } from "@/domains/registry";

function page(records: RolePolicyRecord[]): Page<RolePolicyRecord> {
  return { data: records, meta: { page: 1, per_page: records.length, total: records.length } };
}

function teacher(permissions: Permission[] = ["students.read"]): RolePolicyRecord {
  return { ...defaultRoleRecord("teacher"), permissions, customized: true };
}

function session(token: string, permissions: Permission[] = ["students.read"]): Session {
  return {
    user: {
      id: "usr_teacher",
      name: "Teacher",
      email: "teacher@test.local",
      role: "teacher",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    permissions,
    token,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function authRepository(restored: Session | null): AuthRepository {
  return {
    restore: vi.fn(async () => restored),
    restoreDetailed: vi.fn(async () => ({ session: restored, expiredReason: null })),
    login: vi.fn(),
    logout: vi.fn(async () => undefined),
    me: vi.fn(),
  } as unknown as AuthRepository;
}

function roleRepository(overrides: Partial<RoleRepository>): RoleRepository {
  return {
    list: vi.fn(async () => page([])),
    get: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  } as unknown as RoleRepository;
}

function SyncStatus({ label }: { label: string }) {
  const { state } = useRolePolicySync();
  return <span data-testid={label}>{state.status}</span>;
}

function AuthProbe() {
  const { state, refresh } = useRolePolicySync();
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="policy-status">{state.status}</span>
      <span data-testid="policy-session">{state.sessionKey ?? "-"}</span>
      <span data-testid="permissions">{String(auth.permissions.length)}</span>
      <span data-testid="finance">{String(auth.can("finance.write"))}</span>
      <span data-testid="library">{String(auth.can("library.write"))}</span>
      <button onClick={refresh}>refresh</button>
      <PolicyUnavailableBanner />
    </div>
  );
}

beforeEach(() => {
  clearRolePolicies();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  clearRolePolicies();
  resetRegistry();
});

describe("one synchronization owner", () => {
  it("deduplicates concurrent consumers of the same session", async () => {
    beginRolePolicySession("token-dedupe", true);
    let resolveRead!: (value: Page<RolePolicyRecord>) => void;
    const read = new Promise<Page<RolePolicyRecord>>((resolve) => {
      resolveRead = resolve;
    });
    const roles = roleRepository({ list: vi.fn(() => read) });
    setRoleRepository(roles);

    render(
      <>
        <SyncStatus label="a" />
        <SyncStatus label="b" />
      </>,
    );

    await waitFor(() => expect(roles.list).toHaveBeenCalledTimes(1));
    resolveRead(page([teacher()]));

    await waitFor(() => {
      expect(screen.getByTestId("a").textContent).toBe("fresh");
      expect(screen.getByTestId("b").textContent).toBe("fresh");
    });
    expect(roles.list).toHaveBeenCalledTimes(1);
  });

  it("deduplicates a StrictMode remount into one projection write", async () => {
    beginRolePolicySession("token-strict", true);
    const roles = roleRepository({
      list: vi.fn().mockResolvedValue(page([teacher(["students.read"])])),
    });
    setRoleRepository(roles);

    render(
      <StrictMode>
        <SyncStatus label="status" />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("fresh"));
    expect(roles.list).toHaveBeenCalledTimes(1);
    expect(getRolePolicies()[0]?.permissions).toEqual(["students.read"]);
  });

  it("treats an invalid permission vocabulary as unavailable", async () => {
    beginRolePolicySession("token-invalid", false);
    const roles = roleRepository({
      list: vi.fn(async () =>
        page([{ ...defaultRoleRecord("teacher"), permissions: ["ghost.write" as Permission] }]),
      ),
    });
    setRoleRepository(roles);

    render(<SyncStatus label="status" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unavailable"));
    expect(getRolePolicies()).toEqual([]);
  });

  it("settles a latest-request cancellation instead of staying refreshing", async () => {
    beginRolePolicySession("token-cancelled", false);
    const roles = roleRepository({
      list: vi.fn(async () => {
        throw new ApiError({ kind: "cancelled", message: "aborted" });
      }),
    });
    setRoleRepository(roles);

    render(<SyncStatus label="status" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unavailable"));
    expect(getRolePolicyState().refreshing).toBe(false);
  });
});

describe("AuthContext consumes a session-scoped snapshot", () => {
  it("uses a Fresh projection for the current session", async () => {
    const auth = authRepository(session("token-fresh", []));
    setRoleRepository(roleRepository({ list: vi.fn(async () => page([teacher(["library.write"])])) }));

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("policy-session").textContent).toBe("token-fresh");
    expect(screen.getByTestId("permissions").textContent).toBe("1");
    expect(screen.getByTestId("library").textContent).toBe("true");
  });

  it("never applies another session's projection to the current session", async () => {
    const auth = authRepository(session("token-current", ["students.read"]));
    setRoleRepository(
      roleRepository({ list: vi.fn(() => new Promise<Page<RolePolicyRecord>>(() => undefined)) }),
    );

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("library").textContent).toBe("false");

    act(() => {
      beginRolePolicySession("token-other", true);
      commitRolePolicy(beginRolePolicyRequest("token-other")!, [teacher(["library.write"])]);
    });

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("policy-session").textContent).toBe("token-other");
    // The foreign projection grants library.write, but it is not this session's.
    expect(screen.getByTestId("library").textContent).toBe("false");
    expect(screen.getByTestId("permissions").textContent).toBe("1");
  });

  it("keeps permissions empty when the current session's policy is Unavailable", async () => {
    const auth = authRepository(session("token-unavailable", ["students.read"]));
    const roles = roleRepository({
      list: vi.fn(() => new Promise<Page<RolePolicyRecord>>(() => undefined)),
    });
    setRoleRepository(roles);

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    act(() => {
      markRolePolicyUnavailable(
        new ApiError({ kind: "server", code: "ROLE_POLICY_INVALID", message: "invalid" }),
        "token-unavailable",
      );
    });

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("unavailable"));
    expect(screen.getByTestId("permissions").textContent).toBe("0");
    expect(screen.getByTestId("finance").textContent).toBe("false");
    expect(await screen.findByText("قواعد دسترسی در دسترس نیست")).toBeTruthy();
  });
});

describe("shell disclosure", () => {
  it("shows a stale warning, keeps last-known-good, and clears it on a successful retry", async () => {
    const auth = authRepository(session("token-stale", ["students.read"]));
    const roles = roleRepository({
      list: vi
        .fn()
        .mockResolvedValueOnce(page([teacher(["finance.write"])]))
        .mockRejectedValueOnce(new ApiError({ kind: "network", message: "offline" }))
        .mockResolvedValueOnce(page([teacher(["library.write"])])),
    });
    setRoleRepository(roles);

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("finance").textContent).toBe("true");
    expect(screen.queryByText("قواعد دسترسی به‌روزرسانی نشد")).toBeNull();

    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("stale"));
    expect(await screen.findByText("قواعد دسترسی به‌روزرسانی نشد")).toBeTruthy();
    // Last-known-good still grants what was verified, not the shipped default.
    expect(screen.getByTestId("finance").textContent).toBe("true");

    fireEvent.click(screen.getByText("بررسی دوباره"));

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    await waitFor(() =>
      expect(screen.queryByText("قواعد دسترسی به‌روزرسانی نشد")).toBeNull(),
    );
    expect(screen.getByTestId("finance").textContent).toBe("false");
    expect(screen.getByTestId("library").textContent).toBe("true");
  });

  it("keeps a failed stale retry visible", async () => {
    const auth = authRepository(session("token-stale-retry", ["students.read"]));
    const roles = roleRepository({
      list: vi
        .fn()
        .mockResolvedValueOnce(page([teacher(["finance.write"])]))
        .mockRejectedValue(new ApiError({ kind: "network", message: "offline" })),
    });
    setRoleRepository(roles);

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("stale"));

    fireEvent.click(screen.getByText("بررسی دوباره"));
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("stale"));
    expect(screen.getByText("قواعد دسترسی به‌روزرسانی نشد")).toBeTruthy();
    expect(screen.getByTestId("finance").textContent).toBe("true");
  });

  it("recovers from Unavailable with the authoritative retry", async () => {
    const auth = authRepository(session("token-unavailable-retry", ["students.read"]));
    const roles = roleRepository({
      list: vi
        .fn()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValueOnce(page([teacher(["finance.write"])])),
    });
    setRoleRepository(roles);

    render(
      <AuthProvider repository={auth}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    act(() => {
      markRolePolicyUnavailable(
        new ApiError({ kind: "server", code: "ROLE_POLICY_INVALID", message: "invalid" }),
        "token-unavailable-retry",
      );
    });
    expect(await screen.findByText("قواعد دسترسی در دسترس نیست")).toBeTruthy();

    fireEvent.click(screen.getByText("بررسی دوباره"));

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    await waitFor(() =>
      expect(screen.queryByText("قواعد دسترسی در دسترس نیست")).toBeNull(),
    );
    expect(screen.getByTestId("finance").textContent).toBe("true");
  });
});

describe("role mutations", () => {
  function MutationProbe() {
    const roles = useRoles();
    const { state } = useRolePolicySync();
    return (
      <div>
        <span data-testid="policy-status">{state.status}</span>
        <span data-testid="permissions">{roles.roles[0]?.permissions.join(",") || "-"}</span>
        <button onClick={() => void roles.update("teacher", { permissions: ["library.write"] })}>
          grant
        </button>
        <button onClick={() => void roles.update("teacher", { permissions: [] })}>revoke</button>
      </div>
    );
  }

  it("invalidates a successful grant, then republishes only the authoritative re-read", async () => {
    beginRolePolicySession("token-grant", true);
    let current = [teacher(["students.read"])];
    let holdNextRead = false;
    let releaseRead!: (value: Page<RolePolicyRecord>) => void;
    const read = () => {
      if (holdNextRead) {
        holdNextRead = false;
        return new Promise<Page<RolePolicyRecord>>((resolve) => {
          releaseRead = resolve;
        });
      }
      return Promise.resolve(page(current));
    };
    const roles = roleRepository({
      list: vi.fn(read),
      update: vi.fn(async (_id, input) => {
        current = [teacher(input.permissions ?? ["students.read"])];
        holdNextRead = true;
        return current[0];
      }),
    });
    setRoleRepository(roles);

    render(<MutationProbe />);
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("permissions").textContent).toBe("students.read");

    fireEvent.click(screen.getByText("grant"));

    // The write succeeds, but the old matrix is no longer presented as fresh.
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("stale"));

    act(() => releaseRead(page(current)));
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("permissions").textContent).toBe("library.write");
  });

  it("invalidates a successful revocation, then republishes only the authoritative re-read", async () => {
    beginRolePolicySession("token-revoke", true);
    let current = [teacher(["library.write"])];
    let holdNextRead = false;
    let releaseRead!: (value: Page<RolePolicyRecord>) => void;
    const roles = roleRepository({
      list: vi.fn(() => {
        if (holdNextRead) {
          holdNextRead = false;
          return new Promise<Page<RolePolicyRecord>>((resolve) => {
            releaseRead = resolve;
          });
        }
        return Promise.resolve(page(current));
      }),
      update: vi.fn(async () => {
        current = [teacher([])];
        holdNextRead = true;
        return current[0];
      }),
    });
    setRoleRepository(roles);

    render(<MutationProbe />);
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("permissions").textContent).toBe("library.write");

    fireEvent.click(screen.getByText("revoke"));

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("stale"));
    act(() => releaseRead(page(current)));
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("permissions").textContent).toBe("-");
  });

  it("does not publish unverified permissions after a failed mutation", async () => {
    beginRolePolicySession("token-failed-mutation", true);
    const roles = roleRepository({
      list: vi.fn(async () => page([teacher(["students.read"])])),
      update: vi.fn(async () => {
        throw new ApiError({ kind: "server", code: "WRITE_FAILED", message: "boom" });
      }),
    });
    setRoleRepository(roles);

    render(<MutationProbe />);
    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    const readsBefore = vi.mocked(roles.list).mock.calls.length;

    fireEvent.click(screen.getByText("grant"));

    await waitFor(() => expect(screen.getByTestId("policy-status").textContent).toBe("fresh"));
    expect(screen.getByTestId("permissions").textContent).toBe("students.read");
    expect(vi.mocked(roles.list).mock.calls.length).toBe(readsBefore);
  });

  it("a role-management read cannot overwrite the newer global snapshot", async () => {
    beginRolePolicySession("token-read", true);
    commitRolePolicy(beginRolePolicyRequest("token-read")!, [teacher(["library.write"])]);
    setRoleRepository(roleRepository({ list: vi.fn(async () => page([teacher(["students.read"])])) }));

    render(<MutationProbe />);

    // The panel's own read resolves to a different matrix, but the global
    // snapshot is Fresh and must win.
    await waitFor(() => expect(screen.getByTestId("permissions").textContent).toBe("library.write"));
  });
});
