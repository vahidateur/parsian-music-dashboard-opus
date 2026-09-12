// @vitest-environment jsdom
/**
 * Environment data controls — labelled by the environment that actually exists.
 *
 * The failure this guards against is a customer's real environment being
 * presented as demo tooling. That is not cosmetic: the copy would tell them
 * their records are not operational data, and two of the buttons would replace
 * those records with the showcase dataset. So the assertions are about which
 * controls exist and what a confirmation says, in each kind of environment.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/domains/demo/lifecycle";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { DemoDataPanel } from "../DemoDataPanel";

/** Waits for the session restore that enables the destructive controls. */
async function waitForManagePermission() {
  await waitFor(() => {
    const clear = screen.getByRole("button", { name: /پاک‌کردن کامل/ }) as HTMLButtonElement;
    expect(clear.disabled).toBe(false);
  });
}

/** Signs in as an administrator of whichever environment was created, then renders. */
async function renderPanel(adminEmail: string) {
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email: adminEmail, password: DEMO_PASSPHRASE });

  const rendered = render(
    <AuthProvider>
      <AppProvider>
        <DemoDataPanel />
      </AppProvider>
    </AuthProvider>,
  );
  // `can()` is false while the session is still being restored, so every
  // assertion about what an administrator may do has to start from here.
  await waitForManagePermission();
  return rendered;
}

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("in a DEMO environment", () => {
  beforeEach(() => resetToDemoEnvironment());

  it("is labelled as demo tooling and offers the showcase-dataset operations", async () => {
    const { container } = await renderPanel("admin@demo.local");

    expect(screen.getByText("دادهٔ دمو")).toBeTruthy();
    expect(screen.getByText("محیط توسعه")).toBeTruthy();
    expect(container.textContent).toContain("فقط دمو");
    expect(screen.getByRole("button", { name: /بازنشانی به دادهٔ اولیه/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ورود دیتاست کانونیکال/ })).toBeTruthy();
  });
});

describe("in a customer's EMPTY environment", () => {
  beforeEach(() => resetToEmptyEnvironment());

  it("never calls the customer's own data demo", async () => {
    const { container } = await renderPanel(BOOTSTRAP_ADMIN_EMAIL);

    expect(screen.getByText("دادهٔ محیط")).toBeTruthy();
    expect(screen.getByText("دادهٔ واقعی")).toBeTruthy();
    // Strong invariant: not one word of demo labelling anywhere in the panel.
    expect(container.textContent).not.toContain("دمو");
  });

  it("offers no control that would install the showcase dataset", async () => {
    await renderPanel(BOOTSTRAP_ADMIN_EMAIL);

    expect(screen.queryByRole("button", { name: /بازنشانی به دادهٔ اولیه/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /ورود دیتاست کانونیکال/ })).toBeNull();

    // The operations on this environment's own data remain — and remain usable
    // by an administrator, not merely present in the DOM.
    for (const label of [/دریافت پشتیبان/, /بازگردانی از فایل/, /پاک‌کردن کامل/]) {
      const button = screen.getByRole("button", { name: label }) as HTMLButtonElement;
      expect(button.disabled, `${label} must be usable`).toBe(false);
    }
  });

  it("confirms a clear in terms of this environment, not of demo data", async () => {
    const { container } = await renderPanel(BOOTSTRAP_ADMIN_EMAIL);

    fireEvent.click(screen.getByRole("button", { name: /پاک‌کردن کامل/ }));

    await waitFor(() => expect(screen.getByText("پاک‌کردن کامل داده‌ها")).toBeTruthy());
    expect(container.textContent).toContain("همهٔ رکوردهای این محیط");
    expect(container.textContent).toContain("حساب‌های کاربری");
    expect(container.textContent).toContain("ورود ممکن نخواهد بود");
    expect(container.textContent).toContain("شروع دوباره");
    expect(container.textContent).not.toContain("رکوردهای دمو");
  });

  it("says plainly that the browser is the only storage there is", async () => {
    const { container } = await renderPanel(BOOTSTRAP_ADMIN_EMAIL);

    expect(container.textContent).toContain("localStorage");
    expect(container.textContent).toContain("پشتیبان");
  });
});
