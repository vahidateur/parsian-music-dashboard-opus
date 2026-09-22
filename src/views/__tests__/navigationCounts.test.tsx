// @vitest-environment jsdom
/**
 * The navigation chrome carries no number it did not read.
 *
 * WHY THIS FILE EXISTS, NEXT TO `relationsNoFixtures.test.ts`
 *
 * The gate reads the SHAPE of the chrome: `navGroups` may not hold a static
 * badge or a digit inside a hint, and the quick-action data may not carry an
 * availability percentage. It cannot prove what the chrome RENDERS, because a
 * sidebar that shows no badge at all also passes a shape check. This file is the
 * other half, and it is split the same way the requirements were:
 *
 *   - the messages badge is the chat repository's own answer — the sum of
 *     `unread` over the conversation rows it returns — and it MOVES when a
 *     thread is read, which a literal cannot do;
 *   - it disappears entirely when that read cannot answer (in flight, failed, or
 *     a page that does not cover the set it counted), because a badge that
 *     guessed would be worse than no badge;
 *   - the attendance item carries no badge at all: there is no scoped,
 *     pageable "unrecorded sessions" read in the attendance domain, and the
 *     chrome may not invent one;
 *   - the command palette's hints name a target or a filter, never a count, and
 *     the quick action's room option makes no availability claim.
 *
 * The retired literals are asserted absent from both the rendered DOM and the
 * data the chrome renders from, so a reintroduction fails here even if it is
 * written as an equivalent string rather than the exact old one.
 *
 * M-1 UPDATE: quick actions no longer carry hardcoded option arrays. The sheet
 * used to build fake forms from `["پیانو", "گیتار", ...]` and `["سارا احمدی", ...]`.
 * Those are gone — each action now routes to a real dialog or view that reads
 * its options from the repositories. The gate therefore asserts that the
 * definitions carry no option arrays, and that the real dialogs' room select
 * (from `useRooms`) does not make a percentage availability claim.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider, useApp } from "@/context/AppContext";
import { commandVerbs } from "@/components/overlays/commands";
import { quickActions } from "@/components/overlays/ActionSheet";
import { navGroups } from "@/lib/navigation";
import type { QuickActionDef } from "@/lib/viewContracts";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { getChatRepository, resetRegistry, setAuthRepository, setChatRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { ActionSheet } from "@/components/overlays/ActionSheet";
import { Sidebar } from "@/components/layout/Sidebar";
import { faNum } from "@/lib/format";

const DIGITS = /[۰-۹]/;

const freshUrl = () => window.history.replaceState(null, "", "#/");

const flat = (text: string) => text.replace(/\u200c/g, " ");

function has(text: string) {
  const shown = () => document.body.textContent ?? "";
  expect(flat(shown())).toContain(flat(text));
}

function hasNot(text: string) {
  const shown = () => document.body.textContent ?? "";
  expect(flat(shown())).not.toContain(flat(text));
}

const navRegion = (label: string) => screen.getByRole("navigation", { name: label });
const navItem = (label: string) => within(navRegion("ناوبری اصلی")).getByRole("button", { name: new RegExp(`^${label}`) });
const compactItem = (label: string) => screen.getByTitle(label);

async function renderNav() {
  freshUrl();
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  render(
    <AuthProvider repository={auth}>
      <AppProvider>
        <Sidebar mobileOpen={false} onClose={() => undefined} />
      </AppProvider>
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
  return auth;
}

function renderPalette() {
  function Harness() {
    const { openPalette } = useApp();
    useEffect(() => {
      openPalette();
    }, [openPalette]);
    return <CommandPalette />;
  }
  return render(
    <AppProvider>
      <Harness />
    </AppProvider>,
  );
}

function renderSheet(actionId: QuickActionDef["id"]) {
  function Harness() {
    const { openSheet } = useApp();
    useEffect(() => {
      openSheet(actionId);
    }, [openSheet, actionId]);
    return <ActionSheet />;
  }
  return render(
    <AppProvider>
      <Harness />
    </AppProvider>,
  );
}

beforeEach(() => {
  freshUrl();
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  freshUrl();
});

/* ------------------------------------------------------------------ */
/* Messages — a real count, and only when the read covers it           */
/* ------------------------------------------------------------------ */
describe("the messages badge", () => {
  it("is the unread total the chat repository returns, and follows a real read", async () => {
    const threads = await getChatRepository().listConversations({ per_page: 200 });
    const unread = threads.data.reduce((total, row) => total + row.unread, 0);
    expect(unread, "the demo dataset must hold unread conversations").toBeGreaterThan(0);

    await renderNav();
    expect(navItem("پیام‌ها").textContent).toContain(faNum(unread));
    expect(compactItem("پیام‌ها").textContent).toContain(faNum(unread));

    const thread = threads.data.find((row) => row.unread > 0)!;
    await getChatRepository().markRead(thread.id);

    const remaining = unread - thread.unread;
    await waitFor(() => expect(navItem("پیام‌ها").textContent).toContain(faNum(remaining)));
    expect(navItem("پیام‌ها").textContent).not.toContain(faNum(unread));
    const after = await getChatRepository().listConversations({ per_page: 200 });
    expect(after.data.reduce((total, row) => total + row.unread, 0)).toBe(remaining);
    expect(navItem("پیام‌ها").textContent).not.toContain(faNum(5));
  });

  it("shows no badge when the read cannot answer", async () => {
    setChatRepository(
      withStubs(getChatRepository(), {
        listConversations: async () => {
          throw new Error("chat unavailable");
        },
      }),
    );
    await renderNav();
    expect(navItem("پیام‌ها").textContent, "a failed read may not produce a number").not.toMatch(DIGITS);
    expect(compactItem("پیام‌ها").textContent, "a failed read may not produce a number").not.toMatch(DIGITS);

    cleanup();
    resetRegistry();
    setChatRepository(
      withStubs(getChatRepository(), {
        listConversations: async () => ({
          data: [{ id: "cv_x", name: "گفتگو", role: "group", topic: "—", lastMessageAt: "2026-09-01T00:00:00.000Z", lastMessagePreview: "—", unread: 4 }],
          meta: { page: 1, per_page: 200, total: 500 },
        }),
      }),
    );
    await renderNav();
    expect(navItem("پیام‌ها").textContent, "a partial page may not produce a number").not.toMatch(DIGITS);

    cleanup();
    resetRegistry();
    const threads = await getChatRepository().listConversations({ per_page: 200 });
    for (const row of threads.data.filter((t) => t.unread > 0)) await getChatRepository().markRead(row.id);
    await renderNav();
    expect(navItem("پیام‌ها").textContent).not.toMatch(DIGITS);
  });
});

