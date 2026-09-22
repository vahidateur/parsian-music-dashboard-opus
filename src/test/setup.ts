/**
 * Every test starts at a clean address bar.
 *
 * The shell reads its route from the URL (`lib/route.ts`) and migrates a legacy
 * `#/view` fragment into a `/view` path on first paint, so a route one test
 * walked to would otherwise still be in `window.location.pathname` when the next
 * test renders — a deep link nobody asked for. Resetting here is cheaper than
 * resetting in nineteen suites, and it cannot mask a failure: a test that wants
 * a route sets it.
 */
import { beforeEach } from "vitest";

beforeEach(() => {
  if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
});

/**
 * jsdom environment shims for APIs the app legitimately uses but jsdom lacks.
 * These mirror real browser behaviour; they do not stub application code.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof window !== "undefined" && typeof window.scrollTo !== "function") {
  window.scrollTo = () => {};
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  // Keyboard navigation scrolls the active option into view; jsdom has no
  // layout engine, so it lacks the API entirely.
  Element.prototype.scrollIntoView = () => {};
}
