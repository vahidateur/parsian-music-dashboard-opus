// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import type { AuthRepository } from "@/domains/auth/repository";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

afterEach(cleanup);

function repoWithSeed() {
  const store = new DemoStoreImpl(memoryStorage());
  new DemoDataManager(store).initialize();
  return new DemoAuthRepository(store, memoryStorage());
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.email ?? "-"}</span>
      <span data-testid="finance">{String(auth.can("finance.write"))}</span>
      <span data-testid="settings-view">{String(auth.canAccess("settings"))}</span>
      <span data-testid="error">{auth.error?.code ?? "-"}</span>
      <button onClick={() => void auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE })}>ok</button>
      <button onClick={() => void auth.login({ email: "admin@demo.local", password: "wrong" })}>bad</button>
      <button onClick={() => void auth.logout()}>out</button>
    </div>
  );
}

const renderAuth = (repository: AuthRepository) => render(<AuthProvider repository={repository}><Probe /></AuthProvider>);

describe("AuthProvider lifecycle", () => {
  it("starts unauthenticated when there is no stored session", async () => {
    renderAuth(repoWithSeed());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
  });

  it("logs in and exposes permissions", async () => {
    renderAuth(repoWithSeed());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    fireEvent.click(screen.getByText("ok"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("user").textContent).toBe("admin@demo.local");
    expect(screen.getByTestId("finance").textContent).toBe("true");
  });

  it("surfaces an auth error and stays unauthenticated", async () => {
    renderAuth(repoWithSeed());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    fireEvent.click(screen.getByText("bad"));
    await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("AUTH_INVALID_CREDENTIALS"));
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });

  it("logs out back to unauthenticated", async () => {
    renderAuth(repoWithSeed());
    fireEvent.click(await screen.findByText("ok"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    fireEvent.click(screen.getByText("out"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("user").textContent).toBe("-");
  });

  it("restores a persisted session across mounts", async () => {
    const store = new DemoStoreImpl(memoryStorage());
    new DemoDataManager(store).initialize();
    const sessionStore = memoryStorage();
    const repo = new DemoAuthRepository(store, sessionStore);
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });

    renderAuth(new DemoAuthRepository(store, sessionStore));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
  });

  it("limits a teacher session to its own permissions", async () => {
    const store = new DemoStoreImpl(memoryStorage());
    new DemoDataManager(store).initialize();
    const sessionStore = memoryStorage();
    await new DemoAuthRepository(store, sessionStore).login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });

    renderAuth(new DemoAuthRepository(store, sessionStore));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("finance").textContent).toBe("false");
    expect(screen.getByTestId("settings-view").textContent).toBe("false");
  });

  it("treats a failing restore as unauthenticated instead of crashing", async () => {
    const broken: AuthRepository = {
      restore: vi.fn(async () => {
        throw new ApiError({ kind: "server", message: "boom" });
      }),
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
    } as unknown as AuthRepository;
    renderAuth(broken);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
  });
});
