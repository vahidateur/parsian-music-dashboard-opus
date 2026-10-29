// @vitest-environment jsdom
/**
 * The client composition never speaks of «دمو» on the surfaces a real user opens.
 *
 * Found in the real browser: Reports, Settings and the branding panel told a
 * customer that something "does not exist in the demo" / "is kept only in this
 * browser in the demo version". In the client build nothing on screen is demo
 * material, so the sentences were false there. Their wording now comes from the
 * target copy seam, pinned here to the CLIENT variant (the demo side keeps its
 * original sentences, pinned by `noSuccessWithoutWrite`, `settingsHonesty` and
 * `honestWriteCopy`).
 *
 * Each case also asserts the client sentence says something true and specific,
 * so "removed the word" cannot pass for "said the right thing".
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/targets/targetCopy", async () => await import("@/targets/targetCopy.client"));
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { ReportsView } from "@/views/Reports";
import { SettingsView } from "@/views/Settings";

const flat = (text: string) => text.replace(/\u200c/g, " ").replace(/\s+/g, " ");
const shown = () => flat(document.body.textContent ?? "");

async function signInAsAdmin() {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
}

beforeEach(() => {
  resetRegistry();
  localStorage.clear();
  window.location.hash = "#/settings";
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

describe("client composition — no demo wording on user-facing deferral copy", () => {
  it("Reports states what is true (no server contract yet) and never names the demo", () => {
    render(
      <AuthProvider>
        <AppProvider>
          <ReportsView />
        </AppProvider>
      </AuthProvider>,
    );
    expect(shown()).toContain(flat("تا آن زمان چیزی برای نمایش صادقانه وجود ندارد."));
    expect(shown()).not.toContain("دمو");
  });

  it("the branding panel says the logo/favicon control is not offered, and not that files live in the browser", async () => {
    await signInAsAdmin();
    render(
      <AuthProvider>
        <AppProvider>
          <BrandingPanel />
        </AppProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 8000 });
    expect(shown()).toContain(flat("بارگذاری لوگو و favicon هنوز در این پنل ارائه نشده است."));
    expect(shown()).not.toContain("دمو");
    expect(shown()).not.toContain(flat("فقط در همین مرورگر"));
  });

  it("Settings: the operations hint lists the client's own sections, and the notifications note names no demo", async () => {
    await signInAsAdmin();
    render(
      <AuthProvider>
        <AppProvider>
          <SettingsView />
        </AppProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 8000 });
    expect(shown()).toContain(flat("اتاق\u200cها، ساز\u200cها، دوره\u200cها و قواعد جلسه"));
    expect(shown()).not.toContain("دمو");

    fireEvent.click(screen.getByRole("button", { name: /اعلان/ }));
    expect((await screen.findAllByText(/نیازمند سرور است/)).length).toBeGreaterThan(0);
    expect(shown()).toContain(flat("هنوز در سرور پیاده\u200cسازی نشده است."));
    expect(shown()).not.toContain("دمو");
  });
});
