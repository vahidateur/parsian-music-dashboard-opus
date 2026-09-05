import { describe, expect, it } from "vitest";
import { formatHash, isViewId, parseHash } from "@/lib/hashRoute";

describe("hash routing", () => {
  it("parses a plain view", () => {
    expect(parseHash("#/students")).toEqual({ view: "students" });
  });

  it("parses a deep link with a record id", () => {
    expect(parseHash("#/students/st1")).toEqual({ view: "students", id: "st1" });
  });

  it("parses a filter query", () => {
    expect(parseHash("#/students?filter=at-risk")).toEqual({ view: "students", filter: "at-risk" });
  });

  it("returns null for an empty or unknown view", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#/")).toBeNull();
    expect(parseHash("#/not-a-view")).toBeNull();
  });

  it("rejects unsafe ids and filters instead of passing them through", () => {
    expect(parseHash("#/students/<script>")).toEqual({ view: "students" });
    expect(parseHash("#/students?filter=../../etc/passwd")).toEqual({ view: "students" });
    expect(parseHash("#/students/" + "x".repeat(80))).toEqual({ view: "students" });
  });

  it("survives malformed percent-encoding", () => {
    expect(() => parseHash("#/students/%E0%A4%A")).not.toThrow();
  });

  it("round-trips through formatHash", () => {
    for (const target of [
      { view: "students" as const },
      { view: "students" as const, id: "st1" },
      { view: "finance" as const, filter: "overdue" },
    ]) {
      expect(parseHash(formatHash(target))).toEqual(target);
    }
  });

  it("omits unsafe values when formatting", () => {
    expect(formatHash({ view: "students", id: "a/b" })).toBe("#/students");
  });

  it("validates view ids", () => {
    expect(isViewId("dashboard")).toBe(true);
    expect(isViewId("nope")).toBe(false);
  });
});
