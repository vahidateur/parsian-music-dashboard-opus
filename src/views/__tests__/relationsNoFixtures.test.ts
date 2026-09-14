/**
 * The M7 relation surfaces read their relations from the domains — enforced
 * structurally, and enforced IN STAGES so the gate can land before the rewiring.
 *
 * THE PROBLEM THIS GATE SOLVES
 *
 * `Students.tsx`, `Teachers.tsx` and `Classes.tsx` render their relations from
 * `@/data/records`: a session grid from the legacy weekly template
 * (`weekSessions`), teacher/room/class names from the fixture resolvers
 * (`teacherById`, `classById`, the `rooms` array), the class roster from the
 * fixture student collection, plus numbers that were never measured (`delta: 11`,
 * `delta: 3.4`, a hardcoded fee, a synthesized attendance series, an invented
 * preferred slot). None of that is visible to a behavioural test, because the
 * views render those fixtures faithfully. It is visible in the shape of the code,
 * which is what a gate reads.
 *
 * WHY IT IS STAGED, AND WHY STAGING DOES NOT WEAKEN IT
 *
 * CP1 lands the shared plumbing and this gate; CP2 rewires Students, CP3
 * Teachers, CP4 Classes and the navigation counts. A gate that goes red for the
 * two checkpoints in between would be switched off rather than fixed — so each
 * surface declares the rules it must already satisfy (`enforcedRules`) and the
 * rules its checkpoint will turn on (`stagedRules`), and the two are RATCHETED
 * IN BOTH DIRECTIONS:
 *
 *   - an enforced surface fails on any hit;
 *   - a staged surface fails if it carries NONE of the coupling it says it is
 *     deferring, so a checkpoint cannot rewire a surface and leave it marked
 *     pending — it has to flip the stage in the open;
 *   - a staged surface's `pendingBecause` tokens are checked to be REALLY THERE,
 *     so the deferral cannot be prose about code that already changed.
 *
 * The rules themselves are never relaxed to make a checkpoint green: turning one
 * off for a surface means deleting a rule id from a list in this file, in the
 * same commit as the code that needs it.
 *
 * RULES ARE PROBED
 *
 * Every rule carries a probe source it must reject. A rule that cannot fire is
 * a rule that silently stopped protecting anything, and it fails here.
 *
 * WHAT IS NOT IN SCOPE
 *
 * `src/data/*` is M7's source of truth for seeds, not a target: the demo dataset
 * is legitimate data, and demo mode is a real environment. This gate forbids the
 * VIEW layer from pulling fixture collections and resolvers into a render path;
 * it says nothing about the seed, the store or the domains. `Finance.tsx` and
 * `Reports.tsx` still read fixture series (OPEN_ITEMS I2) and belong to a later
 * phase — they are not surfaces here on purpose.
 *
 * Comments are stripped before every check (prose about a rule must not satisfy
 * it), and no line numbers are used anywhere: they drift, and a gate that breaks
 * on an unrelated edit gets deleted.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const VIEWS = join(ROOT, "src", "views");
const RELATIONS_DIR = join(VIEWS, "relations");
const RECORDS_FILE = "src/data/records.ts";
const ACADEMY_FILE = "src/data/academy.ts";

/** Strips comments so prose about a rule cannot satisfy (or trip) it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function sourceOf(file: string): string {
  return code(readFileSync(join(ROOT, file), "utf8"));
}

/* ------------------------------------------------------------------ */
/* Rule catalogue                                                      */
/* ------------------------------------------------------------------ */

type RuleId =
  | "fixture-import"
  | "fixture-relation"
  | "fabricated-figure"
  | "own-source-of-truth"
  | "unbounded-read"
  | "static-nav-count";

interface Rule {
  id: RuleId;
  /** What the rule forbids, one line — used in failure messages. */
  forbids: string;
  /** Source that MUST be reported. A rule that cannot fire is a broken rule. */
  probe: string;
  /**
   * Every violation in `source`, phrased for a failure message.
   *
   * `file` is passed because one rule is about components rather than about
   * modules: a view may not read the frozen demo instant, while the fixture
   * module that DEFINES it obviously may.
   */
  find: (source: string, file: string) => string[];
}

/** View-layer components: the only files a "views may not…" rule can address. */
const isViewComponent = (file: string): boolean =>
  file.startsWith("src/views/") || file.startsWith("src/components/");

