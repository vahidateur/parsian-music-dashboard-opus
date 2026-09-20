// @vitest-environment jsdom
/**
 * The Drawer's scroll body must be allowed to shrink.
 *
 * WHY THIS FILE EXISTS
 *
 * `Drawer` is a column flex container whose height is capped — `max-h-[90vh]`
 * on mobile (bottom sheet), the viewport on desktop (`sm:inset-y-0`). Its
 * middle child is the scroll container: `flex-1 overflow-y-auto`.
 *
 * A flex item's initial `min-height` is `auto`, which resolves to the item's
 * CONTENT height. That default silently defeats `overflow-y-auto`: the body
 * refuses to shrink to the panel, grows past the capped container instead, and
 * the overflow is painted outside the panel — off the bottom of the viewport
 * and unreachable, because the scroll box never gets a height smaller than its
 * content. The symptom an operator reported was exactly that: a long profile
 * ran off the bottom of the screen and could not be scrolled.
 *
 * `min-h-0` on the scroll body is the whole fix, and it is invisible to every
 * other assertion in the suite, so it is asserted here.
 *
 * WHAT IS ASSERTED, AND WHY THIS SHAPE
 *
 * jsdom performs no layout, so `scrollHeight`/`clientHeight` prove nothing and
 * a pixel assertion would be a lie. What is checkable — and what actually
 * broke — is the structural contract in the class list: the Drawer panel is a
 * capped column flex container, and the descendant that carries `overflow-y-auto`
 * must also carry a zero minimum height so the two can work together.
 *
 * The lookup walks the real rendered DOM rather than reading source text, so
 * the test fails if the class is dropped, if the scroll body is moved to a
 * different element, or if `overflow-y-auto` is added to a NEW wrapper that
 * forgets the shrink permission.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer } from "@/components/ds/patterns";

afterEach(cleanup);

/** Split a className into a set of tokens, tolerating extra whitespace. */
const tokens = (el: Element): string[] => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/**
 * The panel element, not the overlay.
 *
 * `role="dialog"` sits on the OUTER fixed overlay (which also holds the backdrop
 * button). The capped column flex container this file is about is the panel
 * INSIDE it, so every assertion below works from the panel.
 */
function panelOf(dialog: HTMLElement): HTMLElement {
  const panel = dialog.querySelector("div");
  expect(panel, "the Drawer must render a panel element inside the dialog").not.toBeNull();
  return panel as HTMLElement;
}

function renderDrawer(props: Partial<Parameters<typeof Drawer>[0]> = {}) {
  render(
    <Drawer open onClose={() => {}} title="جزئیات هنرجو" {...props}>
      <p>محتوا</p>
    </Drawer>,
  );
  return panelOf(screen.getByRole("dialog"));
}

describe("Drawer scroll body can shrink to its panel", () => {
  it("caps the panel's height, which is what forces the body to shrink at all", () => {
    // The premise of the bug: a bounded panel. Mobile caps it at 90vh; desktop
    // pins it to the viewport. If neither held, overflow would scroll the page
    // and `min-h-0` would be moot — so the bound is asserted alongside the fix.
    const panel = renderDrawer();
    const cls = tokens(panel);
    expect(cls).toContain("flex-col");
    expect(cls).toContain("max-h-[90vh]");
    expect(cls).toContain("sm:max-h-none");
  });

  it("gives the scroll container a zero minimum height so overflow-y-auto can scroll", () => {
    const panel = renderDrawer();
    const scroller = panel.querySelector(".overflow-y-auto");
    expect(scroller, "the Drawer must still own an overflow-y-auto scroll body").not.toBeNull();
    const cls = tokens(scroller!);
    expect(cls, "the scroll body must remain a flex child that fills the panel").toContain("flex-1");
    // The regression: `min-height: auto` on a flex item is content-sized.
    expect(
      cls,
      "the Drawer's flex-1 scroll body needs `min-h-0`, or it grows past the capped panel and its content cannot be scrolled to",
    ).toContain("min-h-0");
  });

  it("still scrolls with a footer present — the footer must not steal the shrink", () => {
    // A footer is a third child in the same column. The body keeps the shrink
    // permission regardless, and the footer stays pinned outside the scroller.
    const panel = renderDrawer({ footer: <button type="button">تأیید</button> });
    const scroller = panel.querySelector(".overflow-y-auto")!;
    expect(tokens(scroller)).toContain("min-h-0");
    expect(scroller.contains(screen.getByRole("button", { name: "تأیید" }))).toBe(false);
  });

  it("preserves the accessible contract while fixing layout", () => {
    // The fix is CSS-only: identity, modality and the labelled title are intact.
    const panel = renderDrawer();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("جزئیات هنرجو");
    // Scoped to the panel header: the backdrop is ALSO labelled «بستن» by design
    // (it is a real dismiss control), so a document-wide query would be ambiguous.
    expect(
      panel.querySelector('header button[aria-label="بستن"]'),
      "the panel must keep its labelled close control",
    ).not.toBeNull();
  });
});
