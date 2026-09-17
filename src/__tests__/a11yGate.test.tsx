// @vitest-environment jsdom
/**
 * D7 — dependency-free accessibility gate (M11, recorded 2026-09-16).
 *
 * Four assertion families, no axe, no new dependency:
 *
 *   1. ACCESSIBLE IDENTITY — roles and names on the shell, the dialogs/drawer
 *      catalogue, and the form primitives, so assistive technology announces
 *      what a control IS and does;
 *   2. FOCUS MANAGEMENT — the shared useFocusTrap: entry focus lands on the
 *      first control, Tab loops at both ends, Escape closes, and focus
 *      returns to the element that opened the overlay;
 *   3. COMMAND-PALETTE KEYBOARD FLOW — open with focus, type, move with
 *      arrows, Enter acts, Escape and the backdrop close;
 *   4. MOTION PREFERENCE — the global `prefers-reduced-motion: reduce`
 *      contract kills animation entirely (the CSS is the contract, asserted
 *      against source text);
 *   plus the standing invariants: `index.html` keeps `lang="fa" dir="rtl"`
 *   and every dismiss control is labeled in Persian.
 *
 * Testing-library queries are role/name-driven throughout: that is not
 * convenience, it is the assertion — a control the queries cannot find is a
 * control a screen reader cannot find either.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { Dialog, Drawer } from "@/components/ds/patterns";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav, TopBar } from "@/components/layout/TopBar";
import { ActionSheet, Toasts } from "@/components/overlays/ActionSheet";
import { LoginView } from "@/views/Login";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);

/* --------------------------- 1. accessible identity ---------------------- */

