// @vitest-environment jsdom
/**
 * The access gate's rendering contract.
 *
 * The decoy page is the security-relevant part: it must be indistinguishable
 * from an empty server. Anything that says "unauthorized", or shows a logo, or
 * mentions the product, tells a scanner that something worth attacking lives
 * at this hostname.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The gate reads a build-time constant, so the module is mocked per scenario.
const evaluateAccessPath = vi.fn();
vi.mock("../accessPath", () => ({
  evaluateAccessPath: () => evaluateAccessPath(),
  accessBasePath: () => "",
  safeEqual: (a: string, b: string) => a === b,
  generateAccessSlug: () => "x".repeat(32),
}));

import { AccessGate } from "../AccessGate";

afterEach(cleanup);

function renderGate() {
  return render(
    <AccessGate>
      <div data-testid="app">پنل مدیریت آموزشگاه آوا</div>
    </AccessGate>,
  );
}

describe("when the path is correct", () => {
  it("renders the app", () => {
    evaluateAccessPath.mockReturnValue({ enabled: true, granted: true, misconfigured: null });
    renderGate();
    expect(screen.getByTestId("app")).toBeDefined();
  });
});

describe("when the gate is disabled", () => {
  it("renders the app, because no slug is configured", () => {
    evaluateAccessPath.mockReturnValue({ enabled: false, granted: true, misconfigured: null });
    renderGate();
    expect(screen.getByTestId("app")).toBeDefined();
  });
});

describe("when the path is wrong", () => {
  it("renders nothing from the app", () => {
    evaluateAccessPath.mockReturnValue({ enabled: true, granted: false, misconfigured: null });
    renderGate();
    expect(screen.queryByTestId("app")).toBeNull();
  });

  it("shows a plain 404 that reveals nothing", () => {
    evaluateAccessPath.mockReturnValue({ enabled: true, granted: false, misconfigured: null });
    const { container } = renderGate();

    expect(container.textContent).toContain("404");

    // No branding, no product name, no Persian, no hint that a login exists.
    for (const leak of ["آوا", "موسیقی", "آموزشگاه", "ورود", "login", "Ava", "unauthorized", "forbidden", "denied"]) {
      expect(container.textContent?.toLowerCase(), `decoy must not mention "${leak}"`).not.toContain(
        leak.toLowerCase(),
      );
    }
  });

  it("loads no images or fonts that could fingerprint the deployment", () => {
    evaluateAccessPath.mockReturnValue({ enabled: true, granted: false, misconfigured: null });
    const { container } = renderGate();

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.querySelectorAll("link")).toHaveLength(0);
  });

  it("mounts no form and no input", () => {
    evaluateAccessPath.mockReturnValue({ enabled: true, granted: false, misconfigured: null });
    const { container } = renderGate();
    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

describe("when the slug is misconfigured", () => {
  it("refuses to render the app rather than running unprotected", () => {
    evaluateAccessPath.mockReturnValue({
      enabled: true,
      granted: false,
      misconfigured: "VITE_ACCESS_PATH must be 24–128 characters",
    });
    renderGate();
    // A weak slug silently accepted would be the worst outcome: it looks
    // protected and is not.
    expect(screen.queryByTestId("app")).toBeNull();
  });
});
