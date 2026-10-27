// @vitest-environment jsdom
/**
 * Client-composition availability: a capability the backend does not offer must
 * not look like a working control, and a decoration read (room names) that is
 * unavailable or policy-blocked must not take a whole page down.
 *
 * The target copy seam is pinned to the CLIENT variant for this file; the demo
 * side (controls present) is covered by the existing finance / quick-action
 * suites, which run on the demo variant.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/targets/targetCopy", async () => await import("@/targets/targetCopy.client"));

import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { quickActions } from "@/components/overlays/ActionSheet";
import { ProfilePhotoField } from "@/domains/media/ProfilePhotoField";
import { getRoomRepository, resetRegistry, setRoomRepository } from "@/domains/registry";
import { domainUnavailableError } from "@/domains/shared/unavailableRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { ClassesView } from "@/views/Classes";
import { FinanceView } from "@/views/Finance";
import { ReportsView } from "@/views/Reports";

const flat = (text: string) => text.replace(/\u200c/g, " ");
const shown = () => flat(document.body.textContent ?? "");
const settled = () => waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));

beforeEach(() => {
  resetRegistry();
  localStorage.clear();
  window.location.hash = "";
  resetToDemoEnvironment();
  resetRegistry();
});
afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("actions with no backend contract are not offered", () => {
  it("the quick-action list offers payment and message", () => {
    // Payment is served since §40 (invoices under finance.read/write), so the
    // quick action is offered and routes to the real surface. Message
    // navigation targets the in-app thread view, which §37 serves — hiding
    // either now that the server answers would be the dishonest direction.
    const ids = quickActions.map((a) => a.id);
    expect(ids).toContain("payment");
    expect(ids).toContain("message");
    expect(ids).toEqual(expect.arrayContaining(["student", "class"]));
  });

  it("Finance and Reports offer no export control", async () => {
    // Authenticated shell, signed out: write-gated controls stay hidden, so
    // this pins the export control only — the payment action is covered by
    // the quick-action test above and the finance view suite.
    render(
      <AuthProvider>
        <AppProvider>
          <FinanceView />
        </AppProvider>
      </AuthProvider>,
    );
    expect(screen.queryByRole("button", { name: /خروجی/ })).toBeNull();
    cleanup();
    render(
      <AuthProvider>
        <AppProvider>
          <ReportsView />
        </AppProvider>
      </AuthProvider>,
    );
    expect(screen.queryByRole("button", { name: /خروجی/ })).toBeNull();
  });

  it("the profile photo field offers the upload, because the server serves media now", () => {
    // The media domain left the unavailable list: the API stores the bytes and
    // authorizes their reader per object. A control the server can satisfy
    // must be offered — hiding it would be the dishonest direction.
    render(<ProfilePhotoField mediaId={undefined} personName="نمونه" onChange={() => {}} />);
    expect((screen.getByRole("button", { name: /افزودن تصویر/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(shown()).not.toContain(flat("بارگذاری تصویر در این نسخه در دسترس نیست"));
    expect(shown()).not.toContain(flat("نسخهٔ دمو"));
  });
});

describe("the classes page when the rooms read is not available", () => {
  const empty = { data: [], meta: { page: 1, per_page: 200, total: 0 } };
  void empty;

  function blockRooms(error: ApiError) {
    setRoomRepository(
      withStubs(getRoomRepository(), {
        list: async () => {
          throw error;
        },
      }),
    );
  }
  const render_ = () =>
    render(
      <AppProvider>
        <ClassesView />
      </AppProvider>,
    );

  it("a policy block keeps the classes, names the rooms as no-data, and never says 'no rooms'", async () => {
    blockRooms(
      new ApiError({ kind: "authorization", status: 403, code: "OWNER_DECISION_REQUIRED_PB3", message: "این بخش در این نسخه از سامانه در دسترس نیست." }),
    );
    render_();
    await settled();
    expect(shown()).not.toContain(flat("خواندن ثبت‌نام‌ها و اتاق‌های آموزشگاه ناموفق بود"));
    expect(shown()).not.toContain(flat("اتاقی ثبت نشده"));
    expect(shown()).toContain(flat("این درخواست مجاز نیست"));
    expect(screen.queryAllByRole("button", { name: /کلاس جدید/ }).length).toBeGreaterThan(0);
  });

  it("an unavailable capability is equally non-fatal and reads as unavailable", async () => {
    blockRooms(domainUnavailableError("rooms", "اتاق‌ها"));
    render_();
    await settled();
    expect(shown()).not.toContain(flat("اتاقی ثبت نشده"));
    expect(shown()).toContain(flat("این بخش در این نسخه در دسترس نیست"));
  });

  it("a real rooms failure still stops the page, with a retry", async () => {
    blockRooms(new ApiError({ kind: "server", status: 500, message: "خطای سرور اتاق‌ها" }));
    render_();
    await settled();
    expect(shown()).toContain(flat("خواندن ثبت‌نام‌ها و اتاق‌های آموزشگاه ناموفق بود"));
    expect(shown()).toContain(flat("خطای سرور اتاق‌ها"));
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
  });
});