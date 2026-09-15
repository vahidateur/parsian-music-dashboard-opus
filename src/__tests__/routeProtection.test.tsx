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
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

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
  resetToDemoEnvironment();
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
    await waitFor(() => expect(screen.getByRole("button", { name: /^ورود/ })).toBeTruthy());
    expect(screen.queryByRole("navigation", { name: "ناوبری اصلی" })).toBeNull();
  });

  it("a deep link does not bypass authentication", async () => {
    window.location.hash = "#/finance";
    useIsolatedAuth();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^ورود/ })).toBeTruthy());
    expect(screen.queryByText("مالی و شهریه")).toBeNull();
  });

  it("renders the app shell once authenticated", async () => {
    const repo = useIsolatedAuth();
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^ورود/ })).toBeNull();
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

  /*
   * S-8: the compensation surface is reached through the REAL route, in the real
   * shell. A view that is only ever mounted directly by its own suite can be
   * unreachable in the product — a hash the shell quietly ignores and replaces with
   * the dashboard looks identical from the inside.
   */
  it("honours the compensation deep link without falling back to the dashboard", async () => {
    window.location.hash = "#/compensation";
    const repo = useIsolatedAuth();
    await repo.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "جبرانی" })).toBeTruthy());
    expect(window.location.hash).toBe("#/compensation");
    // The dashboard's own headline is the tell that the hash was ignored.
    expect(screen.queryByText("نبض آموزشگاه")).toBeNull();
  });

  it("refuses the compensation deep link for a role that may not read the schedule", async () => {
    window.location.hash = "#/compensation";
    const repo = useIsolatedAuth();
    await repo.login({ email: "finance@demo.local", password: DEMO_PASSPHRASE });
    render(<App />);

    await waitFor(() => expect(screen.getByText("دسترسی ندارید")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "جبرانی" })).toBeNull();
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
