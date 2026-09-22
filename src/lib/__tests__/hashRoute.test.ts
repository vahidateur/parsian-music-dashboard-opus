import { describe, expect, it } from "vitest";
import { isViewId, parseHash } from "@/lib/hashRoute";
import { formatPath, hasLegacyHash, parsePath, readTarget } from "@/lib/route";

describe("legacy fragment routing (read-only)", () => {
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

  it("validates view ids", () => {
    expect(isViewId("dashboard")).toBe(true);
    expect(isViewId("nope")).toBe(false);
  });
});

describe("path routing — the address bar the app writes", () => {
  it("parses a plain view, a record id and a filter", () => {
    expect(parsePath("/students")).toEqual({ view: "students" });
    expect(parsePath("/students/st1")).toEqual({ view: "students", id: "st1" });
    expect(parsePath("/students", "?filter=at-risk")).toEqual({ view: "students", filter: "at-risk" });
  });

  it("answers null for the root and for an unknown view", () => {
    expect(parsePath("/")).toBeNull();
    expect(parsePath("")).toBeNull();
    expect(parsePath("/not-a-view")).toBeNull();
  });

  it("rejects unsafe ids and filters instead of passing them through", () => {
    expect(parsePath("/students/<script>")).toEqual({ view: "students" });
    expect(parsePath("/students", "?filter=../../etc/passwd")).toEqual({ view: "students" });
    expect(parsePath("/students/" + "x".repeat(80))).toEqual({ view: "students" });
  });

  it("round-trips through formatPath", () => {
    for (const target of [
      { view: "students" as const },
      { view: "students" as const, id: "st1" },
      { view: "finance" as const, filter: "overdue" },
    ]) {
      expect(parsePath(formatPath(target))).toEqual(target);
    }
  });

  it("omits unsafe values when formatting", () => {
    expect(formatPath({ view: "students", id: "a/b" })).toBe("/students");
  });

  it("keeps a deployment's base path out of the route, and in the URL", () => {
    const base = "/a-secret-slug-of-some-length";
    expect(formatPath({ view: "students", id: "st1" }, base)).toBe(`${base}/students/st1`);
    expect(parsePath(`${base}/students/st1`, "", base)).toEqual({ view: "students", id: "st1" });
    expect(parsePath(`${base}`, "", base)).toBeNull();
  });

  it("reads the fragment when one is present, so an old bookmark still lands", () => {
    expect(readTarget({ pathname: "/dashboard", hash: "#/finance" })).toEqual({ view: "finance" });
    expect(readTarget({ pathname: "/finance", search: "?filter=overdue", hash: "" })).toEqual({
      view: "finance",
      filter: "overdue",
    });
    expect(readTarget({ pathname: "/", hash: "" })).toBeNull();
  });

  it("recognises a legacy fragment, so the shell knows to migrate it", () => {
    expect(hasLegacyHash({ pathname: "/", hash: "#/finance" })).toBe(true);
    expect(hasLegacyHash({ pathname: "/finance", hash: "" })).toBe(false);
    expect(hasLegacyHash({ pathname: "/finance", hash: "#not-a-route" })).toBe(false);
  });
});