/**
 * The fixtures a surface may still name: TYPES (their relocation is the M10
 * fixture/type/seed separation) and pure label maps (presentation vocabulary with
 * no data behind it). Everything else exported by the two fixture modules is a
 * data path, and the forbidden set is DERIVED from those modules rather than
 * listed here — a fixture added later is covered without anyone remembering.
 */
const ALLOWED_FIXTURE_VALUES = new Set([
  // Label maps: how the product names things it already has.
  "WEEKDAYS",
  "WEEKDAYS_SHORT",
  "viewTitles",
  "paymentLabel",
  "studentStatusLabel",
  "attendanceLabel",
  "subscriptionStatusLabel",
  "resourceKindLabel",
]);

/** `export const|function|class` names — the module's data and helpers. */
function valueExports(source: string): string[] {
  return [...source.matchAll(/^export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
    (match) => match[1],
  );
}

const RECORDS_SOURCE = readFileSync(join(ROOT, RECORDS_FILE), "utf8");
const ACADEMY_SOURCE = readFileSync(join(ROOT, ACADEMY_FILE), "utf8");

const FORBIDDEN_FIXTURE_VALUES = valueExports(RECORDS_SOURCE).filter(
  (name) => !ALLOWED_FIXTURE_VALUES.has(name),
);
const FORBIDDEN_ACADEMY_VALUES = valueExports(ACADEMY_SOURCE).filter(
  (name) => !ALLOWED_FIXTURE_VALUES.has(name),
);

const FIXTURE_MODULES: readonly { module: string; forbidden: readonly string[] }[] = [
  { module: "@/data/records", forbidden: FORBIDDEN_FIXTURE_VALUES },
  { module: "@/data/academy", forbidden: FORBIDDEN_ACADEMY_VALUES },
];

function fixtureImportViolations(source: string): string[] {
  const out: string[] = [];

  // `import { … } from "…"`, `import type { … } from "…"` and `import { type X }`.
  for (const statement of source.matchAll(/import\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)"/g)) {
    const statementIsType = Boolean(statement[1]);
    const clause = statement[2];
    const module = statement[3];
    const fixture = FIXTURE_MODULES.find((entry) => entry.module === module);
    if (!fixture) continue;

    // A namespace import hides every export behind one alias.
    if (clause.includes("*")) {
      out.push(`${module} → namespace import 「${clause.trim()}」`);
    }

    const braced = clause.match(/\{([\s\S]*)\}/);
    if (!braced) continue;
    for (const entry of braced[1].split(",")) {
      const raw = entry.trim();
      if (!raw) continue;
      const isType = statementIsType || raw.startsWith("type ");
      const name = raw.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (isType) continue;
      if (fixture.forbidden.includes(name)) out.push(`${module} → ${name}`);
    }
  }

  // A dynamic import bypasses the static clause entirely.
  for (const match of source.matchAll(/import\s*\(\s*"(@\/data\/[^"]+)"\s*\)/g)) {
    out.push(`dynamic import of ${match[1]}`);
  }

  return out;
}

/**
 * Fixture relations that reach a view as an identifier rather than as an import
 * clause — the resolvers the surfaces call today, and the legacy collections they
 * read.
 */
const RELATION_IDENTIFIERS = [
  "weekSessions",
  "todayAttendance",
  "attendanceTrend",
  "attendanceByDay",
  "studentById",
  "teacherById",
  "classById",
  "roomById",
  "studentStats",
  "TODAY_INDEX",
  "academyClasses",
] as const;

/** Identifiers above that the fixture module does not export, and why they are here. */
const RELATION_ALIASES: Record<string, string> = {
  roomById: "rooms.find((r) => r.id === …) — the lookup shape the classes surface uses",
  academyClasses: "`classes` imported under an alias by the students surface",
};

function relationViolations(source: string): string[] {
  return RELATION_IDENTIFIERS.filter((name) => new RegExp(`\\b${name}\\b`).test(source)).map(
    (name) => `names the fixture relation 「${name}」`,
  );
}

interface Pattern {
  pattern: RegExp;
  what: string;
  /** Source that MUST match this one pattern. */
  probe: string;
  /** True for rules that speak about components, not about data modules. */
  viewOnly?: boolean;
}

const patternFind =
  (patterns: readonly Pattern[]) =>
  (source: string, file: string): string[] =>
    patterns
      .filter((entry) => (!entry.viewOnly || isViewComponent(file)) && entry.pattern.test(source))
      .map((entry) => `carries ${entry.what}`);

/** Figures and claims that assert a measurement nothing in this build measured. */
const FABRICATED_FIGURES: readonly Pattern[] = [
  { pattern: /\bdelta\s*:/, what: "a trend delta nothing measured", probe: "delta: 3.4" },
  { pattern: /\b3_600_000\b|\b3600000\b/, what: "a hardcoded course fee", probe: "{faToman(3_600_000)}" },
  { pattern: /i\s*\*\s*7\s*\+/, what: "a synthesized attendance series", probe: "const seed = (i * 7 + s.attendance) % 10;" },
  { pattern: /عصرها بعد از/, what: "an invented preferred-slot", probe: "<span>عصرها بعد از ۱۶:۰۰</span>" },
  { pattern: /نیازمند جایگزین/, what: "an invented substitution workload", probe: 'hint: "۵ کلاس نیازمند جایگزین"' },
  {
    pattern: /options\s*:\s*\[[^\]]*٪/,
    what: "an availability percentage written into a select option",
    probe: 'options: ["اتاق ۱", "اتاق ۴ (۵۸٪ آزاد)"]',
  },
];

/** Seams a view may not reach through: they are the domains' and the store's. */
const OWN_SOURCE_PATTERNS: readonly Pattern[] = [
  { pattern: /services\/demoStore/, what: "the demo store", probe: 'import { demoStore } from "@/services/demoStore";' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, what: "browser storage", probe: 'localStorage.setItem("k", "v");' },
  { pattern: /new Date\(\s*\)/, what: "the wall clock instead of the academy clock", probe: "const now = new Date();" },
  { pattern: /Date\.now\(/, what: "the wall clock instead of the academy clock", probe: "const t = Date.now();" },
  {
    pattern: /\bACADEMY_NOW\b/,
    what: "the frozen demo instant",
    probe: "if (minutes >= ACADEMY_NOW) return;",
    // The constant is DEFINED in the fixture module and read by the seed, so this
    // pattern addresses components only (§9: a view must reach time through
    // `academyNow()` / `useAcademyNow()`, never through the frozen value).
    viewOnly: true,
  },
  { pattern: /NODE_ENV/, what: "a test-environment branch", probe: 'if (process.env.NODE_ENV === "test") return;' },
];

/**
 * A number written into the navigation chrome as if it were current state. The
 * badge is the one that reads as a live count («۳ کلاس ثبت‌نشده»); the command
 * hints carry the same claim («مالی · ۳ مورد»).
 */
const NAV_COUNT_PATTERNS: readonly Pattern[] = [
  { pattern: /\bbadge\s*:\s*\d/, what: "a static numeric badge", probe: 'badge: 3, hint: "حضور و غیاب"' },
  {
    pattern: /\bhint\s*:\s*"[^"]*[\u06F0-\u06F9]/,
    what: "a number written into a navigation hint",
    probe: 'hint: "۳ کلاس ثبت‌نشده"',
  },
];

const ALL_PATTERNS: readonly Pattern[] = [
  ...FABRICATED_FIGURES,
  ...OWN_SOURCE_PATTERNS,
  ...NAV_COUNT_PATTERNS,
];

/** One probe source per pattern-based rule, so the rule-level liveness check has one. */
const probeFor = (patterns: readonly Pattern[]): string =>
  patterns.map((pattern) => pattern.probe).join("\n");

/** Every list read an M7 surface may make: each needs an explicit page size. */
const LIST_HOOKS = [
  "useStudentList",
  "useTeachers",
  "useClasses",
  "useEnrollments",
  "useRooms",
  "useSessions",
  "useAttendanceRecords",
  "useAttendanceCorrections",
  "useConversations",
] as const;

/** Reads that must ALSO be bounded by a date window, not just a page size. */
const WINDOWED_HOOKS: readonly string[] = ["useSessions"];

/** The argument text of every call of `callee`, balanced-paren aware. */
function callArguments(source: string, callee: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(new RegExp(`\\b${callee}\\s*\\(`, "g"))) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let index = start;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      index += 1;
    }
    out.push(source.slice(start, index - 1));
  }
  return out;
}