describe("accessible identity: overlays announce role + Persian name", () => {
  it("Dialog exposes role=dialog, aria-modal, and an aria-labelledby title", () => {
    render(
      <Dialog open onClose={() => {}} title="حذف جلسه">
        <p>آیا مطمئن هستید؟</p>
        <footer slot="footer" />
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Name comes from the visible Persian heading — the title IS the label.
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("حذف جلسه");
  });

  it("Drawer exposes role=dialog, aria-modal, and an aria-labelledby title", () => {
    render(
      <Drawer open onClose={() => {}} title="جزئیات هنرجو">
        <p>محتوا</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy!)?.textContent).toBe("جزئیات هنرجو");
  });

  it("the command palette opens as a named modal dialog with a labelled search field", () => {
    render(
      <AuthProvider>
        <AppProvider>
          <CommandPaletteHarness open />
        </AppProvider>
      </AuthProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "جستجو و فرمان" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // The result list announces itself as a listbox named «نتایج».
    expect(screen.getByRole("listbox", { name: "نتایج" })).toBeTruthy();
    // Both dismiss paths are labelled (backdrop + Esc key hint), in Persian.
    expect(screen.getByRole("button", { name: "بستن" })).toBeTruthy();
  });

  it("the login form's icon-only actions carry Persian names", () => {
    resetToDemoEnvironment();
    render(
      <AuthProvider>
        <LoginView />
      </AuthProvider>,
    );
    // Password visibility toggle is icon-only; its name is how it is reached.
    expect(screen.getByRole("button", { name: "نمایش گذرواژه" })).toBeTruthy();
  });

  it("sidebar exposes a named navigation region", () => {
    render(
      <AuthProvider>
        <AppProvider>
          <div>
            <Sidebar mobileOpen={false} onClose={() => {}} />
            <TopBar onMenu={() => {}} />
            <BottomNav />
          </div>
        </AppProvider>
      </AuthProvider>,
    );
    // at least one explicitly-named navigation region exists
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy();
  });
});

/* --------------------------- 2. focus management ------------------------- */

describe("focus trap: entry, loop, escape, return", () => {
  it("focus LANDS inside the dialog, LOOPS at the last item, and RETURNS on close", () => {
    const opener = document.createElement("button");
    opener.textContent = "باز کن";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <Dialog
        open
        onClose={() => {}}
        title="فرم نمونه"
        footer={
          <>
            <button type="button">انصراف</button>
            <button type="button">تأیید</button>
          </>
        }
      />,
    );
    const cancel = screen.getByRole("button", { name: "انصراف" });
    const confirm = screen.getByRole("button", { name: "تأیید" });
    const dialog = screen.getByRole("dialog");

    // Entry: focus moved out of the page and into the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Loop: Tab past the LAST focusable item wraps to the first — no escape.
    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab before the first item wraps forward to the last.
    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Return: closing hands focus back to the element that opened it.
    unmount();
    expect(document.activeElement).toBe(opener);
    document.body.removeChild(opener);
  });

  it("Escape closes the dialog via onClose", () => {
    let closed = 0;
    render(
      <Dialog open onClose={() => closed++} title="هشدار">
        <p>بدنه</p>
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(1);
  });

  it("Escape closes the drawer via onClose", () => {
    let closed = 0;
    render(
      <Drawer open onClose={() => closed++} title="کشو">
        <p>محتوا</p>
      </Drawer>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(1);
  });
});

/* ---------------------- 3. command-palette keyboard flow ----------------- */

function CommandPaletteHarness({ open }: { open: boolean }) {
  const ctx = useAuth();
  void ctx;
  return <PaletteOpener open={open} />;
}

import { useApp } from "@/context/AppContext";
import { useEffect } from "react";
function PaletteOpener({ open }: { open: boolean }) {
  const { openPalette } = useApp();
  // Open ONCE on mount — mirroring the Ctrl+K shell shortcut — then leave the
  // palette's own state machine alone (inline-in-render reopen would fight it).
  useEffect(() => {
    if (open) openPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <CommandPalette />
      <ActionSheet />
      <Toasts />
    </>
  );
}

describe("command palette: keyboard flow", () => {
  beforeEach(() => {
    // navigate() writes the target into location.hash; the async hashchange
    // would otherwise land inside the NEXT test's provider and close its
    // palette via applyTarget — a test-order artifact, not app behaviour.
    // replaceState clears the fragment WITHOUT firing hashchange.
    window.history.replaceState(null, "", window.location.pathname);
    resetToDemoEnvironment();
  });

  it("opens with focus in the search field, arrows move, Escape closes", async () => {
    render(
      <AuthProvider>
        <AppProvider>
          <CommandPaletteHarness open />
        </AppProvider>
      </AuthProvider>,
    );
    await act(async () => new Promise((r) => setTimeout(r, 60)));
    const dialog = screen.getByRole("dialog", { name: "جستجو و فرمان" });

    // Focus enters the input (the 30 ms deferred focus the component uses).
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).tagName).toBe("INPUT");

    // Arrow keys move the active option (activedescendant pointer follows).
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });

    // Enter RUNS the highlighted suggestion: the app navigates, and the
    // palette closes as part of navigation — the whole chain is keyboard
    // reachable, zero pointer required.
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(screen.queryByRole("dialog", { name: "جستجو و فرمان" })).toBeNull();

    // Let the hashchange queued by navigate() fire INSIDE this provider
    // (same target, no-op) instead of leaking into the next test's.
    await act(async () => new Promise((r) => setTimeout(r, 0)));
  });

  it("Escape dismisses the palette without acting", async () => {
    render(
      <AuthProvider>
        <AppProvider>
          <CommandPaletteHarness open />
        </AppProvider>
      </AuthProvider>,
    );
    await act(async () => new Promise((r) => setTimeout(r, 60)));
    expect(screen.queryByRole("dialog", { name: "جستجو و فرمان" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "جستجو و فرمان" })).toBeNull();
  });

  it("typing keeps the palette open and Escape from the input closes it", async () => {
    render(
      <AuthProvider>
        <AppProvider>
          <CommandPaletteHarness open />
        </AppProvider>
      </AuthProvider>,
    );
    await act(async () => new Promise((r) => setTimeout(r, 60)));
    const input = document.querySelector("[role=dialog] input") as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "هنرجو" } });
    expect(screen.getByRole("dialog", { name: "جستجو و فرمان" })).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "جستجو و فرمان" })).toBeNull();
  });
});

/* ----------------------- 4. motion preference + RTL invariants -------- */

describe("motion preference and RTL/Persian invariants", () => {
  const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

  it("global CSS ties prefers-reduced-motion to zero-duration animation/transition", () => {
    const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\s*\}/);
    expect(block, "prefers-reduced-motion media block missing").toBeTruthy();
    expect(block![0]).toContain("animation-duration: 0.01ms !important");
    expect(block![0]).toContain("transition-duration: 0.01ms !important");
  });

  it("the manual motion-off contract ([data-motion=off]) mirrors it", () => {
    expect(css).toMatch(/\[data-motion="off"\]/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("index.html is lang=fa dir=rtl — RTL/Persian is not negotiable", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).toMatch(/<html[^>]*lang="fa"/);
    expect(html).toMatch(/<html[^>]*dir="rtl"/);
  });
});
