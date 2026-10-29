/**
 * The target copy seam's contract.
 *
 * Two variants of one module, one slot each: the demo target and the client
 * target. The rule that makes the seam work is that a slot added to one side
 * is added to the other — a slot that exists only in the client variant puts
 * client wording into the demo bundle, and the demo bundle must never claim a
 * missing server: the demo serves every capability it offers from the local
 * store.
 *
 * The bundle-level consequence is asserted by
 * `src/__tests__/bundleBoundary.test.ts` against the real build output. This
 * is the source-level guard that says WHY the two sides must match, and it
 * names no Persian literal of its own: every string it compares is read from
 * the two files, so the gate cannot drift from the copy it guards.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DEMO_PATH = join(ROOT, "src/targets/targetCopy.ts");
const CLIENT_PATH = join(ROOT, "src/targets/targetCopy.client.ts");
const DEMO = readFileSync(DEMO_PATH, "utf8");
const CLIENT = readFileSync(CLIENT_PATH, "utf8");

/** Strips comments, so only real code is compared. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** The exported slot names of one variant. */
function slots(source: string): string[] {
  return [...code(source).matchAll(/export (?:const|function) ([A-Za-z0-9_]+)/g)].map((m) => m[1]).sort();
}

/**
 * The string literals of one variant: double-quoted, and the literal PARTS of
 * a template (an interpolated template is a sentence with a hole in it, and
 * each side of the hole is still wording that must not travel).
 */
function literals(source: string): string[] {
  const quoted = [...code(source).matchAll(/"([^"\\]*)"/g)].map((m) => m[1]);
  const templated = [...code(source).matchAll(/`([^`]*)`/g)].flatMap((m) => m[1].split(/\$\{[^}]*\}/));
  return [...quoted, ...templated].filter((text) => text.trim().length >= 12);
}

/** Every source file under `src/`, except the target seam's own directory. */
function sourceFiles(dir = join(ROOT, "src")): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full === join(ROOT, "src", "targets")) continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("the target copy seam", () => {
  it("both variants export the same slot names", () => {
    expect(slots(CLIENT)).toEqual(slots(DEMO));
    expect(slots(DEMO).length).toBeGreaterThan(0);
  });

  it("neither variant carries the other one's wording", () => {
    for (const literal of literals(DEMO)) {
      expect(CLIENT, `the client bundle would carry the demo wording "${literal}"`).not.toContain(literal);
    }
    for (const literal of literals(CLIENT)) {
      expect(DEMO, `the demo bundle would carry the client wording "${literal}"`).not.toContain(literal);
    }
  });

  it("no module outside the seam hardcodes the client's server-claim wording", () => {
    // The defect this gate exists for: a client-only sentence written into a
    // SHARED module reaches the demo bundle, which then claims a server it
    // never had. The wording lives in the seam, and only in the seam.
    const clientOnly = literals(CLIENT).filter((literal) => literal.includes("متصل") || literal.includes("سرور"));
    expect(clientOnly.length).toBeGreaterThan(0);
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
      for (const literal of clientOnly) {
        expect(
          text,
          `${file.replace(ROOT + "/", "")} hardcodes the client's server-claim wording`,
        ).not.toContain(literal);
      }
    }
  });
  it("no module outside the seam hardcodes the demo target's own-name wording", () => {
    // The defect this gate exists for (found in the real browser): a sentence
    // that says «دمو» written into a SHARED view reaches the client build, where
    // nothing on screen is demo material. The demo wording lives in the seam.
    const demoOnly = literals(DEMO).filter((literal) => literal.includes("دمو"));
    expect(demoOnly.length).toBeGreaterThan(0);
    for (const file of sourceFiles()) {
      if (file.includes("__tests__")) continue;
      const text = readFileSync(file, "utf8");
      for (const literal of demoOnly) {
        expect(
          text,
          `${file.replace(ROOT + "/", "")} hardcodes the demo target's wording "${literal}"`,
        ).not.toContain(literal);
      }
    }
  });
});