function readViolations(source: string): string[] {
  const out: string[] = [];
  for (const hook of LIST_HOOKS) {
    for (const args of callArguments(source, hook)) {
      const flat = args.replace(/\s+/g, " ");
      if (!/\bper_page\s*:/.test(flat)) out.push(`${hook}(…) without per_page`);
      if (!WINDOWED_HOOKS.includes(hook)) continue;
      if (!/\bfrom\s*:/.test(flat)) out.push(`${hook}(…) without from`);
      if (!/\bto\s*:/.test(flat)) out.push(`${hook}(…) without to`);
    }
  }
  return out;
}

const RULES: readonly Rule[] = [
  {
    id: "fixture-import",
    forbids: "imports a fixture collection, resolver or helper instead of a domain read",
    probe: 'import { weekSessions } from "@/data/records";',
    find: (source) => fixtureImportViolations(source),
  },
  {
    id: "fixture-relation",
    forbids: "names a fixture relation resolver or the legacy weekly template",
    probe: "const sessions = weekSessions.filter((w) => w.classId === teacherById(id)?.id);",
    find: (source) => relationViolations(source),
  },
  {
    id: "fabricated-figure",
    forbids: "renders a number or a claim that nothing in this build measured",
    probe: probeFor(FABRICATED_FIGURES),
    find: patternFind(FABRICATED_FIGURES),
  },
  {
    id: "own-source-of-truth",
    forbids: "reaches past the domains to the store, browser storage or a clock of its own",
    probe: probeFor(OWN_SOURCE_PATTERNS),
    find: patternFind(OWN_SOURCE_PATTERNS),
  },
  {
    id: "unbounded-read",
    forbids: "reads a list without an explicit page size, or sessions without a window",
    probe: "useSessions({ teacherId: id }); useTeachers({});",
    find: (source) => readViolations(source),
  },
  {
    id: "static-nav-count",
    forbids: "puts a literal count into the navigation chrome",
    probe: probeFor(NAV_COUNT_PATTERNS),
    find: patternFind(NAV_COUNT_PATTERNS),
  },
];

