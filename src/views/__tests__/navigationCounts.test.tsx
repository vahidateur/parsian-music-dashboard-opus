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

/** Persian digits, the script every claim in this chrome is written in. */
const DIGITS = /[۰-۹]/;

/*
  The shell closes its overlays on `hashchange` (AppContext applies every hash
  change as a target, and applying a target closes the palette). Assigning to
  `location.hash` therefore queues a hash change that lands AFTER a test has
  opened its palette and blanks the chrome mid-assertion. Rewriting the address
  without dispatching the event keeps the suite deterministic and asserts the
  chrome the user sees while it is open.
*/
const freshUrl = () => window.history.replaceState(null, "", "#/");

const flat = (text: string) => text.replace(/\u200c/g, " ");
const shown = () => document.body.textContent ?? "";

/** ZWNJ-insensitive containment: the product's Persian joins words with it. */
function has(text: string) {
  expect(flat(shown())).toContain(flat(text));
}

function hasNot(text: string) {
  expect(flat(shown())).not.toContain(flat(text));
}

/**
 * The nav button for a section. The shell renders the sidebar twice — the wide
 * rail and the compact one — so the queries address ONE of them by its nav
 * landmark, and the assertions about the other go through the `title` the
 * compact instance carries.
 */
const navRegion = (label: string) => screen.getByRole("navigation", { name: label });
const navItem = (label: string) => within(navRegion("ناوبری اصلی")).getByRole("button", { name: new RegExp(`^${label}`) });
const compactItem = (label: string) => screen.getByTitle(label);

/** Signs in, then renders the real sidebar over the authenticated shell tree. */
async function renderNav() {
  freshUrl();
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  // The DEMO environment's own administrator: the users come from the seed,
  // not from the empty environment's bootstrap account.
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

/** Renders the palette already open, as the shell's shortcut would. */
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

/** Renders one quick action's sheet already open. */
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
    // Both mounts of the sidebar show the same number, from the same read.
    expect(compactItem("پیام‌ها").textContent).toContain(faNum(unread));

    // A real write: opening a thread clears its counter, and the badge follows.
    const thread = threads.data.find((row) => row.unread > 0)!;
    await getChatRepository().markRead(thread.id);

    const remaining = unread - thread.unread;
    await waitFor(() => expect(navItem("پیام‌ها").textContent).toContain(faNum(remaining)));
    expect(navItem("پیام‌ها").textContent).not.toContain(faNum(unread));
    // The badge is the repository's answer, not a literal that happens to match.
    const after = await getChatRepository().listConversations({ per_page: 200 });
    expect(after.data.reduce((total, row) => total + row.unread, 0)).toBe(remaining);
    // The retired literal: nothing measured five.
    expect(navItem("پیام‌ها").textContent).not.toContain(faNum(5));
  });

  it("shows no badge when the read cannot answer", async () => {
    // 1. A failed read knows nothing.
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

    // 2. A page that does not cover the set it counted under-reports.
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

    // 3. Nothing unread: no badge, not a zero badge.
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

    // Nothing in the chrome claims a count of unrecorded classes.
    hasNot("ثبت‌نشده");

    /*
      And the data the chrome renders from carries no number either: no `badge`,
      and no digit in the hint. The nav hint is not rendered by the sidebar at
      all, which is exactly why the retired «۳ کلاس ثبت‌نشده» was invisible in
      the DOM and had to be caught in the data — the gate's rule, asserted here
      on the item it was written about.
    */
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

    // The verbs are there, with the copy they now carry.
    expect(await screen.findByText("فاکتورهای سررسید گذشته")).toBeTruthy();
    has("مالی · سررسید گذشته");
    has("حضور · کلاس‌های ثبت‌نشده");
    has("هنرجویان · در معرض ریزش");

    // The retired claims are gone from the rendered chrome.
    hasNot("مالی · ۳ مورد");
    hasNot("حضور · ۳ کلاس ثبت‌نشده");
    hasNot("هنرجویان · ۵ نفر");
    hasNot("۳ کلاس ثبت‌نشده");
  });

  it("keeps every hint it renders free of a written-in number", async () => {
    renderPalette();
    await screen.findByText("فاکتورهای سررسید گذشته");

    /*
      The hints in the DOM are the ones the chrome claims with. A derived count
      would have to be produced by a read at render time (and the gate allows
      exactly that form); what may not exist is a digit written into the copy,
      which is what the data assertions below pin down.
    */
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
/* Quick actions — no availability percentage without a contract        */
/* ------------------------------------------------------------------ */
describe("the class quick action", () => {
  it("offers the rooms without an availability percentage", async () => {
    renderSheet("class");
    const roomSelect = await screen.findByRole("combobox", { name: /اتاق/ });
    const options = within(roomSelect)
      .getAllByRole("option")
      .map((option) => flat(option.textContent ?? ""));

    expect(options.some((label) => label.includes("اتاق ۴"))).toBe(true);
    for (const label of options) {
      expect(label, `room option 「${label}」 makes an availability claim`).not.toContain("٪");
      expect(label, `room option 「${label}」 carries a written-in count`).not.toMatch(/\([۰-۹]+\)/);
    }
    hasNot("۵۸٪ آزاد");
  });

  it("keeps every quick-action option free of a static count", () => {
    // The recipients list used to read «هنرجویان در معرض ریزش (۵)»: a number
    // nobody counted, in a form that cannot count it (the sheet persists
    // nothing). The option names the group; it does not size it.
    for (const action of quickActions) {
      for (const field of action.fields) {
        for (const option of field.options ?? []) {
          // A name may contain a digit («اتاق ۱»); a CLAIM may not — a
          // parenthesised total or a percentage is a number nobody computed.
          expect(option, `option 「${option}」 carries a written-in count`).not.toMatch(/\([۰-۹]+\)/);
          expect(option, `option 「${option}」 makes a percentage claim`).not.toContain("٪");
        }
      }
    }
  });
});
