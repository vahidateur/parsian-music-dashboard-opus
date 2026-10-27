// @vitest-environment jsdom
/**
 * Server-side session expiry handling in the shell.
 *
 * A 401 mid-session (including the new AUTH_SESSION_IDLE_EXPIRED /
 * AUTH_SESSION_ABSOLUTE_EXPIRED codes) must flip the app to unauthenticated
 * exactly once — concurrent 401s collapse into a single sign-out, never a
 * logout loop — leave an honest reason on the login screen, and clear the
 * dead token. A session end broadcast from another tab must do the same
 * through the `storage` event (polling alone would leave tabs alive up to
 * a second longer and never explain why).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import type { AuthRepository } from "@/domains/auth/repository";
import type { Session } from "@/domains/auth/types";
import { notifySessionExpired } from "@/domains/registryCore";
import { resetRegistry } from "@/domains/registryCore";
import { LoginView } from "@/views/Login";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(() => {
  cleanup();
  resetRegistry();
});

const SESSION: Session = {
  user: {
    id: "u_1",
    name: "Test",
    email: "t@example.test",
    role: "manager",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  permissions: [],
  token: "tok_live",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

function fakeRepo(): AuthRepository & { logout: ReturnType<typeof vi.fn> } {
  return {
    restore: vi.fn(async () => SESSION),
    restoreDetailed: vi.fn(async () => ({ session: SESSION, expiredReason: null })),
    login: vi.fn(async () => SESSION),
    logout: vi.fn(async () => undefined),
    me: vi.fn(async () => SESSION),
  } as unknown as AuthRepository & { logout: ReturnType<typeof vi.fn> };
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="notice">{auth.notice ?? "-"}</span>
      <button onClick={() => void auth.login({ email: "a@b.c", password: "x" })}>login</button>
      <button onClick={() => void auth.logout()}>out</button>
    </div>
  );
}

const expiryError = (code: string) => new ApiError({ kind: "authentication", status: 401, code, message: "پایان نشست." });

describe("server-side session expiry in the shell", () => {
  it("signs out once with the idle reason on AUTH_SESSION_IDLE_EXPIRED", async () => {
    const repo = fakeRepo();
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    notifySessionExpired(expiryError("AUTH_SESSION_IDLE_EXPIRED"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("notice").textContent).toContain("عدم فعالیت");
    expect(repo.logout).toHaveBeenCalledTimes(1);

    // A second 401 (every in-flight request failed at once) is a no-op.
    notifySessionExpired(expiryError("AUTH_SESSION_IDLE_EXPIRED"));
    await new Promise((r) => setTimeout(r, 50));
    expect(repo.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });

  it("reports the absolute reason on AUTH_SESSION_ABSOLUTE_EXPIRED", async () => {
    const repo = fakeRepo();
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    notifySessionExpired(expiryError("AUTH_SESSION_ABSOLUTE_EXPIRED"));
    await waitFor(() => expect(screen.getByTestId("notice").textContent).toContain("مدت نشست"));
    expect(repo.logout).toHaveBeenCalledTimes(1);
  });

  it("signs out even when the revocation call itself fails", async () => {
    const failing = fakeRepo();
    failing.logout = vi.fn(async () => {
      throw new ApiError({ kind: "network", message: "down" });
    });
    render(
      <AuthProvider repository={failing}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    notifySessionExpired(expiryError("AUTH_SESSION_IDLE_EXPIRED"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("notice").textContent).toContain("عدم فعالیت");
  });

  it("ends the session when another tab broadcasts its end", async () => {
    const repo = fakeRepo();
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    // jsdom does not synchronize localStorage across event dispatch: write
    // the key (as the other tab would) AND dispatch the event.
    localStorage.setItem("ava:session:ended", JSON.stringify({ at: Date.now(), reason: "absolute" }));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ava:session:ended",
        newValue: JSON.stringify({ at: Date.now(), reason: "absolute" }),
      }),
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("notice").textContent).toContain("مدت نشست");
    expect(repo.logout).toHaveBeenCalledTimes(1);
  });

  it("shows the expiry reason on the real login screen", async () => {
    // Branding reads the (seeded) demo registry; auth itself is the fake.
    resetToDemoEnvironment();
    const repo = fakeRepo();
    render(
      <AuthProvider repository={repo}>
        <Probe />
        <LoginView />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    notifySessionExpired(expiryError("AUTH_SESSION_IDLE_EXPIRED"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("عدم فعالیت"));
    expect(repo.logout).toHaveBeenCalledTimes(1);
  });

  it("ignores broadcasts for other keys and tampered payloads", async () => {
    const repo = fakeRepo();
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    window.dispatchEvent(new StorageEvent("storage", { key: "ava:session:activity", newValue: "123" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "ava:session:ended", newValue: "not-json" }));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "ava:session:ended", newValue: JSON.stringify({ reason: "bogus" }) }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(repo.logout).not.toHaveBeenCalled();
  });
});

describe("boot-restore expiry notice", () => {
  function bootRepo(outcome: { session: Session | null; expiredReason: "idle" | "absolute" | null }) {
    return {
      restore: vi.fn(async () => outcome.session),
      restoreDetailed: vi.fn(async () => outcome),
      login: vi.fn(async () => SESSION),
      logout: vi.fn(async () => undefined),
      me: vi.fn(async () => SESSION),
    } as unknown as AuthRepository;
  }

  it("shows the idle notice when the stored session died of inactivity", async () => {
    resetToDemoEnvironment();
    render(
      <AuthProvider repository={bootRepo({ session: null, expiredReason: "idle" })}>
        <Probe />
        <LoginView />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByRole("status").textContent).toContain("عدم فعالیت");
  });

  it("shows the absolute notice when the stored session outlived its lifetime", async () => {
    resetToDemoEnvironment();
    render(
      <AuthProvider repository={bootRepo({ session: null, expiredReason: "absolute" })}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("notice").textContent).toContain("مدت نشست");
  });

  it("stays silent for revoked credentials", async () => {
    const repo = bootRepo({ session: null, expiredReason: null });
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("notice").textContent).toBe("-");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears a boot notice on the next login attempt", async () => {
    const repo = bootRepo({ session: null, expiredReason: "idle" });
    render(
      <AuthProvider repository={repo}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("notice").textContent).toContain("عدم فعالیت"));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("notice").textContent).toBe("-");
  });

  it("a restored session carries no notice", async () => {
    render(
      <AuthProvider repository={bootRepo({ session: SESSION, expiredReason: null })}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("notice").textContent).toBe("-");
  });
});
