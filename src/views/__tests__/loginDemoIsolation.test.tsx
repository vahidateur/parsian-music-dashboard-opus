// @vitest-environment jsdom
/**
 * §7 / §4 guarantee: demo credentials must never reach a production build.
 *
 * Two independent layers are asserted, so a regression in either one fails:
 *   1. `listDemoAccounts()` returns nothing outside demo mode.
 *   2. The login screen renders no demo panel, passphrase or warning banner.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { LoginView } from "@/views/Login";

const renderLogin = () =>
  render(
    <AuthProvider>
      <LoginView />
    </AuthProvider>,
  );

afterEach(() => {
  resetRuntimeConfig();
  cleanup();
});

describe("login demo isolation", () => {
  it("exposes demo accounts in demo mode", () => {
    setRuntimeConfig({ mode: "demo", error: null });
    expect(listDemoAccounts().length).toBeGreaterThan(0);
  });

  it("exposes no demo accounts in api mode", () => {
    setRuntimeConfig({ mode: "api", error: null });
    expect(listDemoAccounts()).toEqual([]);
  });

  it("renders the demo helper panel in demo mode", () => {
    setRuntimeConfig({ mode: "demo", error: null });
    renderLogin();
    expect(screen.getByText(DEMO_PASSPHRASE)).toBeTruthy();
    expect(screen.getByText(/محیط دمو/)).toBeTruthy();
  });

  it("renders no demo passphrase, accounts or warning in api mode", () => {
    setRuntimeConfig({ mode: "api", error: null });
    renderLogin();
    expect(screen.queryByText(DEMO_PASSPHRASE)).toBeNull();
    expect(screen.queryByText(/محیط دمو/)).toBeNull();
    expect(screen.queryByText(/بدون امنیت واقعی/)).toBeNull();
    expect(screen.queryByText(/@demo\.local/)).toBeNull();
  });

  it("still renders a usable login form in api mode", () => {
    setRuntimeConfig({ mode: "api", error: null });
    renderLogin();
    expect(screen.getByLabelText(/ایمیل|نام کاربری/)).toBeTruthy();
  });
});