function ruleById(id: RuleId): Rule {
  const rule = RULES.find((entry) => entry.id === id);
  if (!rule) throw new Error(`unknown rule id ${id}`);
  return rule;
}

/* ------------------------------------------------------------------ */
/* Surfaces and their stages                                           */
/* ------------------------------------------------------------------ */

type Checkpoint = "CP2" | "CP3" | "CP4";
type Stage = "enforced" | Checkpoint;
type RuleScope = "relation-surface" | "navigation";

/**
 * The three views plus any file beside them. Discovered at run time for the
 * reason the scheduling gate learned the hard way: a gate that reads one file
 * stops being a gate the moment the code grows a directory beside it.
 */
function surfaceFiles(viewFile: string): string[] {
  const base = viewFile.replace(/\.tsx$/, "");
  const dir = join(VIEWS, base.replace(/^src\/views\//, ""));
  if (!existsSync(dir)) return [viewFile];
  const beside = readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .map((file) => `${base}/${file}`);
  return [viewFile, ...beside];
}

/** The plumbing this checkpoint adds — enforced from the moment it exists. */
const PLUMBING_FILES = readdirSync(RELATIONS_DIR)
  .filter((file) => /\.tsx?$/.test(file))
  .sort()
  .map((file) => `src/views/relations/${file}`);

/** Rules every relation surface must satisfy NOW, staged or not. */
const ALWAYS_ON_RULES: readonly RuleId[] = ["own-source-of-truth", "unbounded-read"];
/** Rules a relation surface satisfies once its checkpoint has rewired it. */
const RELATION_STAGED_RULES: readonly RuleId[] = [
  "fixture-import",
  "fixture-relation",
  "fabricated-figure",
];

/** The navigation chrome's numbers: a figure nothing measured, and a literal count. */
const NAVIGATION_STAGED_RULES: readonly RuleId[] = ["fabricated-figure", "static-nav-count"];

const SCOPE_RULES: Record<RuleScope, readonly RuleId[]> = {
  "relation-surface": [...ALWAYS_ON_RULES, ...RELATION_STAGED_RULES],
  navigation: [...ALWAYS_ON_RULES, ...NAVIGATION_STAGED_RULES],
};

interface Surface {
  id: string;
  scope: RuleScope;
  stage: Stage;
  /**
   * Coupling this surface still defers, as literal tokens that MUST occur in its
   * source. The ledger is checked, so it cannot outlive the code it describes.
   * Empty exactly when the surface is enforced.
   */
  pendingBecause: string[];
  files: string[];
  enforcedRules: RuleId[];
  stagedRules: RuleId[];
}

function relationSurface(
  id: string,
  stage: Stage,
  pendingBecause: readonly string[],
  viewFile: string,
): Surface {
  const enforced = stage === "enforced";
  return {
    id,
    scope: "relation-surface",
    stage,
    pendingBecause: enforced ? [] : [...pendingBecause],
    files: surfaceFiles(viewFile),
    enforcedRules: [...ALWAYS_ON_RULES, ...(enforced ? RELATION_STAGED_RULES : [])],
    stagedRules: enforced ? [] : [...RELATION_STAGED_RULES],
  };
}

const SURFACES: readonly Surface[] = [
  {
    id: "m7-relation-plumbing",
    scope: "relation-surface",
    stage: "enforced",
    pendingBecause: [],
    files: PLUMBING_FILES,
    enforcedRules: [...SCOPE_RULES["relation-surface"]],
    stagedRules: [],
  },
  relationSurface("students", "enforced", [], "src/views/Students.tsx"),
  relationSurface(
    "teachers",
    "CP3",
    ["weekSessions", "classById(", "TODAY_INDEX", "delta:", "۵ کلاس نیازمند جایگزین"],
    "src/views/Teachers.tsx",
  ),
  relationSurface(
    "classes",
    "CP4",
    ["weekSessions", "teacherById(", "delta: 3.4", "delta: 2.1"],
    "src/views/Classes.tsx",
  ),
  {
    id: "navigation",
    scope: "navigation",
    stage: "CP4",
    // The nav badge, the count in its hint, and the command hints that carry the
    // same claim. `navGroups` itself is static product identity and stays; the
    // NUMBERS in it are what CP4 must make real or remove.
    pendingBecause: ["badge: 3", "badge: 5", "۳ کلاس ثبت‌نشده", "۵۸٪ آزاد", "مالی · ۳ مورد"],
    files: [ACADEMY_FILE, "src/components/layout/Sidebar.tsx"],
    enforcedRules: [...ALWAYS_ON_RULES],
    stagedRules: [...NAVIGATION_STAGED_RULES],
  },
];

function surfaceById(id: string): Surface {
  const surface = SURFACES.find((entry) => entry.id === id);
  if (!surface) throw new Error(`unknown surface ${id}`);
  return surface;
}

interface Hit {
  file: string;
  rule: RuleId;
  message: string;
}

function hits(ruleIds: readonly RuleId[], source: string, file: string): Hit[] {
  return ruleIds.flatMap((rule) =>
    ruleById(rule)
      .find(source, file)
      .map((message) => ({ file, rule, message })),
  );
}

function hitsFor(surface: Surface, ruleIds: readonly RuleId[]): Hit[] {
  return surface.files.flatMap((file) => hits(ruleIds, sourceOf(file), file));
}

const describeHit = (hit: Hit): string =>
  `${hit.file} · ${hit.rule} — ${ruleById(hit.rule).forbids}: ${hit.message}`;

/* ------------------------------------------------------------------ */
/* Requirements the checkpoints carry, recorded where the work happens  */
/* ------------------------------------------------------------------ */

interface PendingRequirement {
  surfaceId: string;
  checkpoint: Checkpoint;
  requirement: string;
  /** A file whose current shape is the reason the requirement exists. */
  evidence: string;
}

const PENDING_REQUIREMENTS: readonly PendingRequirement[] = [
  {
    surfaceId: "teachers",
    checkpoint: "CP3",
    requirement:
      "the students-of-a-teacher relation needs a CONSUMER-side key guard: `useStudentList` has the " +
      "known render-time stale-frame gap (OPEN_ITEMS I13) — a params change can commit one frame with the " +
      "previous query's rows and `loading === false`. CP3 must guard at the call site; fixing the shared " +
      "hook is a separate issue and not part of M7.",
    evidence: "src/domains/students/useStudents.ts",
  },
];

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

describe("the M7 surfaces are scanned, and staged honestly", () => {
  it("scans every relation surface, and names the files it read", () => {
    expect(SURFACES.map((surface) => surface.id)).toEqual([
      "m7-relation-plumbing",
      "students",
      "teachers",
      "classes",
      "navigation",
    ]);

    for (const surface of SURFACES) {
      expect(surface.files.length, `${surface.id} has no files`).toBeGreaterThan(0);
      for (const file of surface.files) {
        expect(existsSync(join(ROOT, file)), `${surface.id} lists ${file}, which does not exist`).toBe(true);
      }
    }

    // Named, so a rename or a move fails here instead of silently shrinking the scan.
    expect(surfaceById("students").files).toContain("src/views/Students.tsx");
    expect(surfaceById("teachers").files).toContain("src/views/Teachers.tsx");
    expect(surfaceById("classes").files).toContain("src/views/Classes.tsx");
    expect(surfaceById("navigation").files).toEqual([ACADEMY_FILE, "src/components/layout/Sidebar.tsx"]);
    // The plumbing is the surface CP1 itself owns, so its discovery is asserted.
    expect(surfaceById("m7-relation-plumbing").files).toContain("src/views/relations/academyDay.ts");
    expect(surfaceById("m7-relation-plumbing").files).toContain("src/views/relations/indexById.ts");
  });

  it("every surface declares its whole rule set, split into enforced and staged", () => {
    for (const surface of SURFACES) {
      const declared = [...surface.enforcedRules, ...surface.stagedRules].sort();
      expect(declared, `${surface.id} must declare exactly the rules of its scope`).toEqual(
        [...SCOPE_RULES[surface.scope]].sort(),
      );
      expect(
        surface.enforcedRules.filter((id) => surface.stagedRules.includes(id)),
        `${surface.id} lists a rule as both enforced and staged`,
      ).toEqual([]);

      if (surface.stage === "enforced") {
        expect(surface.stagedRules, `${surface.id} is enforced, so nothing may stay staged`).toEqual([]);
        expect(surface.pendingBecause, `${surface.id} is enforced, so its deferral ledger must be empty`).toEqual([]);
      } else {
        expect(surface.stagedRules.length, `${surface.id} defers nothing`).toBeGreaterThan(0);
        expect(surface.pendingBecause.length, `${surface.id} must say what it still defers`).toBeGreaterThan(0);
      }
    }
  });

  it("stages every surface on the checkpoint that owns it", () => {
    // The M7 plan, in one place. A checkpoint that rewires a surface flips its
    // stage here — the refusal to do so is what the per-surface test below fails on.
    expect(surfaceById("m7-relation-plumbing").stage).toBe("enforced");
    // CP2 turned the students surface on: it carries no coupling at all now.
    expect(surfaceById("students").stage).toBe("enforced");
    expect(surfaceById("teachers").stage).toBe("CP3");
    expect(surfaceById("classes").stage).toBe("CP4");
    expect(surfaceById("navigation").stage).toBe("CP4");
  });

  it("every rule still detects what it names", () => {
    for (const rule of RULES) {
      expect(
        rule.find(rule.probe, "src/views/Students.tsx"),
        `rule ${rule.id} did not fire on its own probe — it protects nothing`,
      ).not.toEqual([]);
    }
  });

  it("every pattern inside every rule still detects what it names", () => {
    // Rule-level liveness is not enough: a rule is a list of patterns, and one
    // silently broken pattern is one fabrication that stops being reported.
    for (const entry of ALL_PATTERNS) {
      expect(
        entry.pattern.test(entry.probe),
        `pattern 「${entry.what}」 did not fire on its own probe — it protects nothing`,
      ).toBe(true);
    }
    // And the view-scoped pattern is scoped in BOTH directions: it fires on a
    // component and is silent on the module that defines the constant.
    const frozenInstant = OWN_SOURCE_PATTERNS.find((entry) => entry.what === "the frozen demo instant")!;
    expect(patternFind([frozenInstant])(frozenInstant.probe, "src/views/Students.tsx")).not.toEqual([]);
    expect(patternFind([frozenInstant])(ACADEMY_SOURCE, ACADEMY_FILE)).toEqual([]);
  });

  it("reads the fixture modules' own exports, so a fixture added later is covered", () => {
    // Non-vacuity: the forbidden sets come from the modules, not from a list that
    // can quietly go stale.
    expect(FORBIDDEN_FIXTURE_VALUES.length).toBeGreaterThan(20);
    for (const name of ["weekSessions", "todayAttendance", "classById", "teacherById", "classes", "students", "rooms", "teachers"]) {
      expect(FORBIDDEN_FIXTURE_VALUES).toContain(name);
    }
    expect(FORBIDDEN_ACADEMY_VALUES).toContain("schedule");
    expect(FORBIDDEN_ACADEMY_VALUES).toContain("quickActions");
    // The two allowed names that are not exports of the fixture module are here
    // for a reason, and the reason is named.
    expect(Object.keys(RELATION_ALIASES).sort()).toEqual(["academyClasses", "roomById"]);
    for (const name of RELATION_IDENTIFIERS) {
      if (name in RELATION_ALIASES) continue;
      expect(
        FORBIDDEN_FIXTURE_VALUES,
        `「${name}」 is not (or no longer) a fixture export — the identifier list is stale`,
      ).toContain(name);
    }
    // And the allowed side stays small: the moment a collection joins it, this
    // test is the place that says no.
    expect([...ALLOWED_FIXTURE_VALUES].every((name) => name.endsWith("Label") || name.startsWith("WEEKDAYS") || name === "viewTitles")).toBe(true);
  });
});

describe("each surface satisfies its enforced rules today, or says so", () => {
  for (const surface of SURFACES) {
    const title =
      surface.stage === "enforced"
        ? `${surface.id}: carries no fixture coupling at all`
        : `${surface.id}: carries none of what it defers to ${surface.stage} — flip it to "enforced" if the rewiring is done`;
    const stage = surface.stage;

    it(title, () => {
      /*
        Joined into one string rather than compared as an array: a checkpoint
        that breaks this has to see WHAT it broke, and a reviewer reading a diff
        message gets the rule id, the rule and the exact import or identifier.
        An empty hit list is the empty string, so the assertion is the same one.
      */
      const enforcedHits = hitsFor(surface, surface.enforcedRules);
      expect(enforcedHits.map(describeHit).join("\n"), `${surface.id} breaks a rule that is not staged`).toBe("");

      const stagedHits = hitsFor(surface, surface.stagedRules);
      if (stage === "enforced") {
        expect(stagedHits.map(describeHit).join("\n"), `${surface.id} is marked enforced but still carries coupling`).toBe("");
        return;
      }

      expect(
        stagedHits.length,
        `${surface.id} still defers to ${stage}, but none of the coupling it defers is present`,
      ).toBeGreaterThan(0);

      // The deferral ledger is checked against the source it describes.
      const sources = surface.files.map(sourceOf).join("\n");
      for (const token of surface.pendingBecause) {
        expect(
          sources.includes(token),
          `${surface.id} defers 「${token}」, which is not in its source any more — update the ledger or flip the stage`,
        ).toBe(true);
      }
    });
  }
});

describe("the plumbing this checkpoint adds is held to the rules from day one", () => {
  it("the day primitive reads the academy clock and nothing else", () => {
    const source = sourceOf("src/views/relations/academyDay.ts");
    expect(source).toContain('from "@/domains/shared/clock"');
    expect(source).toContain("academyNow(");
    expect(source, "the day must come from a caller or the academy clock").not.toMatch(/@\/data\//);
  });

  it("the index primitive is pure: it imports nothing and knows no domain", () => {
    const source = sourceOf("src/views/relations/indexById.ts");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("records the CP3 key-guard requirement with the surface that must honour it", () => {
    expect(PENDING_REQUIREMENTS.length).toBeGreaterThan(0);
    for (const entry of PENDING_REQUIREMENTS) {
      const surface = surfaceById(entry.surfaceId);
      expect(
        surface.stage,
        `${entry.surfaceId} is already enforced, so its pending requirement must be deleted`,
      ).toBe(entry.checkpoint);
      expect(entry.requirement).toContain("useStudentList");
      expect(entry.requirement).toContain("key guard");
    }

    // And the requirement is not prose about a hypothetical: the shared hook
    // really is the one without the render-time key invariant.
    const hook = sourceOf("src/domains/students/useStudents.ts");
    expect(
      hook.includes("useResourceList"),
      "useStudentList now uses the key-safe shared hook — re-read the CP3 requirement above and delete it if the consumer-side guard is no longer needed",
    ).toBe(false);
  });
});
