// @vitest-environment jsdom
/**
 * Branding has no server in the client composition (DOMAIN_UNAVAILABLE). The
 * panel must say that plainly: no generic "load failed", no internal domain id,
 * no retry that cannot succeed. Any other failure keeps the generic title and
 * the retry.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import type { BrandingRepository } from "@/domains/branding/repository";
import { resetRegistry, setBrandingRepository } from "@/domains/registry";
import { createUnavailableRepository } from "@/domains/shared/unavailableRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
  resetToDemoEnvironment();
  resetRegistry();
});
afterEach(() => {
  cleanup();
  resetRegistry();
});

function mount() {
  render(
    <AuthProvider>
      <AppProvider>
        <BrandingPanel />
      </AppProvider>
    </AuthProvider>,
  );
}

describe("BrandingPanel — read failures", () => {
  it("an unavailable capability is disclosed as such, without the domain id or a retry", async () => {
    setBrandingRepository(createUnavailableRepository<BrandingRepository>("branding", "هویت آموزشگاه"));
    mount();
    expect(await screen.findByText("هویت آموزشگاه در این نسخه در دسترس نیست")).toBeTruthy();
    expect(screen.queryByText(/بارگذاری ناموفق بود/)).toBeNull();
    expect(screen.queryByText(/branding/)).toBeNull();
    expect(screen.queryByRole("button", { name: /تلاش دوباره/ })).toBeNull();
  });

  it("any other failure keeps the generic title, its own message and the retry", async () => {
    setBrandingRepository({
      get: async () => {
        throw new ApiError({ kind: "server", message: "خطای تست" });
      },
    } as unknown as BrandingRepository);
    mount();
    expect(await screen.findByText("بارگذاری ناموفق بود")).toBeTruthy();
    expect(screen.getByText("خطای تست")).toBeTruthy();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
  });
});