// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { demoDataManager } from "@/domains/demo";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { demoStore } from "@/services/demoStore";
import { memoryStorage } from "@/services/demoStore";

/** Uses the real component tree; only the session storage is isolated. */
function useIsolatedAuth() {
  const sessionStore = memoryStorage();
  const repo = new DemoAuthRepository(demoStore, sessionStore);
  setAuthRepository(repo);
  setUserRepository(new DemoUserRepository(demoStore));
  return repo;
}

beforeEach(() => {
  window.location.hash = "";
  demoStore.reset();
  demoDataManager.initialize();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

describe("route protection", () => {
  it("shows the login screen when unauthenticated", async () => {
    useIsolatedAuth();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "ورود" })).toBeTruthy());
    expect(screen.queryByRole("navigation", { name: "ناوبری اصلی" })).toBeNull();
  });

  it("a deep link does not bypass authentication", async () => {
    window.location.hash = "#/finance";
    useIsolatedAuth();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "ورود" })).toBeTruthy());
    expect(screen.queryByText("مالی و شهریه")).toBeNull();
  });

  it("renders the app shell once authenticated", async () => {
    const repo = useIsolatedAuth();
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "ورود" })).toBeNull();
  });

  it("honours a deep link for an authorized user", async () => {
    window.location.hash = "#/finance";
    const repo = useIsolatedAuth();
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
    expect(window.location.hash).toBe("#/finance");
  });

  it("blocks an unauthorized view even via a deep link", async () => {
    window.location.hash = "#/finance";
    const repo = useIsolatedAuth();
    await repo.login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    await waitFor(() => expect(screen.getByText("دسترسی ندارید")).toBeTruthy());
  });

  it("hides navigation entries the session cannot open", async () => {
    const repo = useIsolatedAuth();
    await repo.login({ email: "teacher1@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "ناوبری اصلی" });
    expect(nav.textContent).not.toContain("مالی");
    expect(nav.textContent).not.toContain("تنظیمات");
    expect(nav.textContent).toContain("حضور و غیاب");
  });

  it("an administrator sees the privileged sections", async () => {
    const repo = useIsolatedAuth();
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "ناوبری اصلی" });
    expect(nav.textContent).toContain("مالی");
    expect(nav.textContent).toContain("تنظیمات");
  });
});
