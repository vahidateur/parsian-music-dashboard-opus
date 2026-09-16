// @vitest-environment jsdom
/**
 * I9 — the design system must survive an empty series.
 *
 * WHY THIS FILE EXISTS
 *
 * `Sparkline` computed `Math.min(...data)` / `Math.max(...data)`. On `[]` those
 * are `Infinity` / `-Infinity`, which produce degenerate coordinates instead of a
 * throw — the failure mode that reaches production quietly, as a line drawn off
 * the canvas or a `NaN` in an SVG attribute after the span is divided.
 *
 * I9 was unreachable while every caller passed a static fixture. M9 made it
 * reachable (H4 derives the series from records), so the guard is proven here
 * with the two inputs a live dashboard now produces: `[]` (the read returned
 * nothing) and `null` (the measure has no history at all).
 *
 * The assertions are behavioural — what reaches the DOM — rather than a
 * source-text check on the guard.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Delta, Sparkline } from "@/components/ds/primitives";
import { NO_DATA } from "@/lib/format";

/** Text that can only arrive through a broken computation. */
const ARTEFACTS = ["NaN", "Infinity", "-Infinity", "undefined"] as const;

function expectNoArtefacts(container: HTMLElement): void {
  const text = container.textContent ?? "";
  for (const artefact of ARTEFACTS) {
    expect(text, `rendered "${artefact}"`).not.toContain(artefact);
  }
  for (const node of container.querySelectorAll("svg *")) {
    for (const attribute of node.getAttributeNames()) {
      const value = node.getAttribute(attribute) ?? "";
      expect(value, `${node.tagName}.${attribute} carried "${value}"`).not.toMatch(/NaN|Infinity/);
    }
  }
}

afterEach(cleanup);

describe("Sparkline over an empty series", () => {
  it("renders NO_DATA instead of a chart when the series is empty", () => {
    const { container } = render(<Sparkline data={[]} />);

    expect(screen.getByText(NO_DATA)).toBeTruthy();
    expectNoArtefacts(container);
    // No path/rect geometry at all: a chart of nothing is not drawn.
    expect(container.querySelectorAll("path, rect").length).toBe(0);
  });

  it("renders NO_DATA when the caller has no series to give", () => {
    const { container } = render(<Sparkline data={null} kind="bars" />);

    expect(screen.getByText(NO_DATA)).toBeTruthy();
    expectNoArtefacts(container);
    expect(container.querySelectorAll("path, rect").length).toBe(0);
  });

  it("still draws a real series, so the guard did not replace the chart", () => {
    const { container } = render(<Sparkline data={[3, 7, 5, 9]} />);

    expect(screen.queryByText(NO_DATA)).toBeNull();
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
    expectNoArtefacts(container);
  });

  it("draws bars for an empty bar series as NO_DATA too", () => {
    const { container } = render(<Sparkline data={[]} kind="bars" />);
    expect(screen.getByText(NO_DATA)).toBeTruthy();
    expect(container.querySelectorAll("rect").length).toBe(0);
  });
});

describe("Delta without a comparison", () => {
  it("renders NO_DATA for a null value rather than a zero change", () => {
    const { container } = render(<Delta value={null} label="نسبت به ماه پیش" />);

    expect(screen.getByText(NO_DATA)).toBeTruthy();
    // The label survives: the reader still learns which comparison is absent.
    expect(screen.getByText("نسبت به ماه پیش")).toBeTruthy();
    expectNoArtefacts(container);
  });

  it("renders NO_DATA for a non-finite value", () => {
    const { container } = render(<Delta value={Number.NaN} />);
    expect(screen.getByText(NO_DATA)).toBeTruthy();
    expectNoArtefacts(container);
  });

  it("still renders a signed change for a real value", () => {
    render(<Delta value={8.5} />);
    expect(screen.queryByText(NO_DATA)).toBeNull();
    expect(screen.getByText(/۸٫۵/)).toBeTruthy();
  });
});
