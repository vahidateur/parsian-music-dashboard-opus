// @vitest-environment jsdom
/**
 * The authenticated shell must explain a local policy-unavailable restoration,
 * keep the identity but no permissions, and recover only by re-reading the
 * authoritative local role repository.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { PolicyUnavailableBanner } from "@/domains/auth/PolicyUnavailableBanner";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalRoleRepository } from "@/domains/auth/localRoleRepository";
import { clearRolePolicies, setRolePolicies, type Permission, type RoleId } from "@/domains/auth/permissions";
import type { AuthRepository } from "@/domains/auth/repository";
import { defaultRoleRecord, type RoleRepository } from "@/domains/auth/roleRepository";
import type { Session } from "@/domains/auth/types";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

afterEach(() => {
  cleanup();
  clearRolePolicies();
});

function session(permissions: Permission[] = [], email = "policy@test.local"): Session {
  return {
    user: {
      id: "usr_policy",
      name: "Policy Probe",
      email,
      role: "administrator",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    permissions,
    token: "test-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

const unavailable = () =>
  new ApiError({ kind: "server", code: "ROLE_POLICY_UNAVAILABLE", message: "policy unavailable" });
const invalid = () =>
  new ApiError({ kind: "server", code: "ROLE_POLICY_INVALID", message: "policy invalid" });

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.email ?? "-"}</span>
      <span data-testid="permissions">{String(auth.permissions.length)}</span>
      <span data-testid="policy-error">{auth.policyError?.code ?? "-"}</span>
      <span data-testid="login-error">{auth.error?.code ?? "-"}</span>
      <span data-testid="settings">{String(auth.canAccess("settings"))}</span>
      <span data-testid="users-write">{String(auth.can("users.write"))}</span>
      <button onClick={() => void auth.retryPolicy()}>retry</button>
      <button onClick={() => void auth.logout()}>logout</button>
      <button onClick={() => void auth.login({ email: "policy@test.local", password: "x" })}>login</button>
      <PolicyUnavailableBanner />
    </div>
  );
}

function renderWith(repo: AuthRepository) {
  return render(
    <AuthProvider repository={repo}>
      <Probe />
    </AuthProvider>,
  );
}

function stubRepo(overrides: Partial<AuthRepository>): AuthRepository {
  return {
    restore: vi.fn(async () => null),
    restoreDetailed: vi.fn(async () => ({ session: null, expiredReason: null })),
    login: vi.fn(),
    logout: vi.fn(async () => undefined),
    me: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

function mutableRoles(real: LocalRoleRepository) {
  let fail = false;
  const repo = {
    list: () => real.list(),
    get: async (id: RoleId) => {
      if (fail) throw new Error("local role store unavailable");
      return real.get(id);
    },
    update: (...args: Parameters<RoleRepository["update"]>) => real.update(...args),
    reset: (...args: Parameters<RoleRepository["reset"]>) => real.reset(...args),
  } as RoleRepository;
  return { repo, setFail: (value: boolean) => { fail = value; } };
}

describe("policy-unavailable recovery", () => {
  it("shows a shell disclosure for ROLE_POLICY_UNAVAILABLE while keeping the identity", async () => {
    const repo = stubRepo({
      restoreDetailed: vi.fn(async () => ({
        session: session(),
        expiredReason: null,
        policyError: unavailable(),
      })),
    });
    renderWith(repo);

    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("user").textContent).toBe("policy@test.local");
    expect(screen.getByTestId("permissions").textContent).toBe("0");
    expect(screen.getByTestId("policy-error").textContent).toBe("ROLE_POLICY_UNAVAILABLE");
    expect(screen.getByTestId("login-error").textContent).toBe("-");
    expect(screen.getByTestId("settings").textContent).toBe("false");
    expect(screen.getByTestId("users-write").textContent).toBe("false");
  });

  it("keeps protected access closed even if a projection arrives while policy is unavailable", async () => {
    const repo = stubRepo({
      restoreDetailed: vi.fn(async () => ({
        session: session(),
        expiredReason: null,
        policyError: unavailable(),
      })),
    });
    renderWith(repo);
    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();

    setRolePolicies([defaultRoleRecord("administrator")]);

    await waitFor(() => expect(screen.getByTestId("permissions").textContent).toBe("0"));
    expect(screen.getByTestId("settings").textContent).toBe("false");
    expect(screen.getByTestId("users-write").textContent).toBe("false");
  });

  it("uses invalid-policy copy for ROLE_POLICY_INVALID", async () => {
    const repo = stubRepo({
      restoreDetailed: vi.fn(async () => ({
        session: session(),
        expiredReason: null,
        policyError: invalid(),
      })),
    });
    renderWith(repo);

    expect(await screen.findByText("پیکربندی دسترسی معتبر نیست")).toBeTruthy();
    expect(screen.getByTestId("policy-error").textContent).toBe("ROLE_POLICY_INVALID");
  });

  it("does not show the shell policy banner for an invalid-credentials login error", async () => {
    const repo = stubRepo({
      login: vi.fn(async () => {
        throw new ApiError({ kind: "authentication", code: "AUTH_INVALID_CREDENTIALS", message: "bad credentials" });
      }),
    });
    renderWith(repo);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("login-error").textContent).toBe("AUTH_INVALID_CREDENTIALS"));
    expect(screen.getByTestId("policy-error").textContent).toBe("-");
    expect(screen.queryByText("دسترسی موقتاً محدود است")).toBeNull();
  });

  it("rebuilds permissions from the current local role repository on a successful retry", async () => {
    const store = new DemoStoreImpl(memoryStorage());
    new DemoDataManager(store).initialize();
    const storage = memoryStorage();
    const realRoles = new LocalRoleRepository(store);
    const roles = mutableRoles(realRoles);
    const auth = new LocalAuthRepository(store, storage, () => Date.now(), undefined, roles.repo);
    await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });

    roles.setFail(true);
    renderWith(auth);
    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();
    expect(screen.getByTestId("permissions").textContent).toBe("0");

    roles.setFail(false);
    fireEvent.click(screen.getByText("retry"));

    await waitFor(() => expect(screen.queryByText("دسترسی موقتاً محدود است")).toBeNull());
    expect(screen.getByTestId("permissions").textContent).not.toBe("0");
    expect(screen.getByTestId("policy-error").textContent).toBe("-");
    expect(screen.getByTestId("settings").textContent).toBe("true");
    expect(screen.getByTestId("users-write").textContent).toBe("true");
  });

  it("keeps identity, empty permissions, and the disclosure after a failed retry", async () => {
    const store = new DemoStoreImpl(memoryStorage());
    new DemoDataManager(store).initialize();
    const storage = memoryStorage();
    const roles = mutableRoles(new LocalRoleRepository(store));
    const auth = new LocalAuthRepository(store, storage, () => Date.now(), undefined, roles.repo);
    await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    roles.setFail(true);

    renderWith(auth);
    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();
    fireEvent.click(screen.getByText("retry"));

    await waitFor(() => expect(screen.getByTestId("policy-error").textContent).toBe("ROLE_POLICY_UNAVAILABLE"));
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("user").textContent).toBe("admin@demo.local");
    expect(screen.getByTestId("permissions").textContent).toBe("0");
    expect(screen.getByText("دسترسی موقتاً محدود است")).toBeTruthy();
  });

  it("clears policy disclosure on logout and does not leak it into the next login", async () => {
    const repo = stubRepo({
      restoreDetailed: vi.fn(async () => ({
        session: session(),
        expiredReason: null,
        policyError: unavailable(),
      })),
      login: vi.fn(async () => session(["students.read"], "next@test.local")),
    });
    renderWith(repo);
    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();

    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("policy-error").textContent).toBe("-");
    expect(screen.queryByText("دسترسی موقتاً محدود است")).toBeNull();

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("policy-error").textContent).toBe("-");
    expect(screen.getByTestId("permissions").textContent).toBe("1");
  });

  it("deduplicates concurrent retry attempts", async () => {
    let resolveRetry!: (value: Awaited<ReturnType<AuthRepository["restoreDetailed"]>>) => void;
    const deferred = new Promise<Awaited<ReturnType<AuthRepository["restoreDetailed"]>>>((resolve) => {
      resolveRetry = resolve;
    });
    const restoreDetailed = vi
      .fn()
      .mockResolvedValueOnce({ session: session(), expiredReason: null, policyError: unavailable() })
      .mockImplementationOnce(() => deferred)
      .mockResolvedValue({ session: session(["students.read"]), expiredReason: null });
    const repo = stubRepo({ restoreDetailed });
    renderWith(repo);
    expect(await screen.findByText("دسترسی موقتاً محدود است")).toBeTruthy();

    fireEvent.click(screen.getByText("retry"));
    fireEvent.click(screen.getByText("retry"));
    expect(screen.getByText("در حال بررسی…")).toBeTruthy();

    await waitFor(() => expect(restoreDetailed).toHaveBeenCalledTimes(2));
    resolveRetry({ session: session(["students.read"]), expiredReason: null });
    await waitFor(() => expect(screen.queryByText("دسترسی موقتاً محدود است")).toBeNull());
    expect(screen.getByTestId("permissions").textContent).toBe("1");
  });
});
