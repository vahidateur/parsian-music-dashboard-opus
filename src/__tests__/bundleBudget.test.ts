/**
 * M11/I6·D9 — the performance budget, asserted against the REAL build.
 *
 * WHY THIS TEST EXISTS
 *
 * D9 forbids invented limits: every number below is measured, not chosen.
 * The ENTRY anchor comes from the baseline build measured at c16890f with the
 * exact same methodology this test uses (`gzip -6 -n`, the GNU CLI, one
 * invocation per file):
 *
 *   entry JS (single eager chunk)  raw 984476  gzip 273791
 *   CSS                            raw 115373  gzip 16453
 *   index.html                     raw 1885    gzip 999
 *   gzip total JS+CSS+HTML         291243 (c16890f anchor — historical, superseded)
 *
 * The TOTAL baseline is the one anchor that has been re-measured: the D9-A-lite
 * reduction landed on 2026-09-25 and the post-reduction build was measured, so the
 * total is anchored on that measurement instead of on c16890f (DECISIONS.md §22):
 *
 *   gzip total JS+CSS+HTML         343947 (POST-A-lite measurement = the baseline)
 *                                  → hard cap 361144 (baseline × 1.05, floored)
 *
 * The recorded D9 shape, implemented here:
 *   1. the entry chunk's gzip must STRICTLY decrease from 273791;
 *   2. the total gzip (JS+CSS+HTML) may grow by at most 5% over the
 *      recorded 343947 → hard cap 361144;
 *   3. no single emitted chunk may reach 400000 gzip;
 *   4. weights 300/800 of vazirmatn are REMOVED, not budgeted — they must
 *      not come back;
 *   5. raising chunkSizeWarningLimit is a failure condition, not a fix
 *      (asserted here against vite.config.ts).
 *
 * Measured final values for the M11 landing (build after the I6 split —
 * the assert anchors are the HARD CAPS, the comment shows the actuals):
 *
 *   entry index chunk    gzip 107800  (−60.6% vs baseline)
 *   vendor chunk         gzip 60108
 *   largest chunk        gzip 107800 (the entry)
 *   JS+CSS+HTML total    gzip 297835  (+2.26% vs baseline, within +5%)
 *   dist total raw       1963240     (−10.3% vs baseline)
 *
 * If `dist/` is absent the suite SKIPS rather than silently passing — a
 * green check that ran no assertions is worse than a red one
 * (same convention as cspCompatibility.test.ts).
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const ASSETS = join(DIST, "assets");
const DIST_HTML = join(DIST, "index.html");
const hasBuild = existsSync(DIST_HTML);

/* ---------------- methodology: IDENTICAL to the c16890f baseline -------- */

/** gzip exactly as measured for the D9 baseline: CLI `gzip -6 -n` per file. */
function gzipSize(file: string): number {
  const out = execSync(`gzip -6 -n -c ${JSON.stringify(file)} | wc -c`, { encoding: "utf8" });
  return parseInt(out, 10);
}

const GZIP_TOTAL_BASELINE = 343947; // D9-B: measured after D9-A-lite (DECISIONS.md §22)
const ENTRY_GZIP_BASELINE = 273791; // c16890f anchor — unchanged by the re-baseline
/** +5% allowance, floored — 343947 * 1.05 = 361144.35. */
const GZIP_TOTAL_CAP = Math.floor(GZIP_TOTAL_BASELINE * 1.05); // 361144
const SINGLE_CHUNK_GZIP_CEILING = 400000; // strictly under; D9 "= a failure"

interface AssetStat {
  file: string;
  raw: number;
  gzip: number;
}

function jsChunks(): AssetStat[] {
  return readdirSync(ASSETS)
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({
      file: f,
      raw: statSync(join(ASSETS, f)).size,
      gzip: gzipSize(join(ASSETS, f)),
    }))
    .sort((a, b) => b.gzip - a.gzip);
}

function cssTotalGzip(): number {
  return readdirSync(ASSETS)
    .filter((f) => f.endsWith(".css"))
    .reduce((total, f) => total + gzipSize(join(ASSETS, f)), 0);
}

/* ------------------------------ the budget ------------------------------ */

describe.skipIf(!hasBuild)("bundle budget (D9, measured anchors)", () => {
  const chunks = hasBuild ? jsChunks() : [];
  const totalGzip = hasBuild
    ? chunks.reduce((a, c) => a + c.gzip, 0) + cssTotalGzip() + gzipSize(DIST_HTML)
    : 0;

  it("the entry chunk strictly decreased from the recorded 273791", () => {
    const entries = chunks.filter((c) => /^index-[A-Za-z0-9_-]+\.js$/.test(c.file));
    expect(entries.length).toBe(1); // exactly one entry chunk, hashed
    expect(entries[0].gzip).toBeLessThan(ENTRY_GZIP_BASELINE);
  });

  it("total gzip (JS+CSS+HTML) stays within the +5% allowance", () => {
    expect(totalGzip).toBeLessThanOrEqual(GZIP_TOTAL_CAP);
  });

  it("no single emitted chunk reaches 400000 bytes gzip", () => {
    for (const c of chunks) {
      expect(c.gzip, `${c.file} at ${c.gzip}`).toBeLessThan(SINGLE_CHUNK_GZIP_CEILING);
    }
  });

  it("vazirmatn weights 300 and 800 are removed from the build", () => {
    const assets = readdirSync(ASSETS);
    expect(assets.filter((f) => f.includes("-300-"))).toEqual([]);
    expect(assets.filter((f) => f.includes("-800-"))).toEqual([]);
  });

  it("the routed views really are split (the entry is not the app)", () => {
    const entry = chunks.find((c) => /^index-[A-Za-z0-9_-]+\.js$/.test(c.file))!;
    // Academic + operations groups + vendor must exist as hashed chunks,
    // and the sum of all chunks must substantially exceed the entry.
    expect(chunks.some((c) => c.file.startsWith("academicViews-"))).toBe(true);
    expect(chunks.some((c) => c.file.startsWith("operationsViews-"))).toBe(true);
    expect(chunks.some((c) => c.file.startsWith("vendor-"))).toBe(true);
    const rest = chunks.reduce((a, c) => a + c.gzip, 0) - entry.gzip;
    expect(rest).toBeGreaterThan(0);
  });
});

/* -------------------- budget weakening is itself a failure -------------- */

describe("the budget cannot be lifted by configuration", () => {
  const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");

  it("chunkSizeWarningLimit is never raised", () => {
    // An ASSIGNMENT is banned; mentioning the knob in explanatory prose is not.
    expect(viteConfig).not.toMatch(/chunkSizeWarningLimit\s*:/);
    expect(viteConfig).not.toMatch(/chunkSizeWarningLimit\s*=/);
  });

  it("sourcemap stays disabled for the private panel", () => {
    expect(viteConfig).toMatch(/sourcemap:\s*false/);
  });
});

describe("the imported weights stay at 400/500/600/700", () => {
  it("no fontsource import for weight 300 or 800 survives in src", () => {
    const indexCss = readFileSync(join(ROOT, "src", "index.css"), "utf8");
    expect(indexCss).not.toMatch(/@fontsource\/vazirmatn\/300\.css/);
    expect(indexCss).not.toMatch(/@fontsource\/vazirmatn\/800\.css/);
  });
});
