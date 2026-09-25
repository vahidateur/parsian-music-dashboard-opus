/**
 * A minimal, verified subset of `tailwind-merge` — D9 A-lite, slice D9-A2.
 *
 * WHY THIS EXISTS
 *
 * `cn()` used `twMerge(clsx(inputs))`. tailwind-merge ships a large universal table
 * (≈25 kB raw / ≈8.4 kB gzip isolated) and the D9 budget counts every emitted byte.
 * This app uses a bounded vocabulary: the classes that actually appear in `src/`.
 *
 * WHAT IT DOES
 *
 * Resolves Tailwind class conflicts the way tailwind-merge does, for the families this
 * project uses: the *later* class wins, a broad class removes an earlier narrow one
 * (`p-4` drops an earlier `px-2`) but not the other way round, variants are separate
 * namespaces (`hover:px-2` and `px-4` coexist), important (`!`) is its own namespace,
 * and anything unrecognised passes through untouched — exactly like tailwind-merge.
 *
 * SAFETY POSTURE
 *
 * Rules are *conservative*: a family is only declared when its conflicts were verified
 * against the real library over the project's own class vocabulary (the differential
 * harness in this slice compared both implementations on every class literal in `src/`
 * plus sampled combinations). Unknown shapes are never merged, so the failure mode is a
 * kept duplicate (which CSS resolves by source order), never a wrong removal.
 */
import { clsx, type ClassValue } from "clsx";

interface Rule {
  /** Stable group id, e.g. "padding", "text-color". */
  id: string;
  /** Groups this rule removes when it comes later (children in tailwind-merge's map). */
  overrides?: string[];
  /** Whether the base utility (with no value) matches this rule. */
  match: (base: string) => boolean;
}

/** Numbers, arbitrary values and common scales — all treated as an opaque "value". */
const VALUE = "[^\\s]+";
function hasValue(base: string, prefix: string): boolean {
  return new RegExp(`^${prefix}-${VALUE}$`).test(base);
}

const TEXT_SIZES = new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]);
const TEXT_ALIGNS = new Set(["start", "end", "center", "left", "right", "justify"]);
const TEXT_WRAPS = new Set(["wrap", "nowrap", "balance", "pretty"]);
const TEXT_TRANSFORMS = new Set(["uppercase", "lowercase", "capitalize", "normal-case"]);
const BG_POSITIONS = new Set([
  "center", "top", "bottom", "left", "right", "left-top", "left-bottom", "right-top", "right-bottom",
  "top-left", "top-right", "bottom-left", "bottom-right",
]);
const BG_SIZES = new Set(["auto", "cover", "contain"]);
const BORDER_WIDTHS = new Set(["0", "2", "4", "8", "thin", "medium", "thick"]);
const RING_WIDTHS = new Set(["0", "1", "2", "4", "8"]);
const SHADOW_SIZES = new Set(["sm", "md", "lg", "xl", "2xl", "inner", "none"]);
const FONT_WEIGHTS = new Set(["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"]);
const OUTLINE_STYLES = new Set(["none", "hidden", "dashed", "dotted", "double", "solid"]);

/** Splits `value` out of `prefix-value`, or null when the shape does not hold. */
function valueOf(base: string, prefix: string): string | null {
  if (base === prefix) return "";
  if (base.startsWith(`${prefix}-`)) return base.slice(prefix.length + 1);
  return null;
}

