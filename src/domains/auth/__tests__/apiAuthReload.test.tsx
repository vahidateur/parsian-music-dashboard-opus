// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { API_SESSION_STORAGE_KEY } from "@/domains/auth/tokenStore";
import { RIGHT_PASSWORD, createFakeServer, fakeStorage, pageLoad } from "./fakeAuthServer";

afterEach(cleanup);

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="role">{auth.user?.role ?? "-"}</span>
      <span data-testid="settings">{String(auth.canAccess("settings"))}</span>
      <button onClick={() => void auth.login({ email: "admin@demo.local", password: RIGHT_PASSWORD })}>login</button>
      <button onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

const status = () => screen.getByTestId("status").textContent;

describe("AuthProvider — session survives a page reload (API repository)", () => {
  it("login persists; a reload restores the session; protected state is never exposed while restoring", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();

    // First page load: sign in.
    const first = pageLoad(server, storage);
    render(
      <AuthProvider repository={first.repository}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(Object.keys(storage.dump())).toEqual([API_SESSION_STORAGE_KEY]);
    cleanup(); // the page goes away

    // RELOAD: nothing in memory, the tab's storage is kept.
    const second = pageLoad(server, storage);
    expect(second.inMemoryToken()).toBeNull();
    render(
      <AuthProvider repository={second.repository}>
        <Probe />
      </AuthProvider>,
    );
    // Pending restoration is NOT authenticated: no user, no permissions, no views.
    expect(status()).toBe("restoring");
    expect(screen.getByTestId("role").textContent).toBe("-");
    expect(screen.getByTestId("settings").textContent).toBe("false");

    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(screen.getByTestId("role").textContent).toBe("administrator");
    expect(screen.getByTestId("settings").textContent).toBe("true");
  });

  it("an invalid persisted token ends unauthenticated and is cleared", async () => {
    const server = createFakeServer();
    const storage = fakeStorage({
      [API_SESSION_STORAGE_KEY]: JSON.stringify({ token: "revoked", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    });
    const page = pageLoad(server, storage);
    render(
      <AuthProvider repository={page.repository}>
        <Probe />
      </AuthProvider>,
    );
    expect(status()).toBe("restoring");
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    expect(screen.getByTestId("role").textContent).toBe("-");
    expect(storage.dump()).toEqual({});
  });

  it("logout clears the persisted session, so the next load stays signed out", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    const first = pageLoad(server, storage);
    render(
      <AuthProvider repository={first.repository}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(status()).toBe("authenticated"));
    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    expect(storage.dump()).toEqual({});
    cleanup();

    const second = pageLoad(server, storage);
    render(
      <AuthProvider repository={second.repository}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    expect(screen.getByTestId("role").textContent).toBe("-");
  });

  it("a transport failure during restoration fails closed (unauthenticated, token kept)", async () => {
    const server = createFakeServer();
    const storage = fakeStorage();
    await pageLoad(server, storage).repository.login({ email: "admin@demo.local", password: RIGHT_PASSWORD });
    server.setNetworkDown(true);
    const page = pageLoad(server, storage);
    render(
      <AuthProvider repository={page.repository}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(status()).toBe("unauthenticated"));
    expect(Object.keys(storage.dump())).toEqual([API_SESSION_STORAGE_KEY]);
  });
});