// @vitest-environment jsdom
/**
 * Regression tests for command-palette "recents" validation.
 *
 * Recents are read from localStorage and turned directly into navigation
 * targets, so a tampered entry could otherwise push the app to a bogus route.
 * `loadRecents` validates every field instead of casting.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { loadRecentTargets as loadRecents } from "@/domains/shared/recentTargets";

/** Must match the key used by the recents service. */
const RECENT_KEY = "ava:palette-recents";

const write = (value: unknown) => localStorage.setItem(RECENT_KEY, JSON.stringify(value));

const valid = { id: "st1", title: "سارا محمدی", subtitle: "هنرجو", view: "students", recordId: "st1" };

beforeEach(() => localStorage.clear());

describe("loadRecents", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(loadRecents()).toEqual([]);
  });

  it("keeps a well-formed entry", () => {
    write([valid]);
    expect(loadRecents()).toHaveLength(1);
  });

  it("drops entries whose view is not a real ViewId", () => {
    write([{ ...valid, view: "evil-route" }]);
    expect(loadRecents()).toEqual([]);
  });

  it("drops entries with an unsafe recordId", () => {
    write([{ ...valid, recordId: "../../etc/passwd" }]);
    expect(loadRecents()).toEqual([]);
  });

  it("drops entries with an unsafe filter token", () => {
    write([{ ...valid, filter: "a b<script>" }]);
    expect(loadRecents()).toEqual([]);
  });

  it("drops entries with wrong field types", () => {
    write([{ ...valid, title: 42 }]);
    expect(loadRecents()).toEqual([]);
  });

  it("keeps valid entries while discarding invalid neighbours", () => {
    write([valid, { ...valid, id: "bad", view: "nope" }]);
    const out = loadRecents();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("st1");
  });

  it("survives non-array and malformed payloads", () => {
    write({ not: "an array" });
    expect(loadRecents()).toEqual([]);
    localStorage.setItem(RECENT_KEY, "{{{");
    expect(loadRecents()).toEqual([]);
  });

  it("caps the number of restored entries", () => {
    write(Array.from({ length: 50 }, (_, i) => ({ ...valid, id: `st${i}` })));
    expect(loadRecents().length).toBeLessThanOrEqual(5);
  });
});
