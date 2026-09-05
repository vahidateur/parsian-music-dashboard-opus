/**
 * Architecture boundaries, enforced by the test suite rather than by review.
 *
 * The rule the whole data layer rests on is that a view knows nothing about
 * *where* data lives (§27). These checks read the source tree, so a future
 * change that reaches past the repository seam fails CI instead of quietly
 * landing.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Strips comments and string literals so prose cannot trigger a match. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const viewLayer = [...sourceFiles(join(ROOT, "views")), ...sourceFiles(join(ROOT, "components"))];

describe("views and components stay behind the data layer", () => {
  it("never touch localStorage directly", () => {
    // Matches real API usage (`localStorage.getItem`, `window.localStorage`),
    // not the word appearing as UI copy explaining where demo data lives.
    const offenders = viewLayer.filter((file) =>
      /(?:window\.)?localStorage\s*(?:\.|\[)/.test(code(readFileSync(file, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("never import the demo store", () => {
    const offenders = viewLayer.filter((file) => /services\/demoStore/.test(code(readFileSync(file, "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("never call fetch or hardcode an HTTP URL", () => {
    const offenders = viewLayer.filter((file) => {
      const source = code(readFileSync(file, "utf8"));
      return /\bfetch\s*\(/.test(source) || /https?:\/\//.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("no cosmetic loading delays", () => {
  it("no view fakes latency with a timer", () => {
    // `useAsyncView` was a 420ms timer presented as a loading state; loading
    // must reflect a real async operation (§11).
    const offenders = viewLayer.filter((file) => /useAsyncView/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("demo clock is not read directly", () => {
  it("views use the clock abstraction rather than the frozen constant", () => {
    // The pure helpers in `data/academy.ts` may default to it; views may not
    // import it, or production would render a frozen time (§9).
    const offenders = viewLayer.filter((file) => /\bACADEMY_NOW\b/.test(code(readFileSync(file, "utf8"))));
    expect(offenders).toEqual([]);
  });
});
