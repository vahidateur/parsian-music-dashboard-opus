// @vitest-environment jsdom
/**
 * The Scheduling view is fixture-free — enforced structurally, not by review.
 *
 * Until M4/CP1 this view rendered `weekSessions` from `src/data/records.ts`: a
 * seven-day fixture week keyed by `TODAY_INDEX`, with a `conflictWith` field no
 * domain has ever produced, four invented free-slot rows, a room-saturation
 * percentage (`faPercent(82)`) and a "room 1 is under pressure, move the violin
 * class to room 4" narrative. None of it came from a read, and all of it looked
 * like operational fact (H1a, H4).
 *
 * The behaviour that replaced it is asserted in `Scheduling.test.tsx`. This file
 * asserts the *shape* of the replacement, because that is the part a behavioural
 * test cannot pin down: a view can render a stub repository's data faithfully and
 * still keep a fixture import, a wall-clock read or a hardcoded narrative beside
 * it. Reading the source is what makes those regressions fail CI instead of
 * landing quietly — the same reason `architectureBoundaries.test.ts` and
 * `writeFeedbackHonesty.test.ts` exist.
 *
 * Comments are stripped before the identifier checks (the view's own header
 * documents what was removed, and prose about a rule must not satisfy it), and no
 * line numbers are used anywhere: they drift, and a gate that breaks on an
 * unrelated edit gets deleted.
 *
 * M4/CP2 moved the view's write forms beside it (`src/views/scheduling/`), and
 * CP3 added generation there. A gate that reads one file would have scanned the
 * calendar and missed every form that can write — so the shape rules below run
 * over the whole scheduling surface, discovered from the directory rather than
 * from a list someone has to remember to extend. The rules that are specific to
 * the calendar itself (its read hooks, its bounded window) still run against
 * `Scheduling.tsx` alone.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "src", "views", "Scheduling.tsx"), "utf8");

/** Strips comments so prose about a rule cannot satisfy (or trip) it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const VIEW = code(SOURCE);

const VIEWS = join(process.cwd(), "src", "views");

/**
 * The scheduling surface: the calendar plus every file beside it.
 *
 * Read from the directory on purpose. A hardcoded list is how CP2's dialog
 * escaped this gate, and the next form added here should be covered by it without
 * anyone remembering to say so.
 */
const SCHEDULING_SURFACE = [
  { name: "views/Scheduling.tsx", source: code(SOURCE) },
  ...readdirSync(join(VIEWS, "scheduling"))
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .map((file) => ({
      name: `views/scheduling/${file}`,
      source: code(readFileSync(join(VIEWS, "scheduling", file), "utf8")),
    })),
];

/** The domains this view is allowed to read from. */
const READ_HOOKS = [
  ["useSessions", "@/domains/scheduling/useScheduling"],
  ["useClasses", "@/domains/classes/useClasses"],
  ["useRooms", "@/domains/rooms/useRooms"],
  ["useTeachers", "@/domains/teachers/useTeachers"],
] as const;

/**
 * Identifiers that only exist in the dataset world: the seeded weekly template,
 * its today-index and its lookup helpers. M10 pruned the retired names
 * (GridSession, conflictWith); the seeded names stay forbidden here — a view
 * reads sessions through the scheduling domain, never from the seed.
 */
const FIXTURE_IDENTIFIERS = [
  "weekSessions",
  "TODAY_INDEX",
  "classById",
  "roomById",
  "teacherById",
] as const;

/**
 * The fabricated copy, as the user read it. Each of these described a fact no
 * read had produced; a conflict engine that is wired later will say something
 * different, and something true.
 */
const RETIRED_NARRATIVES = [
  "اشغال اتاق", // the room-occupancy panel
  "فشار اتاق", // room pressure / saturation
  "بازه‌های خالی", // the invented free-slot rows
  "پیشنهاد هوش", // the "academy intelligence" recommendation
  "انتقال به اتاق", // the transfer control H2 retired
  "تعارض برطرف شد", // the retracted success claim
  "هم‌پوشانی دارد", // the drawer's invented overlap verdict
  "روز سه‌شنبه", // the hardcoded weekday of the invented conflict
] as const;