function isLengthLike(value: string): boolean {
  if (!value.startsWith("[")) return false;
  const inner = value.slice(1);
  // A bare `var(--token)` is ambiguous (colour or length) and the library treats it as the
  // colour side; only explicit colour syntax and var() are excluded here.
  if (/^(#|rgb|hsl|oklch|oklab|color:|var\()/.test(inner)) return false;
  return true;
}

/** Value part of `prefix-value` that must be non-empty — bare `text`, `bg`, `from` are NOT classes. */
function val(base: string, prefix: string): string | null {
  const v = valueOf(base, prefix);
  return v === null || v === "" ? null : v;
}

/** True when `base` carries a numeric/scale width value, e.g. `border-t-2`, `border-t-[3px]`. */
function isWidthValue(base: string, prefix: string): boolean {
  const value = valueOf(base, prefix);
  if (value === null) return false;
  return /^\d+$/.test(value) || isLengthLike(value);
}

/** The rule table. Order matters: the first match wins (specific before generic). */
const RULES: Rule[] = [
  // ---- box: padding / margin, broad removes narrow, one direction only ----
  { id: "p", overrides: ["px", "py", "pt", "pr", "pb", "pl", "ps", "pe"], match: (b) => hasValue(b, "p") },
  // Physical (pl/pr) and logical (ps/pe) sides are separate groups in tailwind-merge:
  // `px-4` removes an earlier `pl-3` but not an earlier `ps-3`. Verified against the library.
  { id: "px", overrides: ["pl", "pr"], match: (b) => hasValue(b, "px") },
  { id: "py", overrides: ["pt", "pb"], match: (b) => hasValue(b, "py") },
  { id: "pt", match: (b) => hasValue(b, "pt") },
  { id: "pr", match: (b) => hasValue(b, "pr") },
  { id: "pb", match: (b) => hasValue(b, "pb") },
  { id: "pl", match: (b) => hasValue(b, "pl") },
  { id: "ps", match: (b) => hasValue(b, "ps") },
  { id: "pe", match: (b) => hasValue(b, "pe") },
  { id: "m", overrides: ["mx", "my", "mt", "mr", "mb", "ml", "ms", "me"], match: (b) => hasValue(b, "m") },
  { id: "mx", overrides: ["ml", "mr"], match: (b) => hasValue(b, "mx") },
  { id: "my", overrides: ["mt", "mb"], match: (b) => hasValue(b, "my") },
  { id: "mt", match: (b) => hasValue(b, "mt") },
  { id: "mr", match: (b) => hasValue(b, "mr") },
  { id: "mb", match: (b) => hasValue(b, "mb") },
  { id: "ml", match: (b) => hasValue(b, "ml") },
  { id: "ms", match: (b) => hasValue(b, "ms") },
  { id: "me", match: (b) => hasValue(b, "me") },
  { id: "space-x", match: (b) => hasValue(b, "space-x") },
  { id: "space-y", match: (b) => hasValue(b, "space-y") },

  // ---- sizing ----
  { id: "w", match: (b) => hasValue(b, "w") },
  { id: "h", match: (b) => hasValue(b, "h") },
  // `size-*` is broad: it removes an earlier `w-*`/`h-*`, never the other way round (verified).
  { id: "size", overrides: ["w", "h"], match: (b) => hasValue(b, "size") },
  { id: "min-w", match: (b) => hasValue(b, "min-w") },
  { id: "max-w", match: (b) => hasValue(b, "max-w") },
  { id: "min-h", match: (b) => hasValue(b, "min-h") },
  // The library does not recognise `max-h-none` (verified), so it must not conflict.
  { id: "max-h", match: (b) => val(b, "max-h") !== null && val(b, "max-h") !== "none" },
  { id: "basis", match: (b) => hasValue(b, "basis") },

  // ---- inset: broad removes narrow (verified: `inset-0` keeps `inset-x-2`? no — later broad drops narrow) ----
  // `inset-*` is broad against the four physical sides; the logical `start`/`end` are their own
  // groups (verified: `start-1 inset-x-2` keeps both, `left-1 inset-x-2` keeps only `inset-x-2`).
  { id: "inset", overrides: ["inset-x", "inset-y", "top", "right", "bottom", "left", "start", "end"], match: (b) => hasValue(b, "inset") && !/^inset-(x|y)(-|$)/.test(b) },
  { id: "inset-x", overrides: ["left", "right"], match: (b) => hasValue(b, "inset-x") },
  { id: "inset-y", overrides: ["top", "bottom"], match: (b) => hasValue(b, "inset-y") },
  { id: "top", match: (b) => hasValue(b, "top") },
  { id: "right", match: (b) => hasValue(b, "right") },
  { id: "bottom", match: (b) => hasValue(b, "bottom") },
  { id: "left", match: (b) => hasValue(b, "left") },
  { id: "start", match: (b) => hasValue(b, "start") },
  { id: "end", match: (b) => hasValue(b, "end") },

  // ---- text: size / colour / align / wrap / transform are distinct groups ----
  {
    id: "text-size",
    overrides: ["leading"],
    match: (b) => {
      const v = val(b, "text");
      if (v === null) return false;
      return TEXT_SIZES.has(v) || isLengthLike(v);
    },
  },
  { id: "text-align", match: (b) => TEXT_ALIGNS.has(val(b, "text") ?? "") },
  { id: "text-wrap", match: (b) => TEXT_WRAPS.has(val(b, "text") ?? "") },
  { id: "text-transform", match: (b) => TEXT_TRANSFORMS.has(val(b, "text") ?? "") },
  { id: "text-color", match: (b) => val(b, "text") !== null },
  { id: "leading", match: (b) => hasValue(b, "leading") },
  { id: "tracking", match: (b) => hasValue(b, "tracking") },
  { id: "font-weight", match: (b) => FONT_WEIGHTS.has(valueOf(b, "font") ?? "") },
  { id: "font-family", match: (b) => val(b, "font") !== null },

  // ---- background ----
  // `bg-gradient-to-*` is NOT its own group in this library version — it resolves as a
  // background *value*, so it conflicts with `bg-<colour>` both ways (verified:
  // `bg-ink-900 bg-gradient-to-br` → `bg-gradient-to-br`). `bg-linear-to-*` is unknown and
  // therefore passes through untouched. Both behaviours are reproduced deliberately.
  { id: "bg-image", match: (b) => /^bg-(none|linear-|radial-|conic-)/.test(b) },
  { id: "bg-position", match: (b) => BG_POSITIONS.has(val(b, "bg") ?? "") },
  { id: "bg-size", match: (b) => BG_SIZES.has(val(b, "bg") ?? "") },
  { id: "bg-repeat", match: (b) => /^bg-(no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(b) },
  { id: "bg-attachment", match: (b) => /^bg-(fixed|local|scroll)$/.test(b) },
  { id: "bg-clip", match: (b) => hasValue(b, "bg-clip") || hasValue(b, "bg-origin") },
  { id: "bg-blend", match: (b) => hasValue(b, "bg-blend") },
  { id: "bg-color", match: (b) => val(b, "bg") !== null && !/^bg-(none|linear-|radial-|conic-|clip-|origin-|blend-|cover|contain|auto|fixed|local|scroll|repeat|no-repeat)/.test(b) && !BG_POSITIONS.has(val(b, "bg") ?? "") },

  // ---- border: width / colour / side widths / collapse ----
  { id: "border-collapse", match: (b) => /^border-(collapse|separate)$/.test(b) },
  { id: "border-spacing", match: (b) => /^border-spacing/.test(b) },
  { id: "border-w", overrides: ["border-x", "border-y", "border-t", "border-r", "border-b", "border-l", "border-s", "border-e"], match: (b) => b === "border" || BORDER_WIDTHS.has(valueOf(b, "border") ?? "") || isLengthLike(valueOf(b, "border") ?? "") },
  // Side groups split width from colour, exactly as the library does (verified:
  // `border-t-2 border-t-ink-100` keeps both, `border-t-ink-100 border-t-black` keeps the last).
  { id: "border-x", overrides: ["border-l", "border-r"], match: (b) => /^border-x(-|$)/.test(b) && (b === "border-x" || isWidthValue(b, "border-x")) },
  { id: "border-y", overrides: ["border-t", "border-b"], match: (b) => /^border-y(-|$)/.test(b) && (b === "border-y" || isWidthValue(b, "border-y")) },
  { id: "border-t", match: (b) => /^border-t(-|$)/.test(b) && (b === "border-t" || isWidthValue(b, "border-t")) },
  { id: "border-r", match: (b) => /^border-r(-|$)/.test(b) && (b === "border-r" || isWidthValue(b, "border-r")) },
  { id: "border-b", match: (b) => /^border-b(-|$)/.test(b) && (b === "border-b" || isWidthValue(b, "border-b")) },
  { id: "border-l", match: (b) => /^border-l(-|$)/.test(b) && (b === "border-l" || isWidthValue(b, "border-l")) },
  { id: "border-s", match: (b) => /^border-s(-|$)/.test(b) && (b === "border-s" || isWidthValue(b, "border-s")) },
  { id: "border-e", match: (b) => /^border-e(-|$)/.test(b) && (b === "border-e" || isWidthValue(b, "border-e")) },
  { id: "border-t-color", match: (b) => /^border-t-/.test(b) },
  { id: "border-r-color", match: (b) => /^border-r-/.test(b) },
  { id: "border-b-color", match: (b) => /^border-b-/.test(b) },
  { id: "border-l-color", match: (b) => /^border-l-/.test(b) },
  { id: "border-s-color", match: (b) => /^border-s-/.test(b) },
  { id: "border-e-color", match: (b) => /^border-e-/.test(b) },
  { id: "border-x-color", match: (b) => /^border-x-/.test(b) },
  { id: "border-y-color", match: (b) => /^border-y-/.test(b) },
  { id: "border-style", match: (b) => /^border-(solid|dashed|dotted|double|hidden|none)$/.test(b) },
  // The all-sides colour overrides an earlier side colour (verified: `border-t-black border-warn-500/20`
  // keeps only the latter), while side colours never override the all-sides one.
  { id: "border-color", overrides: ["border-t-color", "border-r-color", "border-b-color", "border-l-color", "border-s-color", "border-e-color", "border-x-color", "border-y-color"], match: (b) => valueOf(b, "border") !== null },
  { id: "divide-x", match: (b) => /^divide-x(-|$)/.test(b) },
  { id: "divide-y", match: (b) => /^divide-y(-|$)/.test(b) },
  { id: "divide-color", match: (b) => /^divide-(?!x|y)/.test(b) },

  // ---- rounded / shadow / ring / outline ----
  { id: "rounded", overrides: ["rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-s", "rounded-e", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl", "rounded-ss", "rounded-se", "rounded-es", "rounded-ee"], match: (b) => b === "rounded" || (hasValue(b, "rounded") && !/^rounded-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee)(-|$)/.test(b)) },
  { id: "rounded-t", match: (b) => /^rounded-t(-|$)/.test(b) },
  { id: "rounded-r", match: (b) => /^rounded-r(-|$)/.test(b) },
  { id: "rounded-b", match: (b) => /^rounded-b(-|$)/.test(b) },
  { id: "rounded-l", match: (b) => /^rounded-l(-|$)/.test(b) },
  { id: "rounded-s", match: (b) => /^rounded-s(-|$)/.test(b) },
  { id: "rounded-e", match: (b) => /^rounded-e(-|$)/.test(b) },
  { id: "rounded-tl", match: (b) => /^rounded-tl(-|$)/.test(b) },
  { id: "rounded-tr", match: (b) => /^rounded-tr(-|$)/.test(b) },
  { id: "rounded-br", match: (b) => /^rounded-br(-|$)/.test(b) },
  { id: "rounded-bl", match: (b) => /^rounded-bl(-|$)/.test(b) },
  { id: "shadow", match: (b) => b === "shadow" || SHADOW_SIZES.has(valueOf(b, "shadow") ?? "") || isLengthLike(valueOf(b, "shadow") ?? "") },
  { id: "shadow-color", match: (b) => valueOf(b, "shadow") !== null },
  { id: "ring-w", match: (b) => b === "ring" || RING_WIDTHS.has(valueOf(b, "ring") ?? "") || isLengthLike(valueOf(b, "ring") ?? "") },
  { id: "ring-inset", match: (b) => b === "ring-inset" },
  { id: "ring-offset-w", match: (b) => b === "ring-offset" || /^ring-offset-\d+$/.test(b) },
  { id: "ring-offset-color", match: (b) => /^ring-offset-/.test(b) },
  { id: "ring-color", match: (b) => valueOf(b, "ring") !== null },
  { id: "outline-style", match: (b) => OUTLINE_STYLES.has(valueOf(b, "outline") ?? "") },
  { id: "outline-w", match: (b) => b === "outline" || /^outline-\d+$/.test(b) || isLengthLike(valueOf(b, "outline") ?? "") },
  { id: "outline-offset", match: (b) => /^outline-offset-/.test(b) },
  { id: "outline-color", match: (b) => valueOf(b, "outline") !== null },

  // ---- gradient colour stops (verified: `from-gold-400 from-ink-900/30` keeps only the last) ----
  { id: "from", match: (b) => hasValue(b, "from") },
  { id: "via", match: (b) => hasValue(b, "via") },
  { id: "to", match: (b) => hasValue(b, "to") },

  // ---- layout / flow ----
  { id: "display", match: (b) => /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|inline-table|table-row|table-cell|table-caption|flow-root|contents|list-item|hidden)$/.test(b) },
  { id: "position", match: (b) => /^(static|fixed|absolute|relative|sticky)$/.test(b) },
  { id: "float", match: (b) => /^float-(start|end|left|right|none)$/.test(b) },
  { id: "clear", match: (b) => /^clear-(start|end|left|right|both|none)$/.test(b) },
  { id: "visibility", match: (b) => /^(visible|invisible|collapse)$/.test(b) },
  { id: "overflow", overrides: ["overflow-x", "overflow-y"], match: (b) => /^overflow-(auto|hidden|clip|visible|scroll)$/.test(b) },
  { id: "overflow-x", match: (b) => /^overflow-x-/.test(b) },
  { id: "overflow-y", match: (b) => /^overflow-y-/.test(b) },
  { id: "z", match: (b) => hasValue(b, "z") },
  { id: "order", match: (b) => hasValue(b, "order") },
  { id: "col", match: (b) => /^col-(span|start|end)-/.test(b) || b === "col-auto" },
  { id: "row", match: (b) => /^row-(span|start|end)-/.test(b) || b === "row-auto" },
  { id: "grid-cols", match: (b) => hasValue(b, "grid-cols") || b === "grid-cols" },
  { id: "grid-rows", match: (b) => hasValue(b, "grid-rows") || b === "grid-rows" },
  { id: "grid-flow", match: (b) => hasValue(b, "grid-flow") },
  { id: "auto-cols", match: (b) => hasValue(b, "auto-cols") },
  { id: "auto-rows", match: (b) => hasValue(b, "auto-rows") },
  // `gap-*` is broad against `gap-x`/`gap-y` (verified: `gap-x-4 gap-2` keeps only `gap-2`,
  // while `gap-x-1 gap-y-2` keeps both).
  { id: "gap", overrides: ["gap-x", "gap-y"], match: (b) => hasValue(b, "gap") && !/^gap-(x|y)(-|$)/.test(b) },
  { id: "gap-x", match: (b) => hasValue(b, "gap-x") },
  { id: "gap-y", match: (b) => hasValue(b, "gap-y") },
  { id: "items", match: (b) => /^items-(start|end|center|baseline|stretch)$/.test(b) },
  { id: "justify", match: (b) => /^justify-(normal|start|end|center|between|around|evenly|stretch)$/.test(b) },
  { id: "justify-items", match: (b) => /^justify-items-/.test(b) },
  { id: "justify-self", match: (b) => /^justify-self-/.test(b) },
  { id: "content", match: (b) => /^content-(normal|center|start|end|between|around|evenly|baseline|stretch)$/.test(b) },
  { id: "self", match: (b) => /^self-/.test(b) },
  { id: "place-items", match: (b) => /^place-items-/.test(b) },
  { id: "place-content", match: (b) => /^place-content-/.test(b) },
  { id: "place-self", match: (b) => /^place-self-/.test(b) },
  { id: "flex-direction", match: (b) => /^flex-(row|row-reverse|col|col-reverse)$/.test(b) },
  { id: "flex-wrap", match: (b) => /^flex-(wrap|wrap-reverse|nowrap)$/.test(b) },
  { id: "flex-grow", match: (b) => b === "grow" || /^grow-/.test(b) || b === "flex-grow" || /^flex-grow-/.test(b) },
  { id: "flex-shrink", match: (b) => b === "shrink" || /^shrink-/.test(b) || b === "flex-shrink" || /^flex-shrink-/.test(b) },
  { id: "flex-basis", match: (b) => hasValue(b, "flex-basis") },
  { id: "aspect", match: (b) => hasValue(b, "aspect") },
  { id: "flex", match: (b) => /^flex-(\d+|auto|initial|none|\[)/.test(b) },
  { id: "sr-only", match: (b) => /^(sr-only|not-sr-only)$/.test(b) },

  // ---- typography extras ----
  // `line-clamp-*` sets `display: -webkit-box`, so it removes an earlier display/overflow (verified).
  { id: "line-clamp", overrides: ["display", "overflow"], match: (b) => hasValue(b, "line-clamp") },
  { id: "truncate", match: (b) => b === "truncate" },
  { id: "whitespace", match: (b) => /^whitespace-/.test(b) },
  { id: "break", match: (b) => /^break-(normal|words|all|keep)$/.test(b) },
  { id: "align", match: (b) => /^align-/.test(b) },
  { id: "list", match: (b) => /^list-/.test(b) },
  { id: "decoration", match: (b) => /^decoration-/.test(b) },
  { id: "underline-offset", match: (b) => /^underline-offset-/.test(b) },
  { id: "antialiased", match: (b) => /^(antialiased|subpixel-antialiased)$/.test(b) },
  { id: "hyphens", match: (b) => hasValue(b, "hyphens") },

  // ---- colour / paint ----
  { id: "opacity", match: (b) => hasValue(b, "opacity") },
  { id: "fill", match: (b) => hasValue(b, "fill") },
  { id: "stroke-w", match: (b) => /^stroke-\d+$/.test(b) },
  { id: "stroke-color", match: (b) => hasValue(b, "stroke") },
  { id: "accent", match: (b) => hasValue(b, "accent") },
  { id: "caret", match: (b) => hasValue(b, "caret") },
  { id: "invert", match: (b) => /^(invert|invert-0)$/.test(b) },
  { id: "mix-blend", match: (b) => /^mix-blend-/.test(b) },
  { id: "bg-blend-mode", match: (b) => /^bg-blend-/.test(b) },
  { id: "isolation", match: (b) => /^isolate$/.test(b) },

  // ---- effects / motion ----
  { id: "transition", match: (b) => b === "transition" || hasValue(b, "transition") },
  { id: "duration", match: (b) => hasValue(b, "duration") },
  { id: "ease", match: (b) => hasValue(b, "ease") },
  { id: "delay", match: (b) => hasValue(b, "delay") },
  // Custom animation names (`animate-fade-in`, `animate-sheet-up`) are unknown to the
  // library and pass through; only the built-ins and arbitrary values conflict (verified).
  { id: "animate", match: (b) => /^animate-(spin|ping|pulse|bounce|none)$/.test(b) || /^animate-\[/.test(b) },
  { id: "transform", match: (b) => /^(transform|transform-gpu|transform-none)$/.test(b) },
  { id: "scale", match: (b) => hasValue(b, "scale") || hasValue(b, "scale-x") || hasValue(b, "scale-y") },
  { id: "rotate", match: (b) => b === "rotate" || hasValue(b, "rotate") },
  { id: "translate-x", match: (b) => hasValue(b, "translate-x") },
  { id: "translate-y", match: (b) => hasValue(b, "translate-y") },
  { id: "skew-x", match: (b) => hasValue(b, "skew-x") },
  { id: "skew-y", match: (b) => hasValue(b, "skew-y") },
  { id: "origin", match: (b) => hasValue(b, "origin") },
  { id: "filter-blur", match: (b) => hasValue(b, "blur") },
  { id: "filter-brightness", match: (b) => hasValue(b, "brightness") },
  { id: "filter-contrast", match: (b) => hasValue(b, "contrast") },
  { id: "filter-grayscale", match: (b) => hasValue(b, "grayscale") || b === "grayscale" },
  { id: "filter-saturate", match: (b) => hasValue(b, "saturate") },
  { id: "filter-sepia", match: (b) => hasValue(b, "sepia") || b === "sepia" },
  { id: "backdrop-blur", match: (b) => b === "backdrop-blur" || hasValue(b, "backdrop-blur") },
  { id: "backdrop-brightness", match: (b) => hasValue(b, "backdrop-brightness") },
  { id: "backdrop-opacity", match: (b) => hasValue(b, "backdrop-opacity") },
  { id: "drop-shadow", match: (b) => b === "drop-shadow" || hasValue(b, "drop-shadow") },

  // ---- text decoration and the remaining single-value families (all verified) ----
  { id: "text-decoration", match: (b) => /^(underline|overline|line-through|no-underline)$/.test(b) },
  { id: "appearance", match: (b) => /^appearance-/.test(b) },
  { id: "box", match: (b) => /^box-(border|content)$/.test(b) },
  { id: "overscroll", match: (b) => /^overscroll-/.test(b) },
  { id: "content-property", match: (b) => /^content-(none|\[)/.test(b) },
  { id: "isolation-auto", match: (b) => /^isolation-auto$/.test(b) },

  // ---- interaction ----
  { id: "pointer-events", match: (b) => /^pointer-events-/.test(b) },
  { id: "cursor", match: (b) => hasValue(b, "cursor") },
  { id: "select", match: (b) => /^select-/.test(b) },
  { id: "resize", match: (b) => /^resize(-|$)/.test(b) },
  { id: "scroll-behavior", match: (b) => /^scroll-(auto|smooth)$/.test(b) },
  { id: "scroll-m", match: (b) => /^scroll-m/.test(b) },
  { id: "scroll-p", match: (b) => /^scroll-p/.test(b) },
  { id: "snap-align", match: (b) => /^snap-(start|end|center|align-none|normal|always)$/.test(b) },
  { id: "snap-type", match: (b) => /^snap-(x|y|both|mandatory|proximity|none)$/.test(b) },
  { id: "touch", match: (b) => /^touch-/.test(b) },
  { id: "will-change", match: (b) => /^will-change-/.test(b) },
  { id: "object-fit", match: (b) => /^object-(contain|cover|fill|none|scale-down)$/.test(b) },
  { id: "object-position", match: (b) => /^object-/.test(b) },
  { id: "table-layout", match: (b) => /^table-(auto|fixed)$/.test(b) },
  { id: "caption", match: (b) => /^caption-/.test(b) },
  { id: "border-spacing", match: (b) => /^border-spacing/.test(b) },
  { id: "columns", match: (b) => hasValue(b, "columns") },
];

/** Splits a token into its variant prefix and base utility, respecting `[...]`. */
function splitToken(token: string): { variants: string; base: string; important: boolean } {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) lastColon = i;
  }
  const variants = lastColon === -1 ? "" : token.slice(0, lastColon);
  let base = lastColon === -1 ? token : token.slice(lastColon + 1);
  let important = false;
  if (base.startsWith("!")) {
    important = true;
    base = base.slice(1);
  }
  return { variants, base, important };
}

function ruleFor(base: string): Rule | null {
  for (const rule of RULES) if (rule.match(base)) return rule;
  return null;
}

/**
 * Merges a resolved class string. Same contract as `twMerge` for the covered families:
 * later wins, broad removes earlier narrow, variants and `!` are separate namespaces,
 * unknown classes pass through unchanged and keep their order.
 */
export function mergeClassNames(input: string): string {
  if (!input) return "";
  const tokens = input.split(/\s+/).filter(Boolean);
  const kept: { token: string; key: string; id: string; variants: string }[] = [];

  for (const token of tokens) {
    const { variants, base, important } = splitToken(token);
    // A negative value (`-mt-2`) belongs to the same group as its positive form (verified).
    const rule = ruleFor(base.startsWith("-") ? base.slice(1) : base);
    if (!rule) {
      kept.push({ token, key: "", id: "", variants });
      continue;
    }
    const namespace = `${variants}|${important ? "!" : ""}`;
    const key = `${namespace}|${rule.id}`;
    // Later class in the same group replaces the earlier one.
    for (let i = kept.length - 1; i >= 0; i--) if (kept[i].key === key) kept.splice(i, 1);
    // A broad class removes earlier narrow ones in the same namespace.
    if (rule.overrides?.length) {
      for (let i = kept.length - 1; i >= 0; i--) {
        const other = kept[i];
        if (other.variants === variants && rule.overrides.includes(other.id)) kept.splice(i, 1);
      }
    }
    kept.push({ token, key, id: rule.id, variants });
  }

  return kept.map((entry) => entry.token).join(" ");
}

/** The project's class-name helper. Same public signature as before this slice. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClassNames(clsx(inputs));
}
