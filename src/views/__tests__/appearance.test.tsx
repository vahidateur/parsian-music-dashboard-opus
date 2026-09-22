// @vitest-environment jsdom
/**
 * APPEARANCE — the settings surface behind the theme layer.
 *
 * The complaint this answers is one sentence long and very concrete: "the themes
 * are listed, but clicking one changes nothing in the panel." So the tests drive
 * the real surface and assert the *document*, not the toast: after a click the
 * stage attribute on `<html>` is the preset that was chosen, and after typing a
 * colour the custom property the CSS reads is the colour that was typed.
 *
 * The typed-colour tests include the case that motivated the alpha support —
 * `#9f9f9f9f` — and the case that would otherwise be silently broken: a light
 * background typed under a dark preset has to flip the direction every surface
 * lifts in, or the panels disappear into the page.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { SettingsView } from "@/views/Settings";
import { resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { PALETTE_SLOTS, THEMES, themeLabels } from "@/lib/theme";

const root = () => document.documentElement;
const onRoot = (property: string) => root().style.getPropertyValue(property);

function renderAppearance() {
  render(
    <AppProvider>
      <SettingsView />
    </AppProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /ظاهر/ }));
}

beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
  window.history.replaceState(null, "", "/settings");
  delete root().dataset.theme;
  for (const slot of PALETTE_SLOTS) root().style.removeProperty(slot.property);
  root().style.removeProperty("--viewer-mix");
});

afterEach(() => {
  cleanup();
  delete root().dataset.theme;
  for (const slot of PALETTE_SLOTS) root().style.removeProperty(slot.property);
  root().style.removeProperty("--viewer-mix");
});

describe("theme presets", () => {
  it("offers every preset the stylesheet implements", () => {
    renderAppearance();
    expect(THEMES).toEqual(["dark", "glass", "light", "contrast"]);
    for (const theme of THEMES) {
      expect(screen.getByRole("button", { name: new RegExp(themeLabels[theme]) })).toBeTruthy();
    }
  });

  it("changes the stage on the document when one is clicked — and says which is active", () => {
    renderAppearance();
    expect(root().dataset.theme, "the default preset is painted on load").toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: /روشنِ روزن/ }));
    expect(root().dataset.theme).toBe("light");
    expect(screen.getAllByText("فعال").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /کنتراست بالا/ }));
    expect(root().dataset.theme).toBe("contrast");

    fireEvent.click(screen.getByRole("button", { name: /شیشه‌ای/ }));
    expect(root().dataset.theme).toBe("glass");
  });

  it("remembers the choice for this device", () => {
    renderAppearance();
    fireEvent.click(screen.getByRole("button", { name: /روشنِ روزن/ }));
    expect(localStorage.getItem("ava:theme")).toBe("light");
  });

  it("previews each preset inside its own stage, not as a painted picture", () => {
    const { container } = render(
      <AppProvider>
        <SettingsView />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /ظاهر/ }));
    /*
      The miniature carries the preset attribute, so the CSS rebuilds the ramp
      inside it — and cancels the viewer's typed colours, so each card previews
      the preset itself rather than whatever is currently overridden.
    */
    const previews = container.querySelectorAll<HTMLElement>("[data-theme]");
    expect(previews.length).toBe(THEMES.length);
    for (const preview of previews) {
      expect(preview.style.getPropertyValue("--viewer-bg")).toBe("initial");
      expect(preview.style.getPropertyValue("--viewer-text")).toBe("initial");
      expect(THEMES).toContain(preview.dataset.theme as (typeof THEMES)[number]);
    }
  });
});