/* ------------------------------------------------------------------ */
/* Attendance — no badge, because no scoped read can answer it         */
/* ------------------------------------------------------------------ */
describe("the attendance item", () => {
  it("carries no badge and claims no unrecorded-class count", async () => {
    await renderNav();

    const item = navItem("حضور و غیاب");
    expect(item.textContent, "the attendance item may not show a count").not.toMatch(DIGITS);
    expect(compactItem("حضور و غیاب").textContent, "the compact rail may not show a count").not.toMatch(DIGITS);

    hasNot("ثبت‌نشده");

    const attendance = navGroups.flatMap((group) => group.items).find((item) => item.id === "attendance");
    expect(attendance, "the navigation must still have its attendance item").toBeDefined();
    expect(attendance).not.toHaveProperty("badge");
    expect(attendance!.hint ?? "").not.toMatch(DIGITS);
  });
});

/* ------------------------------------------------------------------ */
/* The command palette — hints that name a target, not a count         */
/* ------------------------------------------------------------------ */
describe("the command palette", () => {
  it("renders its verbs without a fabricated count in any hint", async () => {
    renderPalette();

    expect(await screen.findByText("فاکتورهای سررسید گذشته")).toBeTruthy();
    has("مالی · سررسید گذشته");
    has("حضور · کلاس‌های ثبت‌نشده");
    has("هنرجویان · در معرض ریزش");

    hasNot("مالی · ۳ مورد");
    hasNot("حضور · ۳ کلاس ثبت‌نشده");
    hasNot("هنرجویان · ۵ نفر");
    hasNot("۳ کلاس ثبت‌نشده");
  });

  it("keeps every hint it renders free of a written-in number", async () => {
    renderPalette();
    await screen.findByText("فاکتورهای سررسید گذشته");

    for (const verb of commandVerbs) {
      expect(verb.hint, `command hint 「${verb.hint}」 carries a written-in number`).not.toMatch(DIGITS);
    }
    for (const group of navGroups) {
      for (const item of group.items) {
        expect(item.hint ?? "", `nav hint 「${item.hint}」 carries a written-in number`).not.toMatch(DIGITS);
        expect(item).not.toHaveProperty("badge");
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Quick actions — M-1: no hardcoded option arrays, real dialogs        */
/* ------------------------------------------------------------------ */
describe("quick actions M-1", () => {
  it("carry no hardcoded option arrays — fields are gone, options come from repos", () => {
    // The old sheet built fake forms from hardcoded arrays like
    // ["پیانو", "گیتار", ...] and ["سارا احمدی", ...]. M-1 removes them.
    for (const action of quickActions) {
      // fields is optional now; if present it must be empty and carry no options
      if (action.fields) {
        expect(action.fields.length, `quick action ${action.id} still carries fields`).toBe(0);
        for (const field of action.fields) {
          expect(field.options ?? [], `field ${field.label} still carries hardcoded options`).toHaveLength(0);
        }
      }
      // The definition itself must not contain the old hardcoded literals
      const json = JSON.stringify(action);
      expect(json).not.toContain("پیانو");
      expect(json).not.toContain("سارا احمدی");
      expect(json).not.toContain("اتاق ۱");
      expect(json).not.toContain("کارت‌خوان");
      expect(json).not.toContain("هنرجویان در معرض ریزش");
    }

    // No option may carry a parenthesised count or a percentage — the old
    // fake form used "هنرجویان در معرض ریزش (۵)" and "۵۸٪ آزاد".
    for (const action of quickActions) {
      for (const field of action.fields ?? []) {
        for (const option of field.options ?? []) {
          expect(option, `option 「${option}」 carries a written-in count`).not.toMatch(/\([۰-۹]+\)/);
          expect(option, `option 「${option}」 makes a percentage claim`).not.toContain("٪");
        }
      }
    }
  });

  it("student quick action renders the real StudentFormDialog", async () => {
    renderSheet("student");
    // StudentFormDialog title is "هنرجوی جدید" when creating
    expect(await screen.findByText("هنرجوی جدید")).toBeTruthy();
    // It has a real instrument select from the catalog, not hardcoded options
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
    // No fake submit toast "این فرم هنوز به سرور متصل نیست" should be in the sheet
    hasNot("این فرم هنوز به سرور متصل نیست");
  });

  it("class quick action renders the real ClassFormDialog with rooms from repo, no % claim", async () => {
    renderSheet("class");
    expect(await screen.findByText("کلاس جدید")).toBeTruthy();

    // Room select comes from useRooms (real repo), not hardcoded ["اتاق ۱", ...]
    const roomSelect = await screen.findByRole("combobox", { name: /اتاق/ });
    const options = within(roomSelect)
      .getAllByRole("option")
      .map((o) => flat(o.textContent ?? ""));

    // At least one real room from demo seed should be present (e.g. contains "اتاق")
    expect(options.some((label) => label.includes("اتاق"))).toBe(true);
    for (const label of options) {
      // No availability percentage claim like "۵۸٪ آزاد"
      expect(label, `room option 「${label}」 makes an availability claim`).not.toContain("٪");
      // The old hardcoded list had "اتاق ۴" — we no longer assert that literal,
      // but we assert no fabricated percentage and no parenthesised count that
      // is a claim (capacity display like "(ظرفیت ۶)" is allowed as it is a real
      // measurement from the room record, but we forbid "%").
    }
    hasNot("۵۸٪ آزاد");
    hasNot("این فرم هنوز به سرور متصل نیست");
  });

  it("payment quick action shows honest Finance deferral, not a fake form", async () => {
    renderSheet("payment");
    expect(await screen.findByText("ثبت پرداخت")).toBeTruthy();
    // Honest deferral copy
    expect(await screen.findByText(/گزارش مالی نیازمند سرور است/)).toBeTruthy();
    // No fake inputs like "مبلغ (تومان)" with placeholder "۱٬۲۰۰٬۰۰۰"
    hasNot("۱٬۲۰۰٬۰۰۰");
  });

  it("message quick action navigates to messages view", async () => {
    // Message quick action triggers navigation via AppContext.navigate, which
    // updates hash. We assert that after opening the sheet, the hash becomes
    // #/messages and the sheet closes (no dialog remains).
    renderSheet("message");
    await waitFor(() => {
      expect(window.location.pathname).toContain("messages");
    });
    // The sheet should have closed itself (returns null), so no dialog title
    // from the old fake form should be present.
    hasNot("ارسال پیام");
  });
});
