// @vitest-environment jsdom
/**
 * The shell's academy identity is a read, not a constant.
 *
 * `useBranding` starts from `DEFAULT_BRANDING` and keeps it when a real branding
 * read fails. The shell used to render that default as if it were the academy's
 * own name and tagline. These cases pin the four states the identity can be in:
 * loading, loaded, the intentional DOMAIN_UNAVAILABLE organization fallback, and
 * an actual read failure that must be disclosed instead of shown as the default.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import type { BrandingRepository } from "@/domains/branding/repository";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/domains/branding/types";
import type { OrganizationRepository } from "@/domains/organization/repository";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@/domains/organization/types";
import {
  resetRegistry,
  setAuthRepository,
  setBrandingRepository,
  setOrganizationRepository,
  setUserRepository,
} from "@/domains/registry";
import { createUnavailableRepository } from "@/domains/shared/unavailableRepository";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Hero } from "@/components/hero/Hero";
import type { DayPulse } from "@/domains/shared/useDayPulse";
import { LoginView } from "@/views/Login";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const FAILURE = "هویت آموزشگاه خوانده نشد";
const LOADING = "در حال خواندن هویت آموزشگاه…";

let auth: LocalAuthRepository;

beforeEach(async () => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

function renderSidebar() {
  return render(
    <AuthProvider repository={auth}>
      <AppProvider>
        <Sidebar mobileOpen={false} onClose={() => undefined} />
      </AppProvider>
    </AuthProvider>,
  );
}

function renderLogin() {
  return render(
    <AuthProvider repository={auth}>
      <LoginView />
    </AuthProvider>,
  );
}

function renderTopBar() {
  return render(
    <AuthProvider repository={auth}>
      <AppProvider>
        <TopBar onMenu={() => undefined} />
      </AppProvider>
    </AuthProvider>,
  );
}

const quietPulse: DayPulse = {
  live: 0,
  conflicts: 0,
  firstConflictStart: null,
  sessions: [],
  clashIds: new Set(),
  loading: false,
  error: null,
};

function renderHero() {
  return render(
    <AuthProvider repository={auth}>
      <AppProvider>
        <Hero stats={[]} pulse={quietPulse} />
      </AppProvider>
    </AuthProvider>,
  );
}

function rejectingBranding(): BrandingRepository {
  return {
    get: async () => {
      throw new ApiError({ kind: "server", message: "سرویس برند در دسترس نیست." });
    },
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as BrandingRepository;
}

function brandingWith(academyName: string, tagline: string): BrandingRepository {
  return {
    get: async () => ({ ...DEFAULT_BRANDING, academyName, tagline }),
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as BrandingRepository;
}

function deferredBranding() {
  let resolve!: (value: BrandingSettings) => void;
  const promise = new Promise<BrandingSettings>((res) => {
    resolve = res;
  });
  const repo = {
    get: () => promise,
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as BrandingRepository;
  return { repo, resolve };
}

function organizationWith(name: string, tagline: string): OrganizationRepository {
  return {
    get: async () => ({ ...DEFAULT_ORGANIZATION_SETTINGS, name, tagline }),
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as OrganizationRepository;
}

describe("branding identity in the shell", () => {
  it("discloses a failed branding read instead of presenting the default academy identity", async () => {
    setBrandingRepository(rejectingBranding());
    renderSidebar();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(screen.queryByText(DEFAULT_BRANDING.academyName)).toBeNull();
    expect(screen.queryByText(DEFAULT_BRANDING.tagline)).toBeNull();
  });

  it("discloses the failure on the login surface too", async () => {
    setBrandingRepository(rejectingBranding());
    renderLogin();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(screen.queryByText(DEFAULT_BRANDING.tagline)).toBeNull();
  });

  it("discloses the failure in the top bar too", async () => {
    setBrandingRepository(rejectingBranding());
    renderTopBar();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(screen.queryByText(DEFAULT_BRANDING.academyName)).toBeNull();
  });

  it("discloses the failure in the hero too", async () => {
    setBrandingRepository(rejectingBranding());
    renderHero();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(screen.queryByText(DEFAULT_BRANDING.academyName)).toBeNull();
    expect(screen.queryByText(DEFAULT_BRANDING.tagline)).toBeNull();
  });

  it("does not present the default identity while the branding read is in flight", async () => {
    const deferred = deferredBranding();
    setBrandingRepository(deferred.repo);
    renderSidebar();

    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(screen.queryByText(DEFAULT_BRANDING.academyName)).toBeNull();

    await act(async () => {
      deferred.resolve({ ...DEFAULT_BRANDING, academyName: "آموزشگاه نوا", tagline: "شعار نوا" });
    });

    expect(await screen.findByText("آموزشگاه نوا")).toBeTruthy();
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("still renders successfully loaded branding", async () => {
    setBrandingRepository(brandingWith("آموزشگاه نوا", "شعار نوا"));
    renderSidebar();

    expect(await screen.findByText("آموزشگاه نوا")).toBeTruthy();
    expect(screen.getByText("شعار نوا")).toBeTruthy();
    expect(screen.queryByText(FAILURE)).toBeNull();
  });

  it("keeps the intentional DOMAIN_UNAVAILABLE organization fallback", async () => {
    setBrandingRepository(createUnavailableRepository<BrandingRepository>("branding", "هویت آموزشگاه"));
    setOrganizationRepository(organizationWith("آموزشگاه سازمانی", "شعار سازمانی"));
    renderSidebar();

    expect(await screen.findByText("آموزشگاه سازمانی")).toBeTruthy();
    expect(screen.getByText("شعار سازمانی")).toBeTruthy();
    expect(screen.queryByText(FAILURE)).toBeNull();
  });
});
