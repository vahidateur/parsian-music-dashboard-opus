/**
 * THE APPEARANCE LAYER — a gate on `src/index.css`.
 *
 * Themes used to be decorative: two cards in Settings, one of which changed a
 * `data-theme` attribute that a single rule responded to, so clicking either one
 * left the panel looking exactly the same. This test exists so that cannot
 * quietly return.
 *
 * What it pins is the mechanism, not the aesthetics:
 *   • every neutral and text token is DERIVED from the stage colours, so one
 *     change moves the whole surface language;
 *   • each preset is a real set of stage colours, including the direction
 *     surfaces lift in on a light stage;
 *   • the surfaces themselves consume those tokens instead of hard-coding a dark
 *     fill and a white hairline;
 *   • the derivation is scoped so a Settings preview card renders the real thing.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** Every `.ts`/`.tsx` source under `src/`, tests included. */
function sources(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "__tests__" || entry === "test") return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?)$/.test(entry) ? [path] : [];
  });
}

const css = () => readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

/** The unlayered appearance block, from its banner to the first preset. */
function appearanceLayer(): string {
  const start = css().indexOf("THE APPEARANCE LAYER");
  const end = css().indexOf("[data-theme=\"glass\"]");
  expect(start, "the appearance layer must exist").toBeGreaterThan(-1);
  expect(end, "the preset blocks must follow it").toBeGreaterThan(start);
  return css().slice(start, end);
}

function presetBlock(theme: string): string {
  const pattern = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = pattern.exec(css());
  expect(match, `the "${theme}" preset must exist as a block`).toBeTruthy();
  return match![1];
}

