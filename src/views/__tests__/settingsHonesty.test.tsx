// @vitest-environment jsdom
/**
 * M-6 SETTINGS HONESTY
 *
 * Verifies that Settings surface is honest about what is actually functional.
 *
 * - Functional settings (branding, users, rooms, instruments, learning, repertoire, gallery, import/export, appearance local) remain functional and disclose correctly
 * - Unimplemented settings (notifications, localization, session rules, working hours) do NOT report fake success, are disabled, and disclose honestly
 * - Demo/local-only settings (appearance) are labeled as device-local
 * - API-mode unavailable capabilities are disclosed as requiring server
 * - Loading state distinct from empty/default
 * - Read/write failure disclosed rather than converted to success/default
 * - Branding behavior intact
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { SettingsView } from "@/views/Settings";
import {
  getBrandingRepository,
  getOrganizationRepository,
  resetRegistry,
  setBrandingRepository,
} from "@/domains/registry";
import { ApiError } from "@/api/errors";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { demoStore } from "@/services/demoStore";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  window.location.hash = "#/settings";
});

function renderSettings() {
  return render(
    <AppProvider>
      <SettingsView />
    </AppProvider>,
  );
}

async function renderSettingsWithAuth() {
  const { DEMO_PASSPHRASE, DemoAuthRepository } = await import("@/domains/auth/demoAuthRepository");
  const { DemoUserRepository } = await import("@/domains/auth/userRepository");
  const { setAuthRepository, setUserRepository } = await import("@/domains/registry");
  const { AuthProvider } = await import("@/domains/auth/AuthContext");
  const { demoStore, memoryStorage } = await import("@/services/demoStore");
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  return render(
    <AuthProvider>
      <AppProvider>
        <SettingsView />
      </AppProvider>
    </AuthProvider>,
  );
}

describe("M-6 functional settings remain functional", () => {
  it("branding panel loads and shows academy name from repository", async () => {
    const branding = await getBrandingRepository().get();
    renderSettings();
    // BrandingPanel shows loading first, then the name
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    // Academy name input should contain the persisted name
    const input = await screen.findByDisplayValue(branding.academyName);
    expect(input).toBeTruthy();
  });

  it("appearance section is labeled as device-local, not server-persisted", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    // Switch to appearance
    const appearanceBtn = screen.getByRole("button", { name: /ظاهر/ });
    fireEvent.click(appearanceBtn);
    // Kicker says changes saved for this device
    expect(await screen.findByText(/برای این دستگاه ذخیره می‌شود/)).toBeTruthy();
    // Density description says on this device
    expect(screen.getByText(/رفتار رابط کاربری روی این دستگاه/)).toBeTruthy();
    // Theme buttons exist
    expect(screen.getByText(/تیرهٔ کنسرواتوار/)).toBeTruthy();
    expect(screen.getByText(/شیشه‌ای/)).toBeTruthy();
  });

  it("branding behavior intact — update persists and survives reload", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    const repo = getBrandingRepository();
    await repo.update({ academyName: "آموزشگاه تست M6" });
    const after = await getBrandingRepository().get();
    expect(after.academyName).toBe("آموزشگاه تست M6");
    // New instance should read same value (persisted in demoStore, not just instance)
    const fresh = demoStore.branding.get();
    expect(fresh.academyName).toBe("آموزشگاه تست M6");
  });
});

describe("M-6 unimplemented settings do NOT report fake success", () => {
  it("notifications panel discloses server requirement and disables toggles", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /اعلان‌ها/ }));
    // Honest deferral notice — specific to events
    const notice = await screen.findByText(/اعلان‌ها نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده/);
    expect(notice.textContent).toContain("ذخیره نمی‌شود");
    expect(notice.textContent).toContain("صرفاً نمایشی");
    // Second notice for channels
    const channelNotice = await screen.findByText(/کانال‌های اعلان نیازمند سرور است/);
    expect(channelNotice.textContent).toContain("ذخیره نمی‌شود");
    // Toggles should be disabled
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThan(0);
    for (const sw of switches) {
      expect((sw as HTMLButtonElement).disabled).toBe(true);
    }
    // Should mention server — check all texts contain server need
    expect(screen.getAllByText(/به سرور نیاز دارد/).length).toBeGreaterThan(0);
  });

  it("localization panel discloses not connected and disables selects", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /بومی‌سازی/ }));
    const notice = await screen.findByText(/بومی‌سازی هنوز به دامنهٔ تنظیمات متصل نشده/);
    expect(notice.textContent).toContain("صرفاً نمایشی");
    expect(notice.textContent).toContain("ذخیره نمی‌شود");
    // Selects should be disabled
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    // At least 6 selects in localization
    expect(selects.length).toBeGreaterThanOrEqual(6);
    for (const sel of selects) {
      expect(sel.disabled).toBe(true);
    }
  });

  /*
    These three used to assert that the session rules and working hours were
    DISABLED and disclosed as display-only. That was the honest state of a panel
    that stored nothing — but a disabled input next to a real schedule is not a
    neutral choice: it reads as "the academy has no say in its own rules". They are
    functional now, so the honesty being tested is different and stricter: the
    fields are enabled, they carry the values the repository holds, saving writes
    through it, and each rule names what it actually governs.
  */
  it("session rules are editable, carry the stored values and name their consumers", async () => {
    const rendered = await renderSettingsWithAuth();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /عملیات آموزشگاه/ }));

    // The notice that said "not connected / display-only" is gone.
    expect(screen.queryByText(/قواعد جلسه هنوز به دامنهٔ زمان‌بندی متصل نشده/)).toBeNull();

    const duration = (await screen.findByLabelText(/مدت پیش‌فرض جلسه/)) as HTMLInputElement;
    expect(duration.disabled).toBe(false);
    // The value comes from the record, not from a hard-coded defaultValue.
    const stored = await getOrganizationRepository().get();
    expect(duration.value).toBe(String(stored.defaultSessionMinutes));

    // Each rule states what reads it, so a value is never decorative.
    expect(screen.getByText(/هشدار «فرصت کم برای جابجایی»/)).toBeTruthy();
    expect(screen.getByText(/هنگام ثبت جبرانی اعمال می‌شود/)).toBeTruthy();
    rendered.unmount();
  });

  it("saving a session rule writes it through the repository", async () => {
    const rendered = await renderSettingsWithAuth();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /عملیات آموزشگاه/ }));

    const duration = (await screen.findByLabelText(/مدت پیش‌فرض جلسه/)) as HTMLInputElement;
    fireEvent.change(duration, { target: { value: "۹۰" } }); // Persian digits, as typed
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ قواعد/ }));

    await waitFor(async () => {
      expect((await getOrganizationRepository().get()).defaultSessionMinutes).toBe(90);
    });
    /*
      Wait for the field to show the SAVED value before typing again: that is the
      frame where the write has landed and the form is idle. Typing into a field
      that is still disabled mid-save would be a test racing the UI it tests.
    */
    const saved = await screen.findByDisplayValue("90");

    // And an out-of-range rule is refused rather than stored.
    fireEvent.change(saved, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ قواعد/ }));
    expect(await screen.findByText(/باید بین/)).toBeTruthy();
    expect((await getOrganizationRepository().get()).defaultSessionMinutes).toBe(90);
    rendered.unmount();
  });

  it("working hours are editable and state what they govern", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    // Profile is the default section, so the working hours panel is visible.
    expect(screen.queryByText(/ساعات کاری هنوز به دامنهٔ زمان‌بندی متصل نشده/)).toBeNull();

    const stored = await getOrganizationRepository().get();
    const start = (await screen.findByLabelText(/شروع روز کاری/)) as HTMLInputElement;
    expect(start.disabled).toBe(false);
    expect(start.value).toBe(stored.workingDayStart);

    // Friday is closed by default, and the panel says what closing a day does.
    const friday = screen.getByRole("button", { name: /جمعه/ });
    expect(friday.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/روزهای تعطیل جلسهٔ تازه نمی‌سازند/)).toBeTruthy();

    // Opening Friday is one click, and it persists.
    fireEvent.click(friday);
    expect(friday.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ ساعات کاری/ }));
    await waitFor(async () => {
      expect((await getOrganizationRepository().get()).closedWeekdays).toEqual([]);
    });
  });

  it("no unimplemented setting reports fake success like 'ذخیره شد' without repository write", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    // In notifications, localization, session rules, working hours, there should be no enabled save that claims success
    // Check that all switches in notifications are disabled, so no dirty
    fireEvent.click(screen.getByRole("button", { name: /اعلان‌ها/ }));
    await screen.findByText(/اعلان‌ها نیازمند سرور است/);
    // Top save button should NOT appear because disabled controls don't set dirty
    expect(screen.queryByText(/ذخیرهٔ تغییرات/)).toBeNull();
    expect(screen.getByText(/همه‌چیز ذخیره شده/)).toBeTruthy();
  });
});

