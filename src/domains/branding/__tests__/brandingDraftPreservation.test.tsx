// @vitest-environment jsdom
/**
 * D3 — BrandingPanel draft preservation.
 *
 * Race: user edits the academy name → a background refresh (any `bumpDataVersion`,
 * e.g. another domain's write) re-reads branding → the adopt-on-refresh effect
 * overwrites the in-progress draft with the old persisted value → the unsaved
 * edit disappears and Save goes disabled.
 *
 *   1. unsaved edits survive a background refresh, and save sends the edit;
 *   2. server updates are still adopted while no local edit is in progress.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import type { BrandingRepository } from "@/domains/branding/repository";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/domains/branding/types";
import {
  resetRegistry,
  setAuthRepository,
  setBrandingRepository,
  setUserRepository,
} from "@/domains/registry";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const PERSISTED_NAME = "آموزشگاه پارسیان";
const EDITED_NAME = "نام ویرایش‌شدهٔ ذخیره‌نشده";
const SERVER_NAME = "نام تازهٔ سرور";

function serverBackedRepo(persisted: { current: BrandingSettings }) {
  const get = vi.fn(async (): Promise<BrandingSettings> => ({ ...persisted.current }));
  const update = vi.fn(async (input: Partial<BrandingSettings>): Promise<BrandingSettings> => {
    persisted.current = { ...persisted.current, ...input, updatedAt: "2026-10-30T00:00:00.000Z" };
    return { ...persisted.current };
  });
  // A fresh object per read, like every real repository: identity changes on
  // every refresh even when the values did not.
  setBrandingRepository({ get, update } as unknown as BrandingRepository);
  return { get, update };
}

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

function persistedWith(name: string) {
  return { current: { ...DEFAULT_BRANDING, academyName: name, updatedAt: "2026-10-01T00:00:00.000Z" } };
}

describe("BrandingPanel draft preservation (D3)", () => {
  it("edit → background refresh with the old persisted value → draft stays → save sends the edit", async () => {
    const persisted = persistedWith(PERSISTED_NAME);
    const { get, update } = serverBackedRepo(persisted);
    mount();
    const name = (await screen.findByDisplayValue(PERSISTED_NAME)) as HTMLInputElement;
    const readsBeforeEdit = get.mock.calls.length;

    fireEvent.change(name, { target: { value: EDITED_NAME } });
    expect(name.value).toBe(EDITED_NAME);

    // Background refresh: another domain wrote, the server value is unchanged.
    bumpDataVersion();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(readsBeforeEdit));
    // Let the refresh round-trip (read → setBranding → adopt effect) fully
    // land: without this flush the assertion below can read the draft before
    // the buggy overwrite propagates and the race escapes the test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The in-progress edit must survive the refresh…
    expect(name.value).toBe(EDITED_NAME);
    // …so Save stays available and sends the draft, not the stale server value.
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toMatchObject({ academyName: EDITED_NAME });
  });

  it("a server update with no local edit is adopted on refresh", async () => {
    const persisted = persistedWith(PERSISTED_NAME);
    const { get } = serverBackedRepo(persisted);
    mount();
    await screen.findByDisplayValue(PERSISTED_NAME);
    const readsBefore = get.mock.calls.length;

    persisted.current = { ...persisted.current, academyName: SERVER_NAME };
    bumpDataVersion();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(readsBefore));

    expect(await screen.findByDisplayValue(SERVER_NAME)).toBeTruthy();
  });

  it("a failed save keeps the draft so retry sends the edit", async () => {
    const persisted = persistedWith(PERSISTED_NAME);
    const { update } = serverBackedRepo(persisted);
    update.mockRejectedValueOnce(new ApiError({ kind: "server", message: "خطای ذخیره‌سازی تست" }));
    mount();
    const name = (await screen.findByDisplayValue(PERSISTED_NAME)) as HTMLInputElement;

    fireEvent.change(name, { target: { value: EDITED_NAME } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    // Let the post-failure effect run (`saving` flips back with the same
    // server copy): the pre-fix code reset the draft here, losing the edit
    // and disabling Save. (Failure toasts render in the app shell, which this
    // focused mount does not include, so the draft itself is the signal.)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(name.value).toBe(EDITED_NAME);
    const save = screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][0]).toMatchObject({ academyName: EDITED_NAME });
  });
});