describe("the neutral ramp is derived, not hard-coded", () => {
  const layer = appearanceLayer();

  it("builds every dark step from the stage background", () => {
    for (const token of ["950", "900", "850", "800", "750", "700", "600", "500"]) {
      expect(layer, `--color-ink-${token} must derive from the stage`).toMatch(
        new RegExp(`--color-ink-${token}:\\s*[^;]*var\\(--stage-(bg|mix)`),
      );
    }
  });

  it("builds every text step from the stage foreground", () => {
    for (const token of ["50", "100", "200", "300", "400"]) {
      expect(layer, `--color-ink-${token} must derive from the foreground`).toMatch(
        new RegExp(`--color-ink-${token}:\\s*[^;]*var\\(--stage-(fg|bg)`),
      );
    }
  });

  it("resolves the stage through the viewer, the preset and the brand record, in that order", () => {
    // Typed colour > chosen preset > academy identity > written fallback.
    expect(layer).toMatch(/--stage-bg:\s*var\(--viewer-bg,\s*var\(--theme-bg\)\)/);
    expect(layer).toMatch(/--stage-fg:\s*var\(--viewer-text,\s*var\(--theme-fg,\s*var\(--brand-text,/);
  });

  it("scopes the derivation to any [data-theme] element, so previews are the real thing", () => {
    expect(layer).toMatch(/:root,\s*\n?\s*\[data-theme\]\s*\{/);
  });

  it("lets a preset flip the direction surfaces lift in", () => {
    /*
      `dark` has no preset block of its own — it is the default written in the
      layer, which is why an unpainted `data-theme` still renders the product.
      Only a light stage flips the lift direction; glass keeps the dark one.
    */
    expect(appearanceLayer()).toMatch(/--theme-bg:\s*#0a0908/);
    expect(appearanceLayer()).toMatch(/--theme-mix:\s*#ffffff/);
    expect(presetBlock("light")).toMatch(/--theme-mix:\s*#000000/);
    expect(presetBlock("glass")).not.toMatch(/--theme-mix/);
    expect(presetBlock("contrast")).toMatch(/--theme-mix:\s*#ffffff/);
  });
});

describe("each preset is a real set of stage colours", () => {
  it("glass, light and contrast all state their own background", () => {
    for (const theme of ["glass", "light", "contrast"]) {
      expect(presetBlock(theme), `${theme} must set a stage background`).toMatch(/--theme-bg:/);
    }
  });

  it("the light preset states a dark foreground and a light colour scheme", () => {
    const block = presetBlock("light");
    expect(block).toMatch(/--theme-fg:\s*#191512/);
    expect(block).toMatch(/color-scheme:\s*light/);
  });

  it("the light preset flips `white` itself, so every hairline overlay follows", () => {
    /*
      Nearly every border and tint in the product is written as `white/[0.06]` or
      `bg-white/[0.02]`. On a light stage those have to be dark overlays or the
      whole UI loses its edges — and nothing in the product uses solid white, so
      redefining the token is the one-line version of editing 200 class names.
    */
    expect(presetBlock("light")).toMatch(/--color-white:\s*var\(--stage-fg\)/);

    /*
      The premise that makes the line above safe, checked against the whole
      product rather than trusted: no source may use *solid* white. An alpha
      overlay (`border-white/[0.06]`, `bg-white/[0.02]`) is a tint of the page's
      light and must flip with the theme; a solid `bg-white` would become a black
      rectangle. If somebody adds one, this fails and they choose deliberately.
    */
    const solid = /(?:text|bg|border|from|via|to|ring|fill|stroke|decoration|divide|outline|shadow|accent|caret)-white(?![-\/\w])/;
    const offenders = sources().filter((file) => solid.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.slice(SRC.length + 1))).toEqual([]);
  });

  it("the contrast preset drops the sheen and the shadow, and thickens the edges", () => {
    const block = presetBlock("contrast");
    expect(block).toMatch(/--surface-sheen:\s*none/);
    expect(block).toMatch(/--surface-shadow:\s*none/);
    expect(block).toMatch(/--surface-border:[^;]*30%/);
  });
});

describe("surfaces consume the layer instead of painting themselves", () => {
  it(".surface takes its fill, edge, sheen and shadow from tokens", () => {
    /* The rule itself, not the per-theme refinements that follow it. */
    const rule = /\n {2}\.surface \{([\s\S]*?)\n {2}\}/.exec(css());
    expect(rule, ".surface must exist in the components layer").toBeTruthy();
    const body = rule![1];
    expect(body).toMatch(/background-color:\s*var\(--surface-bg\)/);
    expect(body).toMatch(/border-color:\s*var\(--surface-border\)/);
    expect(body).toMatch(/background-image:\s*var\(--surface-sheen\)/);
    expect(body).toMatch(/box-shadow:\s*var\(--surface-shadow\)/);
  });

  it(".surface no longer hard-codes a dark fill or a white hairline", () => {
    const rule = /\n {2}\.surface \{([\s\S]*?)\n {2}\}/.exec(css())![1];
    expect(rule).not.toContain("bg-ink-850/90");
    expect(rule).not.toMatch(/rgba\(255, 255, 255/);
  });

  it("the page itself follows the stage", () => {
    const body = /body\s*\{([\s\S]*?)\n\s*\}/.exec(css())![1];
    expect(body).toMatch(/background:\s*var\(--stage-bg\)/);
    expect(body).toMatch(/color:\s*var\(--stage-fg\)/);
  });

  it("the controls are painted with the same tokens, so a theme reaches them", () => {
    /*
      Inputs, selects and textareas are styled by one exported class string. Its
      fill comes from the derived ramp and its hairline from a white overlay that
      the light preset flips — and it carries no colour of its own, which is what
      would otherwise stay behind when the stage changes.
    */
    const patterns = readFileSync(join(SRC, "components", "ds", "patterns.tsx"), "utf8");
    const input = /export const inputCls =\s*"([^"]+)"/.exec(patterns);
    expect(input, "inputCls must exist").toBeTruthy();
    expect(input![1]).toMatch(/bg-ink-\d{3}/);
    expect(input![1]).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(input![1]).not.toMatch(/rgba?\(/);
  });

  it("scrollbars and selection follow the foreground, not a fixed grey", () => {
    expect(css()).toMatch(/scrollbar-color:[^;]*var\(--stage-fg\)/);
    expect(css()).toMatch(/::selection\s*\{[\s\S]*?color:\s*var\(--stage-fg\)/);
  });
});