describe("M-6 loading distinct from empty/default", () => {
  it("branding loading state distinct from empty", async () => {
    const real = getBrandingRepository();
    let resolve!: (v: any) => void;
    const pending = new Promise((res) => (resolve = res));
    setBrandingRepository(
      withStubs(real, {
        get: () => pending,
      } as Stubs<typeof real>),
    );
    renderSettings();
    expect(await screen.findByText(/در حال بارگذاری هویت آموزشگاه/)).toBeTruthy();
    // Should NOT show empty or default name yet
    expect(screen.queryByDisplayValue(real ? "" : "")).toBeNull();
    resolve(await real.get());
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull());
  });

  it("branding read failure disclosed with retry, not converted to default", async () => {
    const real = getBrandingRepository();
    setBrandingRepository(
      withStubs(real, {
        get: async () => {
          throw new ApiError({ kind: "server", message: "هویت آموزشگاه در دسترس نیست." });
        },
      } as Stubs<typeof real>),
    );
    renderSettings();
    const err = await screen.findByText(/بارگذاری ناموفق بود/);
    expect(err).toBeTruthy();
    expect(screen.getByText(/هویت آموزشگاه در دسترس نیست/)).toBeTruthy();
    // Should have retry button
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
    // Should NOT show default name as if loaded
    expect(screen.queryByDisplayValue(/آموزشگاه موسیقی پارسیان/)).toBeNull();
  });
});

