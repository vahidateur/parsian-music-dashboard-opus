// @vitest-environment jsdom
/**
 * Phase B — mutation guards the RBAC contract already named.
 *
 * These cases log in through the real demo session. They do not claim the
 * server enforces anything. A control is absent only after the session has
 * restored, so a still-restoring frame cannot fake a denial.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { AppProvider } from "@/context/AppContext";
import { useAuth } from "@/domains/auth/AuthContext";
import { clearRolePolicies, setRolePolicies } from "@/domains/auth/permissions";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { FinanceView } from "@/views/Finance";
import { MessagesView } from "@/views/Messages";
import { BrandingPanel } from "@/domains/branding/BrandingPanel";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { ImportExportCenter } from "@/domains/import/ImportExportCenter";

afterEach(() => {
  cleanup();
  clearRolePolicies();
  resetRegistry();
});

beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  clearRolePolicies();
});

function AuthMarker() {
  const { status, user } = useAuth();
  return <span data-testid="auth-marker">{`${status}:${user?.role ?? "none"}`}</span>;
}

async function renderAs(email: string, node: ReactElement) {
  const { DEMO_PASSPHRASE, LocalAuthRepository } = await import("@/domains/auth/localAuthRepository");
  const { LocalUserRepository } = await import("@/domains/auth/localUserRepository");
  const { setAuthRepository, setUserRepository } = await import("@/domains/registry");
  const { AuthProvider } = await import("@/domains/auth/AuthContext");
  const { memoryStorage } = await import("@/services/demoStore");
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  const session = await auth.login({ email, password: DEMO_PASSPHRASE });
  if (!session) throw new Error(`login failed for ${email}`);
  const view = render(
    <AuthProvider>
      <AppProvider>
        <AuthMarker />
        {node}
      </AppProvider>
    </AuthProvider>,
  );
  await screen.findByText(`authenticated:${session.user.role}`);
  return view;
}

describe("Phase B mutation guards", () => {
  it("hides finance payment recording from a role without finance.write", async () => {
    await renderAs("manager@demo.local", <FinanceView />);
    expect(screen.getByRole("button", { name: /خروجی/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ثبت پرداخت/ })).toBeNull();
  });

  it("shows finance payment recording to the accountant", async () => {
    await renderAs("finance@demo.local", <FinanceView />);
    expect(screen.getByRole("button", { name: /ثبت پرداخت/ })).toBeTruthy();
  });

  it("hides message writes from a reader and keeps the thread list", async () => {
    await renderAs("finance@demo.local", <MessagesView />);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
    expect(screen.queryByRole("button", { name: "گفتگوی جدید" })).toBeNull();
    expect(screen.queryByLabelText("متن پیام")).toBeNull();
    expect(screen.queryByRole("button", { name: "مدیریت گفتگو" })).toBeNull();
    expect(screen.getByText("ارسال پیام برای این نقش فعال نیست.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "فهرست گفتگوها" })).toBeTruthy();
  });

  it("keeps message writes for a teacher", async () => {
    await renderAs("teacher1@demo.local", <MessagesView />);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
    expect(screen.getByRole("button", { name: "گفتگوی جدید" })).toBeTruthy();
    expect(screen.getByLabelText("متن پیام")).toBeTruthy();
  });

  it("hides branding save from a settings reader", async () => {
    await renderAs("manager@demo.local", <BrandingPanel />);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull());
    expect(screen.queryByRole("button", { name: /ذخیرهٔ تغییرات/ })).toBeNull();
    expect(screen.getByText("ویرایش هویت آموزشگاه برای این نقش فعال نیست.")).toBeTruthy();
    expect((screen.getByDisplayValue("آموزشگاه موسیقی پارسیان") as HTMLInputElement).disabled).toBe(true);
  });

  it("keeps branding save for the administrator", async () => {
    await renderAs("admin@demo.local", <BrandingPanel />);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری هویت آموزشگاه/)).toBeNull());
    expect(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ })).toBeTruthy();
    expect((screen.getByDisplayValue("آموزشگاه موسیقی پارسیان") as HTMLInputElement).disabled).toBe(false);
  });

  it("hides gallery writes from a role without library.write", async () => {
    await renderAs("finance@demo.local", <GalleryPanel />);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری گالری/)).toBeNull());
    expect(await screen.findByText("کنسرت پایان ترم")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /افزودن تصویر/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "افزودن" })).toBeNull();
  });

  it("keeps gallery writes for a manager", async () => {
    await renderAs("manager@demo.local", <GalleryPanel />);
    await waitFor(() => expect(screen.queryByText(/در حال بارگذاری گالری/)).toBeNull());
    expect(await screen.findByRole("button", { name: /افزودن تصویر/ })).toBeTruthy();
  });

  it("filters settings export by the session permission set (I22)", async () => {
    await renderAs("admin@demo.local", <ImportExportCenter />);
    expect(screen.getByRole("button", { name: /دانلود خروجی/ })).toBeTruthy();
    expect(screen.queryByText("برای هیچ موجودیتی مجوز خروجی ندارید.")).toBeNull();
  });

  it("hides student import from a role without students.write and still exports what that role may read", async () => {
    await renderAs("finance@demo.local", <ImportExportCenter />);
    expect(screen.getByText("ورود هنرجو برای این نقش فعال نیست.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /انتخاب فایل/ })).toBeNull();
    expect(screen.getByRole("button", { name: /دانلود خروجی/ })).toBeTruthy();
    // The entity switcher is a tablist nested in a label, so the accessible name
    // is not the option text. Assert the visible labels instead.
    expect(screen.queryByText("مدرسین")).toBeNull();
    expect(screen.getByText("هنرجویان")).toBeTruthy();
  });

  it("shows the honest empty export state when the issued set has no export permission", async () => {
    setRolePolicies([
      {
        id: "accountant",
        label: "مالی",
        scope: "org",
        customized: true,
        permissions: ["finance.read", "finance.write"],
      },
    ]);
    await renderAs("finance@demo.local", <ImportExportCenter />);
    expect(screen.getByText("برای هیچ موجودیتی مجوز خروجی ندارید.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /دانلود خروجی/ })).toBeNull();
  });
});
