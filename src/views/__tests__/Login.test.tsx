// @vitest-environment jsdom
/**
 * Login screen.
 *
 * The redesign changed the visual language, not the contract. These tests pin
 * the parts that must survive any future restyling: accessible labelling,
 * keyboard operability, honest error reporting, and — most importantly — that
 * demo credentials never reach a production build.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isDemoMode = vi.fn(() => true);
vi.mock("@/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/config")>()),
  isDemoMode: () => isDemoMode(),
}));

import { LoginView } from "../Login";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { AUTH_SESSION_KEY, DEMO_PASSPHRASE } from "@/domains/auth/demoAuthRepository";
import { resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  // Drop any session left by the previous test FIRST: `clear()` wipes every
  // key, so running it after the environment is seeded would also remove the
  // dataset and its lifecycle marker and leave the store UNINITIALIZED.
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  isDemoMode.mockReturnValue(true);
});

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

describe("structure and accessibility", () => {
  it("labels both fields and focuses email on mount", () => {
    renderLogin();
    expect(emailBox()).toBeDefined();
    expect(passwordBox()).toBeDefined();
    expect(document.activeElement).toBe(emailBox());
  });

  it("uses password autocomplete hints so managers behave", () => {
    renderLogin();
    expect(emailBox().getAttribute("autocomplete")).toBe("username");
    expect(passwordBox().getAttribute("autocomplete")).toBe("current-password");
  });

  it("masks the password until explicitly revealed", () => {
    renderLogin();
    expect(passwordBox().type).toBe("password");

    const toggle = screen.getByRole("button", { name: "نمایش گذرواژه" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    expect(passwordBox().type).toBe("text");
    expect(screen.getByRole("button", { name: "پنهان‌کردن گذرواژه" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the decorative artwork out of the accessibility tree", () => {
    const { container } = renderLogin();
    // The stage photo is presentational: an empty alt, never announced.
    const images = [...container.querySelectorAll("img")];
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((img) => img.getAttribute("alt") === "")).toBe(true);
  });

  it("exposes a live region for the pending state", () => {
    const { container } = renderLogin();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("validation", () => {
  it("marks a malformed email invalid and links the message", async () => {
    const { container } = renderLogin();
    const email = container.querySelector('input[name="email"]') as HTMLInputElement;
    const password = container.querySelector('input[name="password"]') as HTMLInputElement;
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.change(password, { target: { value: "x" } });
    fireEvent.submit(email.closest("form")!);

    const message = await screen.findByText("ایمیل معتبر وارد کنید.");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    // The error is programmatically associated, not just visually adjacent.
    expect(email.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("reports a missing password", async () => {
    renderLogin();
    fireEvent.change(emailBox(), { target: { value: "admin@demo.local" } });
    fireEvent.change(passwordBox(), { target: { value: "x" } });
    fireEvent.change(passwordBox(), { target: { value: "" } });
    fireEvent.submit(emailBox().closest("form")!);

    expect(await screen.findByText("گذرواژه را وارد کنید.")).toBeDefined();
  });

  it("keeps submit disabled until both fields have content", () => {
    renderLogin();
    const submit = screen.getByRole("button", { name: /ورود به پنل/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(emailBox(), { target: { value: "admin@demo.local" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(passwordBox(), { target: { value: DEMO_PASSPHRASE } });
    expect(submit.disabled).toBe(false);
  });
});

describe("authentication", () => {
  it("signs in with valid demo credentials", async () => {
    renderLogin();
    fireEvent.change(emailBox(), { target: { value: "admin@demo.local" } });
    fireEvent.change(passwordBox(), { target: { value: DEMO_PASSPHRASE } });
    fireEvent.click(screen.getByRole("button", { name: /ورود به پنل/ }));

    await waitFor(() => {
      expect(localStorage.getItem(AUTH_SESSION_KEY)).not.toBeNull();
    });
  });

  it("shows a real failure and never claims success", async () => {
    renderLogin();
    fireEvent.change(emailBox(), { target: { value: "admin@demo.local" } });
    fireEvent.change(passwordBox(), { target: { value: "wrong-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /ورود به پنل/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBeTruthy();
    // No session is written on a failed attempt.
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });

  it("clears the error as soon as the user edits a field", async () => {
    renderLogin();
    fireEvent.change(emailBox(), { target: { value: "admin@demo.local" } });
    fireEvent.change(passwordBox(), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /ورود به پنل/ }));
    await screen.findByRole("alert");

    fireEvent.change(passwordBox(), { target: { value: "wrong2" } });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

describe("demo mode", () => {
  it("offers one-tap credential fill", () => {
    renderLogin();
    const panel = screen.getByText(/محیط دمو/).closest("div")!.parentElement!;
    const account = within(panel).getAllByRole("button")[0];

    fireEvent.click(account);
    expect(emailBox().value.length).toBeGreaterThan(0);
    expect(passwordBox().value).toBe(DEMO_PASSPHRASE);
  });

  it("states plainly that the demo login is not secure", () => {
    renderLogin();
    expect(screen.getByText(/بدون امنیت واقعی/)).toBeDefined();
    expect(screen.getByText(/هیچ محافظت امنیتی ندارد/)).toBeDefined();
  });
});

describe("production mode", () => {
  beforeEach(() => isDemoMode.mockReturnValue(false));

  it("renders no demo banner, passphrase or account hints at all", () => {
    const { container } = renderLogin();

    expect(screen.queryByText(/محیط دمو/)).toBeNull();
    expect(screen.queryByText(/بدون امنیت واقعی/)).toBeNull();
    // The shared passphrase must not exist anywhere in the DOM.
    expect(container.textContent).not.toContain(DEMO_PASSPHRASE);
    expect(container.textContent).not.toContain("demo.local");
  });

  it("still renders a fully usable form", () => {
    renderLogin();
    expect(emailBox()).toBeDefined();
    expect(passwordBox()).toBeDefined();
    expect(screen.getByRole("button", { name: /ورود به پنل/ })).toBeDefined();
  });
});
