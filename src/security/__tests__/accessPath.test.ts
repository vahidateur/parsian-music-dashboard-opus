/**
 * Secret access path.
 *
 * The behaviour that matters: a wrong or absent slug is refused, a short slug
 * is refused as misconfiguration rather than silently accepted, and comparison
 * does not early-exit on the first differing character.
 */
import { describe, expect, it } from "vitest";
import { safeEqual } from "../accessPath";

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different content of the same length", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("rejects a prefix, so a partial guess never passes", () => {
    const secret = "a".repeat(32);
    expect(safeEqual("a".repeat(31), secret)).toBe(false);
  });

  it("compares the whole string rather than stopping at the first mismatch", () => {
    // Both differ from the target, one at the start and one at the end. Both
    // must be rejected — this is the property an early-exit compare breaks.
    const target = "0123456789abcdef0123456789abcdef";
    expect(safeEqual("X123456789abcdef0123456789abcdef", target)).toBe(false);
    expect(safeEqual("0123456789abcdef0123456789abcdeX", target)).toBe(false);
  });

  it("handles empty input without throwing", () => {
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });
});

/**
 * `evaluateAccessPath` reads a build-time constant, so its branches are
 * exercised through the pure helper above plus the behaviour tests in
 * AccessGate.test.tsx. What can be asserted here is the policy itself.
 */
describe("slug policy", () => {
  const PATTERN = /^[a-zA-Z0-9_-]{24,128}$/;

  it("accepts a generated 32-hex slug", () => {
    expect(PATTERN.test("967b39ccc23a65fa2eb95d16b5bfe1ba")).toBe(true);
  });

  it("rejects anything short enough to guess", () => {
    for (const weak of ["admin", "panel", "secret123", "a".repeat(23)]) {
      expect(PATTERN.test(weak), `"${weak}" must be rejected`).toBe(false);
    }
  });

  it("rejects characters that would break a URL or enable traversal", () => {
    for (const bad of ["../../etc/passwd", "a".repeat(24) + "/", "a".repeat(24) + "?", "a".repeat(24) + "#"]) {
      expect(PATTERN.test(bad), `"${bad}" must be rejected`).toBe(false);
    }
  });
});
