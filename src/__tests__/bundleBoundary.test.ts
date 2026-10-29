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

/**
 * Demo-capability strings that must never appear in the client bundle.
 *
 * W8 adds the markers the fixture scan already proved absent. Identifiers that
 * minification erases are still banned: if a future build keeps them as
 * strings, the client artifact has grown a demo dependency. `دمو` is not in
 * this list — it is ordinary Persian and is not a demo-capability marker.
 */
const CLIENT_MUST_ABSENT = [
  "ava:demo:", // any demo storage key, including the three named below
  "ava:demo:dataset", // demo dataset marker (storage key)
  "ava:demo:credentials", // demo credential store key
  "ava:demo:session", // demo session key
  "@demo.local", // demo account domain
  "arena-demo", // demo passphrase literal / demo backup filename prefix
  "md_gal_hall", // a seed-only record id (proof the seed is not bundled)
  "بدون امنیت واقعی", // demo-only Persian panel copy
  "حذف دادهٔ دمو", // demo-only Persian destructive-action copy
  "data-operator-import", // W7B Import control; fixture graph only
  "data-operator-reset", // W7B Reset control; fixture graph only
  "importSample",
  "resetToClean",
  "loadDatasetArtifact",
  "data/dataset/",
  "DEMO_PASSPHRASE",
  "createSeedDataset",
  "DemoDataPanel",
  "demoDataManager",
  "DemoBackedNotice",
  "localStore",
  "DataLifecycleGate",
  "VITE_DATA_SOURCE=demo",
  // Demo-target deferral wording (found in the real browser, now routed through
  // the target copy seam): a customer must never be told a capability is absent
  // "in the demo" or that files live only "in this browser in the demo version".
  "در دمو و محیط خالی",
  "در دمو فعال نیست",
  "در دمو انجام نشد",
  "قواعد جلسه، دادهٔ دمو",
  "در نسخهٔ دمو فایل",
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
  "data-operator-import",
  "data-operator-reset",
  "importSample",
  "resetToClean",
  // The same deferral wording on its demo side of the seam (non-vacuity: proves
  // the probes above can be found when they are there).
  "در دمو و محیط خالی",
  "در دمو فعال نیست",
  "در دمو انجام نشد",
] as const;

/** One rule for the emitted scan and the synthetic probe. */
function boundaryViolations(
  bundle: string,
  mustAbsent: readonly string[],
  mustPresent: readonly string[],
): string[] {
  const violations: string[] = [];
  for (const marker of mustAbsent) {
    if (bundle.includes(marker)) violations.push(`contains ${JSON.stringify(marker)}`);
  }
  for (const probe of mustPresent) {
    if (!bundle.includes(probe)) violations.push(`missing ${JSON.stringify(probe)}`);
  }
  return violations;
}

const FORBIDDEN_THIRD_BUILDS = ["customer", "operator"] as const;

function thirdBuildNames(entries: readonly string[]): string[] {
  return entries.filter((name) => (FORBIDDEN_THIRD_BUILDS as readonly string[]).includes(name));
}

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
      expect(boundaryViolations(bundle, CLIENT_MUST_ABSENT, CLIENT_MUST_PRESENT)).toEqual([]);
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
      const bundle = readAssets(demoRoot, ["client", "demo", "customer", "operator"]);
      expect(boundaryViolations(bundle, DEMO_MUST_ABSENT, DEMO_MUST_PRESENT)).toEqual([]);
    },
  );

  it.runIf(!existsSync(demoHtml))("skipped — dist/demo and dist/ absent (run npm run build:demo)", () => {
    expect(existsSync(demoHtml)).toBe(false);
  });
});

describe("bundle boundary rules are non-vacuous", () => {
  it("fires when a client marker is present and when the disclosure is missing", () => {
    const dirty = `${CLIENT_MUST_ABSENT[0]}\n${CLIENT_MUST_PRESENT.join("\n")}`;
    expect(boundaryViolations(dirty, CLIENT_MUST_ABSENT, CLIENT_MUST_PRESENT)).toContain(
      `contains ${JSON.stringify(CLIENT_MUST_ABSENT[0])}`,
    );
    expect(boundaryViolations("clean", CLIENT_MUST_ABSENT, CLIENT_MUST_PRESENT)).toContain(
      `missing ${JSON.stringify(CLIENT_MUST_PRESENT[0])}`,
    );
    expect(boundaryViolations(CLIENT_MUST_PRESENT.join("\n"), CLIENT_MUST_ABSENT, CLIENT_MUST_PRESENT)).toEqual([]);
  });

  it("fires when the fixture bundle lacks a required marker", () => {
    expect(boundaryViolations("", DEMO_MUST_ABSENT, DEMO_MUST_PRESENT)).toContain(
      `missing ${JSON.stringify("importSample")}`,
    );
    expect(boundaryViolations(DEMO_MUST_PRESENT.join("\n"), DEMO_MUST_ABSENT, DEMO_MUST_PRESENT)).toEqual([]);
  });
});

describe("two compositions, no third build", () => {
  it("dist has no customer or operator artifact", () => {
    const dist = join(ROOT, "dist");
    const entries = existsSync(dist) ? readdirSync(dist) : [];
    expect(thirdBuildNames(entries)).toEqual([]);
    expect(thirdBuildNames(["client", "demo", "customer"])).toEqual(["customer"]);
    expect(thirdBuildNames(["operator"])).toEqual(["operator"]);
    expect(thirdBuildNames(["client", "demo"])).toEqual([]);
  });

  it("package scripts and tsconfigs name only client and demo", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["build:client"]).toContain("--outDir dist/client");
    expect(pkg.scripts["build:demo"]).toContain("--outDir dist/demo");
    expect(pkg.scripts["build:customer"]).toBeUndefined();
    expect(pkg.scripts["build:operator"]).toBeUndefined();
    expect(existsSync(join(ROOT, "tsconfig.client.json"))).toBe(true);
    expect(existsSync(join(ROOT, "tsconfig.demo.json"))).toBe(true);
    expect(existsSync(join(ROOT, "tsconfig.customer.json"))).toBe(false);
    expect(existsSync(join(ROOT, "tsconfig.operator.json"))).toBe(false);
    const vite = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    expect(vite).toContain('const APP_TARGET: "demo" | "client"');
    expect(vite).not.toMatch(/APP_TARGET === "(?:operator|customer)"/);
    expect(vite).not.toContain("dist/customer");
    expect(vite).not.toContain("dist/operator");
  });
});