describe("Scheduling view reads the scheduling domain", () => {
  it("imports its data from the domains", () => {
    for (const [hook, module] of READ_HOOKS) {
      expect(VIEW, `${hook} is imported`).toContain(`import { ${hook} } from "${module}"`);
    }
  });

  it("imports nothing from the fixture collections", () => {
    const imported = [...VIEW.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(imported.length).toBeGreaterThan(0);
    // The seed's weekly template and its entities live in `@/domains/demo/`;
    // the scheduling domain reads them, a view never does.
    expect(
      imported.filter((path) => path.startsWith("@/domains/demo/")),
      "an import from the demo data plane survived",
    ).toEqual([]);
  });

  it("carries none of the fixture identifiers", () => {
    for (const identifier of FIXTURE_IDENTIFIERS) {
      expect(VIEW, `${identifier} is only a fixture helper`).not.toContain(identifier);
    }
  });

  it("carries none of the retired fabricated narratives", () => {
    for (const narrative of RETIRED_NARRATIVES) {
      expect(VIEW, narrative).not.toContain(narrative);
    }
  });

  it("takes today from the academy clock rather than from the wall clock", () => {
    expect(VIEW).toMatch(/useAcademyNow\(|academyIsoDate\(/);
    // An inline `new Date()` or `Date.now()` would put a second, uncontrolled
    // clock in the view: demo mode freezes time precisely so this is checkable.
    expect(VIEW).not.toMatch(/new Date\(/);
    expect(VIEW).not.toMatch(/Date\.now\(/);
  });

  it("reports no statistic it cannot derive", () => {
    // The saturation panel behind the retired narrative showed `faPercent(82)`
    // with a `delta: 3.4` trend. Neither number came from a read, and there is no
    // occupancy or trend read in this view: a percentage or a delta reappearing
    // here has to arrive with the derivation that produces it, and whoever adds
    // it should update this gate on purpose.
    expect(VIEW).not.toContain("faPercent");
    expect(VIEW).not.toMatch(/\bdelta:/);
  });

  it("reads a bounded window and never defaults a read away", () => {
    // (calendar-specific: the write forms beside it read no list of their own)
    const call = /useSessions\(([\s\S]*?)\);/.exec(VIEW);
    expect(call, "sessions are read through useSessions").not.toBeNull();
    // No window is a read of the whole table; no page size silently falls back to
    // the API default and truncates the calendar (I16).
    expect(call![1]).toMatch(/\bfrom\b/);
    expect(call![1]).toMatch(/\bto\b/);
    expect(call![1]).toMatch(/per_page/);
    // `items || []` turns a failed or in-flight read into an empty list, which is
    // the difference between "nothing is scheduled" and "we could not read it".
    expect(VIEW).not.toMatch(/items\s*\|\|\s*\[\]/);
    expect(VIEW).toContain("error !== null");
  });
});

/* ------------------------------------------------------------------ */
/* The write surface                                                   */
/* ------------------------------------------------------------------ */
describe("the scheduling write surface stays fixture-free", () => {
  it("scans the calendar and every form beside it", () => {
    // Named explicitly so a rename or a move shrinks the gate loudly instead of
    // leaving it scanning one file and passing.
    const names = SCHEDULING_SURFACE.map((file) => file.name);
    expect(names).toContain("views/Scheduling.tsx");
    expect(names).toContain("views/scheduling/SessionWriteDialogs.tsx");
    expect(names).toContain("views/scheduling/GenerateSessionsDialog.tsx");
    expect(names.length).toBeGreaterThanOrEqual(3);
  });

  it("imports nothing from the fixture collections", () => {
    for (const file of SCHEDULING_SURFACE) {
      const imported = [...file.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
      expect(imported.filter((path) => path.startsWith("@/domains/demo/")), `${file.name} imports from the demo data plane`).toEqual([]);
    }
  });

  it("carries none of the fixture identifiers", () => {
    for (const file of SCHEDULING_SURFACE) {
      for (const identifier of FIXTURE_IDENTIFIERS) {
        expect(file.source, `${file.name} carries ${identifier}`).not.toContain(identifier);
      }
    }
  });

  it("carries none of the retired fabricated narratives", () => {
    for (const file of SCHEDULING_SURFACE) {
      for (const narrative of RETIRED_NARRATIVES) {
        expect(file.source, `${file.name} carries ${narrative}`).not.toContain(narrative);
      }
    }
  });

  it("takes no date from the wall clock and hardcodes no calendar day", () => {
    for (const file of SCHEDULING_SURFACE) {
      // A second, uncontrolled clock in a form is how a demo freezes and a
      // production build does not; a literal date is how a test passes today and
      // a user sees a stale window next month.
      expect(file.source, `${file.name} reads new Date()`).not.toMatch(/new Date\(/);
      expect(file.source, `${file.name} reads Date.now()`).not.toMatch(/Date\.now\(/);
      expect(file.source, `${file.name} hardcodes an ISO date`).not.toMatch(/20\d{2}-\d{2}-\d{2}/);
    }
  });

  it("reports no statistic it cannot derive", () => {
    for (const file of SCHEDULING_SURFACE) {
      expect(file.source, `${file.name} renders a fabricated percentage`).not.toContain("faPercent");
      expect(file.source, `${file.name} renders a fabricated trend`).not.toMatch(/\bdelta:/);
    }
  });

  it("fakes no completion with a timer", () => {
    for (const file of SCHEDULING_SURFACE) {
      // A write surface that "completes" on a timer is a success toast with no
      // repository behind it — the exact defect H2 exists to prevent (§11).
      expect(file.source, `${file.name} fakes latency`).not.toMatch(/\bsetTimeout\s*\(/);
      expect(file.source, `${file.name} fakes latency`).not.toMatch(/\bsetInterval\s*\(/);
    }
  });
});
