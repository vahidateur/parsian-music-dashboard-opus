/**
 * D9 A-lite, slice D9-A2 — semantics of the project's own `cn()`.
 *
 * Every expectation in this file was read off `tailwind-merge` 3.4.0 itself (the
 * implementation `cn()` used before this slice) via a differential harness that
 * compared the two implementations over 128,848 inputs — every class literal in
 * `src/` plus sampled combinations — and reported zero mismatches. These cases
 * pin the behaviours that matter to this codebase, including the surprising ones
 * (`bg-gradient-to-*` is a background *value*, `line-clamp-*` removes a display,
 * `leading-*` is removed by a later text size, `max-h-none` is not a width).
 */
import { describe, expect, it } from "vitest";
import { cn, mergeClassNames } from "../mergeClassNames";

const MERGES: Array<[input: string, expected: string, why: string]> = [
  // A broad utility removes an earlier narrow one, never the reverse.
  ["px-2 p-4", "p-4", "a later padding removes an earlier axis padding"],
  ["p-4 px-2", "p-4 px-2", "an axis padding does not remove the padding it came from"],
  ["py-1 px-2", "py-1 px-2", "the two axes are independent"],
  ["pt-2 pb-2", "pt-2 pb-2", "the two sides are independent"],
  // Physical and logical sides are separate groups in this library version.
  ["ps-2 pe-2", "ps-2 pe-2", "logical sides are independent too"],
  ["p-2 ps-4", "p-2 ps-4", "a later logical side survives an earlier padding"],

  // Border: width and colour are separate families, per side as well as overall.
  ["border-2 border-ink-100", "border-2 border-ink-100", "width and colour coexist"],
  ["border-t-2 border-t-ink-100", "border-t-2 border-t-ink-100", "the same split holds per side"],
  ["border-t-ink-100 border-t-black", "border-t-black", "a later side colour wins"],
  ["border-t-black border-warn-500/20", "border-warn-500/20", "an all-sides colour removes earlier side colours"],
  ["border-collapse border-2", "border-collapse border-2", "`border-collapse` is not a border width"],

  // Backgrounds: `bg-gradient-to-*` resolves as a background value, so it conflicts both ways.
  ["bg-ink-900 bg-gradient-to-br", "bg-gradient-to-br", "a later gradient replaces an earlier colour"],
  ["bg-gradient-to-br bg-ink-900", "bg-ink-900", "a later colour replaces an earlier gradient"],
  ["bg-none bg-cover", "bg-none bg-cover", "`bg-none` and `bg-cover` are different families"],

  // Size vs width/height.
  ["size-8 w-4 h-4", "size-8 w-4 h-4", "a later width/height does not split a size"],
  ["w-4 h-4 size-8", "size-8", "a size removes an earlier width and height"],

  // Gap.
  ["gap-4 gap-x-2", "gap-4 gap-x-2", "an axis gap does not remove the gap it came from"],
  ["gap-x-2 gap-4", "gap-4", "a gap removes an earlier axis gap"],

  // Inset, including the logical sides.
  ["inset-0 top-1", "inset-0 top-1", "a side does not remove the inset it came from"],
  ["start-2 inset-0", "inset-0", "an inset removes an earlier logical side"],

  // Radius.
  ["rounded-xl rounded-t-3xl", "rounded-xl rounded-t-3xl", "a corner does not remove the radius it came from"],
  ["rounded-t-3xl rounded-2xl", "rounded-2xl", "a radius removes an earlier corner"],

  // Display and line clamping.
  ["line-clamp-2 flex", "line-clamp-2 flex", "display after a clamp survives"],
  ["flex line-clamp-2", "line-clamp-2", "a clamp sets its own display, removing an earlier one"],

  // Type scale.
  ["text-sm leading-5", "text-sm leading-5", "an explicit leading is kept after the size"],
  ["leading-5 text-sm", "text-sm", "a size removes an earlier leading"],
  ["text-sm tracking-wide", "text-sm tracking-wide", "tracking is independent of the size"],
  ["tracking-wide text-sm", "tracking-wide text-sm", "and survives the size too"],

  // Shapes the library deliberately does not recognise.
  ["max-h-none max-h-96", "max-h-none max-h-96", "`max-h-none` is not a recognised width"],
  ["animate-fade-in animate-spin", "animate-fade-in animate-spin", "a project animation name is unknown"],
  ["animate-spin animate-fade-in", "animate-spin animate-fade-in", "so it never conflicts"],

  // Variants and `!` are separate namespaces.
  ["hover:px-2 px-4", "hover:px-2 px-4", "a variant and the base class coexist"],
  ["px-4 hover:px-2", "px-4 hover:px-2", "in both orders"],
  ["!p-2 p-4", "!p-2 p-4", "an important class is its own namespace"],
  ["p-2 !p-4", "p-2 !p-4", "in both orders too"],
  ["hover:p-2 hover:p-4", "hover:p-4", "within one variant, later still wins"],

  // Negative values belong to their family.
  ["mt-2 -mt-4", "-mt-4", "a negative margin is a margin"],
  ["-mt-2 mt-4", "mt-4", "in both directions"],

  // Unknown classes pass through, in order.
  ["some-unknown p-2", "some-unknown p-2", "an unknown class is never dropped"],
  ["p-2 some-unknown", "p-2 some-unknown", "and keeps its position"],
  ["w-[var(--x)] w-4", "w-4", "an arbitrary width still merges"],
];

describe("mergeClassNames (D9-A2)", () => {
  it.each(MERGES)("merges %j to %j — %s", (input, expected) => {
    expect(mergeClassNames(input)).toBe(expected);
  });

  it("keeps duplicates of the same class only once", () => {
    expect(mergeClassNames("p-2 p-2")).toBe("p-2");
    expect(mergeClassNames("appearance-none appearance-none")).toBe("appearance-none");
  });

  it("preserves the order of everything it keeps", () => {
    expect(mergeClassNames("flex items-center gap-2 p-4 rounded-xl")).toBe("flex items-center gap-2 p-4 rounded-xl");
  });

  it("returns an empty string for empty input", () => {
    expect(mergeClassNames("")).toBe("");
    expect(mergeClassNames("   ")).toBe("");
  });
});

describe("cn (D9-A2)", () => {
  it("resolves clsx conditions before merging", () => {
    const hidden = false as boolean;
    expect(cn("p-2", hidden && "p-4", undefined, null, "px-3")).toBe("p-2 px-3");
  });

  it("merges across arguments, later winning", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn(["p-2", { "p-4": true }])).toBe("p-4");
  });

  it("keeps the common case untouched", () => {
    expect(cn("flex items-center", "gap-2")).toBe("flex items-center gap-2");
  });
});
