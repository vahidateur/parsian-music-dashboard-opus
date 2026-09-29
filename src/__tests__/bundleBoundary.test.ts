/**
 * Bundle boundary — the real build outputs, both directions.
 *
 * Phase 2A step 8: the CLIENT build must contain no DemoStore, no demo seeds,
 * no demo credentials, no demo dataset markers and no demo-only wording in ANY
 * chunk (eager, lazy or dynamic) — while DISCLOSING the unavailable domains
 * with the Persian unavailable notice. The DEMO build must contain demo
 * functionality (positive probes) and must not claim a backend it does not
 * have (the client's unavailable wording stays out of it).
 *
 * Conventions copied from `bundleBudget.test.ts` / `cspCompatibility.test.ts`:
 * if the artifact is absent the case SKIPS rather than silently passing — a
 * green check that ran no assertions is worse than a red one.
 *
 * ARTIFACT LAYOUT. `npm run build:client` → `dist/client`; `npm run
 * build:demo` → `dist/demo`; the bare `npm run build` (the demo target's
 * default) → `dist/` and, being an in-root outDir, EMPTIES `dist/` — which
 * removes `dist/client` and `dist/demo`. So the two composed builds can be
 * inspected side by side. `bundleBudget` measures `dist/client` against the
 * production cap and reports `dist/demo` separately; `cspCompatibility` still
 * expects the bare build at `dist/`. The demo probes below therefore read
 * `dist/demo` when it exists and fall back to `dist/`; the client probes read
 * `dist/client`. Verify with:
 *
 *   npm run build:client && npm run build:demo && npx vitest run src/__tests__/bundleBoundary.test.ts
 *
 * Every probe string is a LITERAL that survives minification (storage keys,
 * Persian copy, seed ids) — identifiers get renamed, strings do not.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * Every emitted text asset under `dir` (html/css/js), read as utf8.
 *
 * `skipTopDirs` keeps sibling targets out of the walk: `dist/` is the demo
 * root, but `dist/client/` (and `dist/demo/` when built) are separate outputs
 * nested inside it — mixing them would scan the client bundle with demo
 * assertions and vice versa.
 */
function readAssets(dir: string, skipTopDirs: readonly string[] = []): string {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (current === dir && skipTopDirs.includes(entry)) continue;
        walk(full);
      } else if (/\.(js|mjs|html|css)$/.test(entry)) {
        out.push(readFileSync(full, "utf8"));
      }
    }
  };
  walk(dir);
  expect(out.length, `no text assets found under ${dir}`).toBeGreaterThan(0);
  return out.join("\n");
}

/** Demo-capability strings that must never appear in the client bundle. */
const CLIENT_MUST_ABSENT = [
  "ava:demo:dataset", // demo dataset marker (storage key)
  "ava:demo:credentials", // demo credential store key
  "ava:demo:session", // demo session key
  "@demo.local", // demo account domain
  "arena-demo", // demo passphrase literal / demo backup filename prefix
  "md_gal_hall", // a seed-only record id (proof the seed is not bundled)
  "بدون امنیت واقعی", // demo-only Persian panel copy
  "حذف دادهٔ دمو", // demo-only Persian destructive-action copy
] as const;

/** The client MUST disclose unavailable domains — presence probes. */
const CLIENT_MUST_PRESENT = [
  "هنوز به سامانهٔ سرور متصل نیست", // DOMAIN_UNAVAILABLE notice copy
] as const;

/** Demo-build positives: demo capability really is in this bundle. */
const DEMO_MUST_PRESENT = [
  "ava:demo:dataset",
  "arena-demo",
  "md_gal_hall",
  "بدون امنیت واقعی",
  "حذف دادهٔ دمو",
] as const;

/** The demo composition serves everything it offers — no client-only notice. */
const DEMO_MUST_ABSENT = [
  "هنوز به سامانهٔ سرور متصل نیست",
] as const;

describe("client build (dist/client) — demo capability absent, disclosure present", () => {
  const clientHtml = join(ROOT, "dist", "client", "index.html");

  it.runIf(existsSync(clientHtml))(
    "emits no demo marker in any chunk and ships the unavailable notice",
    () => {
      const bundle = readAssets(join(ROOT, "dist", "client"));
      for (const marker of CLIENT_MUST_ABSENT) {
        expect(
          bundle.includes(marker),
          `client bundle must not contain ${JSON.stringify(marker)}`,
        ).toBe(false);
      }
      for (const probe of CLIENT_MUST_PRESENT) {
        expect(
          bundle.includes(probe),
          `client bundle must contain the unavailable disclosure ${JSON.stringify(probe)}`,
        ).toBe(true);
      }
    },
  );

  it.runIf(!existsSync(clientHtml))("skipped — dist/client absent (run npm run build:client)", () => {
    expect(existsSync(clientHtml)).toBe(false);
  });
});

describe("demo build (dist/demo, else dist/) — demo capability present, no false server claim", () => {
  const demoRoot = existsSync(join(ROOT, "dist", "demo", "index.html"))
    ? join(ROOT, "dist", "demo")
    : join(ROOT, "dist");
  const demoHtml = join(demoRoot, "index.html");

  it.runIf(existsSync(demoHtml))(
    "ships demo markers/seed and never the client's unavailable wording",
    () => {
      const bundle = readAssets(demoRoot, ["client", "demo"]);
      for (const probe of DEMO_MUST_PRESENT) {
        expect(
          bundle.includes(probe),
          `demo bundle must contain ${JSON.stringify(probe)}`,
        ).toBe(true);
      }
      for (const marker of DEMO_MUST_ABSENT) {
        expect(
          bundle.includes(marker),
          `demo bundle must not claim a missing backend (${JSON.stringify(marker)})`,
        ).toBe(false);
      }
    },
  );

  it.runIf(!existsSync(demoHtml))("skipped — dist/demo and dist/ absent (run npm run build:demo)", () => {
    expect(existsSync(demoHtml)).toBe(false);
  });
});
