// @vitest-environment jsdom
/**
 * D7 · the command palette returns focus to the control that opened it (M11).
 *
 * The browser QA walk that found it: focus the palette trigger in the top bar,
 * open the palette, press Escape — and the focus indicator is gone, because
 * `document.activeElement` has fallen back to `<body>`. Not a styling artifact:
 * a keyboard user who closes the overlay has to Tab across the whole shell to get
 * back to where they were, and a screen reader announces the top of the document
 * instead of the control it just left.
 *
 * `Dialog`/`Drawer` do not have this problem, because `useFocusTrap`
 * (ds/patterns.tsx) saves `document.activeElement` on open and restores it in the
 * same effect's cleanup — `a11yGate.test.tsx` pins that for the Dialog, in the
 * "focus LANDS inside the dialog, LOOPS at the last item, and RETURNS on close"
 * case. The palette has no trap of its own: it enters focus by its own deferred
 * `inputRef.focus()`, so nothing was remembering the opener, and nothing was
 * handing it back.
 *
 * The four cases below are the fix's whole surface:
 *
 *   1. Escape — the path the QA walked, asserted on the exact element;
 *   2. the backdrop — a different close path, and it must behave identically;
 *   3. an opener removed while the palette was up — restore nothing, throw
 *      nothing (the failure this fix could otherwise introduce);
 *   4. an open with nothing focused — the Ctrl+K chord in `App.tsx`, which has no
 *      opener at all and must not have one invented for it.
 *
 * Case 4 is also why `a11yGate`'s palette harness stays untouched: it opens the
 * palette from an effect, so its "opener" is `<body>`, and a naive
 * `previous?.focus?.()` would aim focus at the document on every close there.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const DIALOG = { name: "جستجو و فرمان" } as const;
const TRIGGER_NAME = "باز کردن پالت";

afterEach(cleanup);

/**
 * The smallest harness that has a REAL opener: a focusable button whose click
 * calls `openPalette`, which is the path the QA walked. The existing
 * `CommandPaletteHarness` in `a11yGate.test.tsx` opens from an effect instead,
 * which is precisely the shape that cannot see this defect.
 *
 * `showTrigger` exists for case 3: re-rendering without it removes the opener
 * from the document while the palette stays up.
 */
function PaletteWithTrigger({ showTrigger = true }: { showTrigger?: boolean }) {
  const { openPalette } = useApp();
  return (
    <>
      {showTrigger && (
        <button type="button" onClick={openPalette}>
          {TRIGGER_NAME}
        </button>
      )}
      <CommandPalette />
    </>
  );
}

function renderPalette() {
  return render(
    <AuthProvider>
      <AppProvider>
        <PaletteWithTrigger />
      </AppProvider>
    </AuthProvider>,
  );
}

/** Opens by clicking, and waits past the component's 30 ms deferred input focus. */
async function openFrom(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.click(trigger);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
}

function paletteInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("[role=dialog] input");
  expect(input, "the palette's search field").not.toBeNull();
  return input as HTMLInputElement;
}

describe("command palette: focus return to the opener", () => {
  beforeEach(() => {
    // The guard `a11yGate` uses for the same reason: navigate() writes the target
    // into location.hash, and the async hashchange would close the NEXT test's
    // palette via applyTarget — a test-order artifact, not app behaviour.
    window.history.replaceState(null, "", window.location.pathname);
    resetToDemoEnvironment();
  });

  it("Escape returns focus to the exact element that opened the palette", async () => {
    renderPalette();
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });

    await openFrom(trigger);

    // Entry, unchanged by the fix: focus is inside the palette, in the search
    // field, on the deferred 30 ms focus the component already had.
    const dialog = screen.getByRole("dialog", DIALOG);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(paletteInput());

    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    // The assertion the defect was about: the same node, not merely "something in
    // the page", and not `<body>`.
    expect(document.activeElement).toBe(trigger);
    expect(document.activeElement).not.toBe(document.body);
    // The open path's body lock is undone on the same cleanup, as before.
    expect(document.body.style.overflow).toBe("");
  });

  it("the backdrop close path returns focus the same way", async () => {
    renderPalette();
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });

    await openFrom(trigger);
    expect(screen.getByRole("dialog", DIALOG)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "بستن" }));

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("an opener removed while the palette was up restores nothing and throws nothing", async () => {
    const { rerender } = render(
      <AuthProvider>
        <AppProvider>
          <PaletteWithTrigger />
        </AppProvider>
      </AuthProvider>,
    );
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    await openFrom(trigger);
    expect(document.activeElement).toBe(paletteInput());

    // The control that opened the palette goes away underneath it — a header that
    // re-renders, a responsive layout that drops the button. The saved node is
    // detached by the time the palette closes, so the restore has to notice.
    rerender(
      <AuthProvider>
        <AppProvider>
          <PaletteWithTrigger showTrigger={false} />
        </AppProvider>
      </AuthProvider>,
    );
    expect(trigger.isConnected).toBe(false);

    expect(() => fireEvent.keyDown(paletteInput(), { key: "Escape" })).not.toThrow();

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    // No crash, no resurrected node: focus stays in the live document.
    expect(document.activeElement).not.toBe(trigger);
    expect(document.contains(document.activeElement)).toBe(true);
  });

  it("an open with nothing focused invents no opener", async () => {
    renderPalette();
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });

    // The Ctrl+K path (`App.tsx`): a key chord has no focused control, so the
    // element remembered on open is `<body>`. Closing must leave the focus alone
    // rather than call `focus()` on the document.
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(trigger);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));

    const input = paletteInput();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });
});