describe("M-6 API-mode unavailable disclosed", () => {
  it("notifications and localization mention server requirement", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /اعلان‌ها/ }));
    await screen.findByText(/اعلان‌ها نیازمند سرور است/);
    expect(screen.getAllByText(/نیازمند سرور است/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /بومی‌سازی/ }));
    await screen.findByText(/به سرور و دامنهٔ تنظیمات نیاز دارد/);
    // For operations, need auth wrapper
  });

  it("the rules panel says where its record lives, per environment", async () => {
    const rendered = await renderSettingsWithAuth();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /عملیات آموزشگاه/ }));
    await screen.findByLabelText(/مدت پیش‌فرض جلسه/);
    /*
      In the demo environment the rules ARE persisted — in the academy dataset —
      so the panel says that, and stops claiming a server is required for a write
      that already works. The API-mode sentence ("به سرور نیاز دارد") is the same
      disclosure from the other side, and `ApiOrganizationRepository` is the
      contract it refers to.
    */
    expect(screen.getAllByText(/در همین محیط ذخیره می‌شود/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/قواعد جلسه هنوز به دامنهٔ زمان‌بندی متصل نشده/)).toBeNull();
    rendered.unmount();
  });
});

describe("M-6 existing Settings behavior not broken", () => {
  it("profile still shows branding panel with functional save", async () => {
    renderSettings();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 5000 });
    expect(screen.getByText(/هویت آموزشگاه/)).toBeTruthy();
    expect(screen.getByText(/نام و شعاری که در سراسر سامانه دیده می‌شود/)).toBeTruthy();
  });

  it("operations still shows functional panels", async () => {
    const rendered = await renderSettingsWithAuth();
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull(), { timeout: 8000 });
    const opsBtn = screen.getByRole("button", { name: /عملیات آموزشگاه/ });
    fireEvent.click(opsBtn);
    // Session rules is static and should appear immediately, rooms/instruments need repo reads
    // Use getAllByText because nav hint also contains the phrase
    await waitFor(() => expect(screen.getAllByText(/قواعد جلسه/).length).toBeGreaterThanOrEqual(1), { timeout: 10000 });
    // At least one functional panel should appear
    await waitFor(() => {
      const hasRooms = screen.queryAllByText(/اتاق‌ها/).length > 0;
      const hasInstruments = screen.queryByText(/سازها و رشته‌ها/);
      expect(hasRooms || hasInstruments).toBeTruthy();
    }, { timeout: 10000 });
    rendered.unmount();
  }, 20000);
});