describe("colours typed by hand", () => {
  it("applies a hex colour as soon as it parses — alpha form included", async () => {
    renderAppearance();
    const field = screen.getByLabelText("رنگ زمینه");

    fireEvent.change(field, { target: { value: "#9f9f9f9f" } });
    await waitFor(() => expect(onRoot("--viewer-bg")).toBe("#9f9f9f9f"));
    /* A mid-grey is still below the middle of the luminance range: surfaces keep
       lifting toward white. */
    expect(onRoot("--viewer-mix")).toBe("#ffffff");
    expect(screen.getByText(/#9f9f9f9f/)).toBeTruthy();
  });

  it("flips the lift direction for a light background typed under a dark preset", async () => {
    renderAppearance();
    fireEvent.change(screen.getByLabelText("رنگ زمینه"), { target: { value: "#f4f1ea" } });
    await waitFor(() => expect(onRoot("--viewer-mix")).toBe("#000000"));
  });

  it("accepts shorthand and expands it, so one shape is stored", async () => {
    renderAppearance();
    fireEvent.change(screen.getByLabelText("رنگ متن"), { target: { value: "#abc" } });
    await waitFor(() => expect(onRoot("--viewer-text")).toBe("#aabbcc"));
  });

  it("refuses what is not a colour, says so, and leaves the stage alone", async () => {
    renderAppearance();
    const field = screen.getByLabelText("رنگ زمینه");

    fireEvent.change(field, { target: { value: "#123456" } });
    await waitFor(() => expect(onRoot("--viewer-bg")).toBe("#123456"));

    fireEvent.change(field, { target: { value: "قرمز" } });
    expect(await screen.findByText(/کد رنگ معتبر نیست/)).toBeTruthy();
    expect(onRoot("--viewer-bg"), "an unparsable value must not reach the document").toBe("#123456");
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });

  it("does not treat a half-typed value as an error — but does once the field is left", () => {
    renderAppearance();
    const field = screen.getByLabelText("رنگ زمینه");

    fireEvent.change(field, { target: { value: "#12" } });
    expect(screen.queryByText(/کد رنگ معتبر نیست/)).toBeNull();
    expect(screen.getByText(/در حال نوشتن…/)).toBeTruthy();
    expect(onRoot("--viewer-bg")).toBe("");

    // Leaving an unfinished value behind is the moment it becomes a mistake.
    fireEvent.blur(field);
    expect(screen.getByText(/کد رنگ معتبر نیست/)).toBeTruthy();

    // And something that could never be a colour is refused while typing.
    fireEvent.change(field, { target: { value: "قرمز" } });
    expect(screen.getByText(/کد رنگ معتبر نیست/)).toBeTruthy();
  });

  it("clears one colour, and then all of them", async () => {
    renderAppearance();
    fireEvent.change(screen.getByLabelText("رنگ زمینه"), { target: { value: "#101010" } });
    fireEvent.change(screen.getByLabelText("رنگ سطح"), { target: { value: "#202020" } });
    await waitFor(() => expect(onRoot("--viewer-surface")).toBe("#202020"));

    fireEvent.click(screen.getByLabelText("پاک کردن رنگ زمینه"));
    await waitFor(() => expect(onRoot("--viewer-bg")).toBe(""));
    expect(onRoot("--viewer-surface"), "clearing one colour leaves the others").toBe("#202020");

    fireEvent.click(screen.getByRole("button", { name: /پاک کردن همه/ }));
    await waitFor(() => expect(onRoot("--viewer-surface")).toBe(""));
    expect(onRoot("--viewer-text")).toBe("");
    expect(onRoot("--viewer-mix")).toBe("");
  });

  it("persists for this device and comes back on the next visit", async () => {
    renderAppearance();
    fireEvent.change(screen.getByLabelText("رنگ متن"), { target: { value: "#f5f0e8" } });
    await waitFor(() => expect(localStorage.getItem("ava:palette")).toContain("#f5f0e8"));

    cleanup();
    renderAppearance();
    expect(onRoot("--viewer-text")).toBe("#f5f0e8");
    expect((screen.getByLabelText("رنگ متن") as HTMLInputElement).value).toBe("#f5f0e8");
  });

  it("states its own scope: this device, not the academy", () => {
    renderAppearance();
    expect(
      screen.getByText(/این رنگ‌ها فقط روی دستگاه شما اعمال می‌شوند/),
      "a viewer override must not read as an organisation-wide change",
    ).toBeTruthy();
    /* The section that owns academy-wide identity is named, and it is elsewhere:
       "پروفایل آموزشگاه" appears both in the nav and in this note. */
    expect(screen.getAllByText(/پروفایل\s*آموزشگاه/).length).toBeGreaterThan(1);
  });
});

describe("the reset", () => {
  it("returns the preset, the accent and the typed colours together", async () => {
    renderAppearance();
    fireEvent.click(screen.getByRole("button", { name: /کنتراست بالا/ }));
    fireEvent.change(screen.getByLabelText("رنگ زمینه"), { target: { value: "#123456" } });
    await waitFor(() => expect(onRoot("--viewer-bg")).toBe("#123456"));

    fireEvent.click(screen.getByRole("button", { name: /بازنشانی به پیش‌فرض/ }));
    expect(root().dataset.theme).toBe("dark");
    expect(localStorage.getItem("ava:accent")).toBe("gold");
    await waitFor(() => expect(onRoot("--viewer-bg")).toBe(""));
    expect(onRoot("--viewer-mix")).toBe("");
    expect(localStorage.getItem("ava:palette")).toBeNull();
    // The fields themselves are emptied, not merely overridden behind the scenes.
    expect((screen.getByLabelText("رنگ زمینه") as HTMLInputElement).value).toBe("");
  });
});
