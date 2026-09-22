// @vitest-environment jsdom
/**
 * The viewer palette — colours typed by hand.
 *
 * The behaviour worth pinning is the boring-looking part: what is accepted, what
 * is dropped, and what happens to a property that is *cleared*. A stale inline
 * custom property keeps overruling every theme preset chosen afterwards, which
 * is the same defect the appearance layer exists to remove, wearing a different
 * mask.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PALETTE_SLOTS,
  applyPalette,
  isHexColorInput,
  liftDirection,
  loadPalette,
  normalizeHex,
  relativeLuminance,
  savePalette,
  toPickerHex,
} from "@/lib/theme";

const root = () => document.documentElement;
const onRoot = (property: string) => root().style.getPropertyValue(property);

beforeEach(() => {
  localStorage.clear();
  for (const slot of PALETTE_SLOTS) root().style.removeProperty(slot.property);
  root().style.removeProperty("--viewer-mix");
});
afterEach(() => {
  for (const slot of PALETTE_SLOTS) root().style.removeProperty(slot.property);
  root().style.removeProperty("--viewer-mix");
});

describe("what counts as a colour", () => {
  it("accepts every hex shape a person actually types, alpha included", () => {
    for (const value of ["#fff", "#ffff", "#f5f0e8", "#9f9f9f9f", "#D5AF58", "  #aabbccdd  "]) {
      expect(isHexColorInput(value), `${value} must be accepted`).toBe(true);
    }
  });

  it("rejects everything that is not a hex colour", () => {
    for (const value of ["", "fff", "#gggggg", "#12345", "rgba(0,0,0,0.5)", "gold", "var(--x)", "#fff; }"]) {
      expect(isHexColorInput(value), `${value} must be rejected`).toBe(false);
    }
  });

  it("expands shorthand and lowercases, so every consumer sees one shape", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("#abcd")).toBe("#aabbccdd");
    expect(normalizeHex(" #D5AF58 ")).toBe("#d5af58");
    expect(normalizeHex("#9f9f9f9f")).toBe("#9f9f9f9f");
  });

  it("hands `<input type=color>` a shape it can hold — no alpha, no shorthand", () => {
    expect(toPickerHex("#9f9f9f9f")).toBe("#9f9f9f");
    expect(toPickerHex("#abc")).toBe("#aabbcc");
    expect(toPickerHex(undefined)).toBe("#888888");
    expect(toPickerHex("not a colour")).toBe("#888888");
  });
});

describe("which way surfaces lift", () => {
  it("reads luminance the way the contrast rule does", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 3);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 3);
    expect(relativeLuminance("#0a0908")).toBeLessThan(0.02);
    expect(relativeLuminance("#f4f1ea")).toBeGreaterThan(0.85);
  });

  it("mixes toward black on a light stage and toward white on a dark one", () => {
    expect(liftDirection("#0a0908")).toBe("#ffffff");
    expect(liftDirection("#f4f1ea")).toBe("#000000");
    /* The colour from the brief sits below the middle: it still needs a white
       lift, or a typed mid-grey would produce panels darker than the page. */
    expect(liftDirection("#9f9f9f9f")).toBe("#ffffff");
  });
});

describe("persistence", () => {
  it("round-trips what was typed", () => {
    savePalette({ background: "#101010", text: "#f5f0e8" });
    expect(loadPalette()).toEqual({ background: "#101010", text: "#f5f0e8" });
  });

  it("drops anything that is not a hex colour on the way back in", () => {
    localStorage.setItem(
      "ava:palette",
      JSON.stringify({ background: "url(evil)", text: "#ffffff", surface: 42, extra: "#000000" }),
    );
    expect(loadPalette()).toEqual({ text: "#ffffff" });
  });

  it("survives a corrupt or absent store without throwing", () => {
    localStorage.setItem("ava:palette", "{not json");
    expect(loadPalette()).toEqual({});
    localStorage.removeItem("ava:palette");
    expect(loadPalette()).toEqual({});
  });

  it("removes the key entirely once nothing is typed", () => {
    savePalette({ background: "#101010" });
    expect(localStorage.getItem("ava:palette")).toBeTruthy();
    savePalette({});
    expect(localStorage.getItem("ava:palette")).toBeNull();
  });
});

describe("application to the document", () => {
  it("writes each typed colour to its own custom property", () => {
    applyPalette({ background: "#123456", surface: "#234567", text: "#f5f0e8" });
    expect(onRoot("--viewer-bg")).toBe("#123456");
    expect(onRoot("--viewer-surface")).toBe("#234567");
    expect(onRoot("--viewer-text")).toBe("#f5f0e8");
  });

  it("clears what is not typed, so a preset can take over again", () => {
    applyPalette({ background: "#123456" });
    expect(onRoot("--viewer-bg")).toBe("#123456");

    applyPalette({});
    expect(onRoot("--viewer-bg")).toBe("");
    expect(onRoot("--viewer-surface")).toBe("");
    expect(onRoot("--viewer-text")).toBe("");
    expect(onRoot("--viewer-mix")).toBe("");
  });

  it("chooses the lift direction from the typed background", () => {
    applyPalette({ background: "#f4f1ea" });
    expect(onRoot("--viewer-mix"), "a light typed background must lift toward black").toBe("#000000");

    applyPalette({ background: "#0a0908" });
    expect(onRoot("--viewer-mix")).toBe("#ffffff");
  });

  it("leaves the lift direction to the preset when no background was typed", () => {
    /*
      A preset states its own direction in CSS. Re-stating it from JavaScript
      would put a viewer-level property in charge of a preset-level decision, and
      a later theme switch would then appear to do nothing — the exact complaint
      this layer answers.
    */
    applyPalette({ text: "#ff0000" });
    expect(onRoot("--viewer-text")).toBe("#ff0000");
    expect(onRoot("--viewer-bg")).toBe("");
    expect(onRoot("--viewer-mix")).toBe("");
  });

  it("never writes a value it cannot parse", () => {
    applyPalette({ background: "red" });
    expect(onRoot("--viewer-bg")).toBe("");
    expect(onRoot("--viewer-mix")).toBe("");
  });
});
