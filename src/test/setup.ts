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
