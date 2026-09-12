/**
 * Honest write feedback, enforced by the suite rather than by review.
 *
 * Two rules the product learned the hard way (H2 and H3 in
 * `docs/engineering/OPEN_ITEMS.md`):
 *
 *   1. A success toast is a claim that a write happened. So a file that cannot
 *      reach the data layer must not contain one at all, and the four views that
 *      still render static fixtures must contain none whatsoever — for them the
 *      absence is a proof, not a convention: there is no repository in scope to
 *      have written through.
 *   2. Calling a real write "demo data" is the same dishonesty in the opposite
 *      direction, so a confirmation that uses the demo label must derive it from
 *      the sanctioned environment seam (`useIsDemoEnvironment`) instead of
 *      hardcoding it.
 *
 * These checks read the source tree, like `architectureBoundaries.test.ts`, so a
 * future change that reintroduces a claim without a write fails CI instead of
 * quietly landing. Line numbers are deliberately not used anywhere here: they
 * drift, and a gate that breaks on an unrelated edit gets deleted.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

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

/** Strips comments so prose about a rule cannot satisfy (or trip) it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const rel = (file: string) => relative(SRC, file).split("\\").join("/");

/**
 * A success toast being *reported*, not the `Toast["tone"]` union that declares
 * the value — hence the trailing comma or brace, which the type declaration in
 * `context/AppContext.tsx` does not have.
 */
const reportsSuccess = (file: string) => /tone:\s*"success"\s*[,}]/.test(code(readFileSync(file, "utf8")));

/** The data layer, as a view or panel may reach it. */
const reachesDataLayer = (file: string) =>
  /\bget[A-Z]\w*Repository\s*\(/.test(code(readFileSync(file, "utf8")));

const all = sourceFiles(SRC);
const views = sourceFiles(join(SRC, "views"));

describe("no success toast without a write", () => {
  /**
   * These four render `src/data/records.ts` fixtures and have no domain behind
   * them yet (scheduling and attendance have complete domains the views do not
   * use; finance and reports have none). Nothing in them can write, so any
   * success toast there is by definition a false claim.
   */
  const FIXTURE_DRIVEN_VIEWS = [
    "views/Scheduling.tsx",
    "views/Attendance.tsx",
    "views/Finance.tsx",
    "views/Reports.tsx",
  ];

  it("the fixture-driven views report no success at all", () => {
    const offenders = views.filter((file) => FIXTURE_DRIVEN_VIEWS.includes(rel(file)) && reportsSuccess(file));
    expect(offenders.map(rel)).toEqual([]);
  });

  /**
   * Anywhere else in the view layer, a success toast is allowed only where the
   * file can actually reach a repository. One exception, and it is a genuine one:
   * the design-system page demonstrates the toast component itself («رزونانس
   * موفقیت» — "success resonance"), which is a specimen, not a report about data.
   */
  const SUCCESS_WITHOUT_DATA_LAYER = ["views/DesignSystemView.tsx"];

  it("a view that reports success can reach the data layer", () => {
    const offenders = views
      .filter((file) => reportsSuccess(file) && !reachesDataLayer(file))
      .map(rel)
      .filter((file) => !SUCCESS_WITHOUT_DATA_LAYER.includes(file));
    expect(offenders).toEqual([]);
  });

  it("the specimen page is still the only view allowed to fake one", () => {
    // Exact match, so the exception list cannot quietly grow — and cannot stay
    // stale either, which is what keeps it honest as an exception.
    const exceptions = views.filter((file) => reportsSuccess(file) && !reachesDataLayer(file)).map(rel);
    expect(exceptions).toEqual(SUCCESS_WITHOUT_DATA_LAYER);
  });
});

describe("the demo label is derived, not asserted", () => {
  /** A confirmation whose `detail` calls the saved record demo data. */
  const labelsWriteAsDemo = (file: string) =>
    /detail:[^\n]*دادهٔ دمو/.test(code(readFileSync(file, "utf8")));

  const asksTheEnvironment = (file: string) => /useIsDemoEnvironment/.test(code(readFileSync(file, "utf8")));

  /**
   * The five sites H3 covered now derive their copy from the environment seam.
   * Three Settings panels were found carrying the identical hardcoded label
   * after the same kind of real, awaited write; they are recorded in
   * `docs/engineering/OPEN_ITEMS.md` and are outside M2's approved scope, so
   * they are listed here rather than silently passing.
   *
   * The list is asserted exactly, in both directions: fixing one of them fails
   * this test until the entry is removed, and a new offender fails it too. That
   * is the point — the debt can only shrink, and only in the open.
   */
  const TRACKED_DEMO_LABEL_DEBT = [
    "domains/instruments/InstrumentsPanel.tsx",
    "domains/progress/RepertoirePanel.tsx",
    "domains/rooms/RoomsPanel.tsx",
  ];

  it("every hardcoded demo label left is a tracked debt", () => {
    const offenders = all
      .filter((file) => labelsWriteAsDemo(file) && !asksTheEnvironment(file))
      .map(rel)
      .sort();
    expect(offenders).toEqual([...TRACKED_DEMO_LABEL_DEBT].sort());
  });

  it("the surfaces H3 fixed still ask the environment which one they are in", () => {
    const fixed = [
      "domains/branding/BrandingPanel.tsx",
      "views/Classes.tsx",
      "views/Students.tsx",
      "views/Teachers.tsx",
    ];
    const offenders = fixed.filter((file) => {
      const full = join(SRC, file);
      return !labelsWriteAsDemo(full) || !asksTheEnvironment(full);
    });
    expect(offenders, "a fixed surface stopped deriving its copy").toEqual([]);
  });
});
