// @vitest-environment jsdom
/**
 * Branding has no server in the client composition (DOMAIN_UNAVAILABLE), but the
 * academy's name and tagline exist in the organization record, which has one.
 *
 *   - the identity is read from the organization and can be saved back to it;
 *   - colours and font are product defaults, not server data: shown as such,
 *     disabled, never written anywhere;
 *   - only when the organization is ALSO unavailable does the panel say the
 *     identity is unavailable; any other failure keeps the generic title + retry.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import type { BrandingRepository } from "@/domains/branding/repository";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@/domains/organization/types";
import type { OrganizationRepository } from "@/domains/organization/repository";
import {
  resetRegistry,
  setAuthRepository,
  setBrandingRepository,
  setOrganizationRepository,
  setUserRepository,
} from "@/domains/registry";
import { createUnavailableRepository } from "@/domains/shared/unavailableRepository";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

beforeEach(async () => {
  localStorage.clear();
  resetRegistry();
  resetToDemoEnvironment();
  resetRegistry();
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  const admin = demoStore.snapshot().users.find((u) => u.role === "administrator" && u.status === "active");
  await auth.login({ email: admin!.email, password: DEMO_PASSPHRASE });
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
const unavailableBranding = () =>
  setBrandingRepository(createUnavailableRepository<BrandingRepository>("branding", "هویت آموزشگاه"));

function organizationWith(name: string, tagline: string) {
  const update = vi.fn(async (input: { name?: string; tagline?: string }) => ({
    ...DEFAULT_ORGANIZATION_SETTINGS,
    name: input.name ?? name,
    tagline: input.tagline ?? tagline,
    updatedAt: "2026-10-07T00:00:00.000Z",
  }));
  const repo: OrganizationRepository = {
    get: async () => ({ ...DEFAULT_ORGANIZATION_SETTINGS, name, tagline, updatedAt: "2026-10-01T00:00:00.000Z" }),
    update: update as unknown as OrganizationRepository["update"],
  };
  return { repo, update };
}

describe("BrandingPanel without a branding server", () => {
  it("shows the organization's own name and tagline, not an 'unavailable' wall", async () => {
    unavailableBranding();
    setOrganizationRepository(organizationWith("آموزشگاه سازمانی", "شعار سازمانی").repo);
    mount();
    expect(await screen.findByDisplayValue("آموزشگاه سازمانی")).toBeTruthy();
    expect(screen.getByDisplayValue("شعار سازمانی")).toBeTruthy();
    expect(document.body.textContent).not.toContain("هویت آموزشگاه در این نسخه در دسترس نیست");
  });

  it("marks colours and font as not saveable and disables them; the name stays editable", async () => {
    unavailableBranding();
    setOrganizationRepository(organizationWith("آموزشگاه سازمانی", "شعار").repo);
    mount();
    const name = (await screen.findByDisplayValue("آموزشگاه سازمانی")) as HTMLInputElement;
    expect(name.disabled).toBe(false);
    expect(document.body.textContent).toContain("ذخیرهٔ رنگ‌ها و فونت برند در این نسخه در دسترس نیست");
    const font = screen.getByLabelText(/فونت فارسی/, { selector: "select" }) as HTMLSelectElement;
    expect(font.disabled).toBe(true);
    expect((screen.getByRole("button", { name: /بازنشانی به پیش‌فرض/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves name and tagline to the organization record, and nothing else", async () => {
    unavailableBranding();
    const org = organizationWith("آموزشگاه سازمانی", "شعار");
    setOrganizationRepository(org.repo);
    mount();
    const name = await screen.findByDisplayValue("آموزشگاه سازمانی");
    fireEvent.change(name, { target: { value: "نام تازه" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
    await waitFor(() => expect(org.update).toHaveBeenCalledTimes(1));
    expect(org.update).toHaveBeenCalledWith({ name: "نام تازه", tagline: "شعار" });
  });

  it("says the identity is unavailable only when the organization is unavailable too, without a retry", async () => {
    unavailableBranding();
    setOrganizationRepository(createUnavailableRepository<OrganizationRepository>("organization", "سازمان"));
    mount();
    expect(await screen.findByText("هویت آموزشگاه در این نسخه در دسترس نیست")).toBeTruthy();
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