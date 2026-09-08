// @vitest-environment jsdom
/**
 * Regression: the login screen inside an EMPTY (customer) environment.
 *
 * Phase 2 made every demo-only affordance depend on BOTH axes — the data source
 * and the persisted lifecycle state — but the login credential panel was gated on
 * the data source alone. A visitor who chose "start with empty data" was told
 * they were in a DEMO environment and that their own bootstrap administrator was
 * one of the "sample accounts": the same dishonesty Phase 2 removed from the
 * Settings data panel, in the one place a brand-new customer looks first.
 *
 * These tests pin the corrected contract in both directions, because a fix that
 * only changed the wording could just as easily have locked the customer out:
 *
 *   1. CAPABILITY PRESERVED — the bootstrap account is offered, one tap fills it,
 *      the passphrase stays visible, and signing in really works. That account is
 *      the only way into an EMPTY environment, so none of this may be removed in
 *      the name of hiding demo material.
 *   2. LABELS TRUTHFUL — nothing calls this environment a demo or this account a
 *      sample one.
 *   3. SECURITY HONESTY PRESERVED — "no real security" is true in EMPTY too, so
 *      the warning must survive the relabelling.
 *   4. API ISOLATION UNCHANGED — in api mode there is still no panel, no
 *      passphrase and no account in the DOM at all.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { AUTH_SESSION_KEY, DEMO_PASSPHRASE } from "@/domains/auth/demoAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/domains/demo/lifecycle";
import { resetRegistry } from "@/domains/registry";
import { resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { LoginView } from "@/views/Login";

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginView />
    </AuthProvider>,
  );
}

const emailBox = () => screen.getByRole("textbox", { name: "ایمیل" }) as HTMLInputElement;
/** The password input has no textbox role, so query it by label association. */
const passwordBox = () => screen.getByLabelText("گذرواژه") as HTMLInputElement;
/** The credential panel: the warning title's own div, then one level up. */
const credentialPanel = () => screen.getByText(/بدون امنیت واقعی/).closest("div")!.parentElement!;

beforeEach(() => {
  // Drop any session left behind FIRST: the environment reset below rewrites
  // storage, and a stale session would let a test pass without signing in.
  localStorage.clear();
  resetToEmptyEnvironment();
  resetRegistry();
  // An EMPTY environment only exists when the data source is demo, so this is
  // the realistic configuration for a customer running the panel locally.
  setRuntimeConfig({ mode: "demo", error: null });
});

afterEach(() => {
  resetRuntimeConfig();
  cleanup();
});

describe("an EMPTY environment is not called a demo", () => {
  it("labels the environment as local data instead of a demo environment", () => {
    renderLogin();

    expect(screen.getByText(/دادهٔ محلی — بدون امنیت واقعی/)).toBeTruthy();
    expect(screen.queryByText(/محیط دمو/)).toBeNull();
  });

  it("does not call the visitor's own account a sample account", () => {
    const { container } = renderLogin();

    expect(container.textContent).not.toContain("حساب‌های نمونه");
    expect(container.textContent).not.toContain("صرفاً نمایشی");
    expect(container.textContent).toContain("حساب دسترسیِ این محیط");
  });

  it("keeps the honest security warning, which is just as true in EMPTY", () => {
    renderLogin();

    expect(screen.getByText(/بدون امنیت واقعی/)).toBeTruthy();
    expect(screen.getByText(/هیچ محافظت امنیتی ندارد/)).toBeTruthy();
  });

  it("offers exactly the bootstrap account, and none of the demo seed accounts", () => {
    renderLogin();
    const panel = credentialPanel();

    expect(within(panel).getByText(BOOTSTRAP_ADMIN_EMAIL)).toBeTruthy();
    expect(within(panel).queryByText(/@demo\.local/)).toBeNull();
  });
});

describe("the way into an EMPTY environment still works", () => {
  it("keeps the passphrase visible, because it is the only way in", () => {
    renderLogin();

    expect(screen.getByText(DEMO_PASSPHRASE)).toBeTruthy();
  });

  it("fills the bootstrap credentials in one tap", () => {
    renderLogin();

    fireEvent.click(within(credentialPanel()).getAllByRole("button")[0]);

    expect(emailBox().value).toBe(BOOTSTRAP_ADMIN_EMAIL);
    expect(passwordBox().value).toBe(DEMO_PASSPHRASE);
  });

  it("signs the bootstrap administrator in for real", async () => {
    renderLogin();

    fireEvent.change(emailBox(), { target: { value: BOOTSTRAP_ADMIN_EMAIL } });
    fireEvent.change(passwordBox(), { target: { value: DEMO_PASSPHRASE } });
    fireEvent.click(screen.getByRole("button", { name: /ورود به پنل/ }));

    // A real session, written by the real auth repository — not a rendered
    // success message. If the relabelling had broken the account, this hangs.
    await waitFor(() => {
      expect(localStorage.getItem(AUTH_SESSION_KEY)).not.toBeNull();
    });
  });
});

describe("api-mode isolation is unchanged by the relabelling", () => {
  it("renders no credential panel, passphrase or account at all", () => {
    setRuntimeConfig({ mode: "api", error: null });
    const { container } = renderLogin();

    expect(screen.queryByText(/بدون امنیت واقعی/)).toBeNull();
    expect(container.textContent).not.toContain(DEMO_PASSPHRASE);
    expect(container.textContent).not.toContain(BOOTSTRAP_ADMIN_EMAIL);
    // The form itself must still be usable — isolation is not a blank screen.
    expect(screen.getByLabelText(/ایمیل|نام کاربری/)).toBeTruthy();
  });
});
