/**
 * The Compensation surface reads its domains and nothing else — a structural gate
 * (OPEN_ITEMS I21, audit finding S-6).
 *
 * WHY A DEDICATED FILE
 *
 * The recon that produced I21 measured the coverage and found the surface pinned
 * by its own behavioural suite (`compensationUi.test.tsx`) and by the two route
 * cases in `src/__tests__/routeProtection.test.tsx`, and by nothing list-driven
 * beyond that: `relationsNoFixtures`' `SURFACES` does not name it,
 * `emptyEnvironment`'s view lists do not name it, and `writeFeedbackHonesty`'s
 * `GRADUATED_VIEWS` ratchet has no entry it could honestly take (the view writes
 * through the compensation domain's hook, not through `getCompensationRepository(`).
 *
 * It is a NEW file rather than a registration in those lists, for three reasons
 * the recon measured rather than assumed:
 *
 *   - M7's `relationsNoFixtures` is the closed milestone's own gate; its surface
 *     ledger and its `surfaceFiles()` discovery are part of that milestone's
 *     frozen contract, and touching them is a gate-architecture change this
 *     package is not authorized to make;
 *   - `surfaceFiles()` derives the sibling directory from the VIEW file's
 *     basename (`src/views/Compensation/`); the directory is `compensation/`, so
 *     on a case-sensitive filesystem a registration would silently scan the view
 *     and leave both dialogs ungated. The three newer per-surface gates
 *     (`schedulingNoFixtures`, `attendanceNoFixtures`, `messagesNoFixtures`) read
 *     their directory by name — this file follows them, and adds the one shared
 *     view-layer file the surface imports, which no per-surface gate owned;
 *   - the ledger read is `useCompensations(...)`, which is in neither
 *     `relationsNoFixtures`' `LIST_HOOKS` nor `architectureBoundaries`'
 *     page-size catalogue, so the page-size half of the contract needs a gate of
 *     its own rather than a registration that would not enforce it.
 *
 * WHAT IT PINS
 *
 *   - discovery of the whole surface: the view, every file under
 *     `src/views/compensation/` (discovered, never listed) and
 *     `src/views/shared/jalaliInput.ts`, which the dialogs and both scheduling
 *     dialogs share and which belonged to no surface gate before this one;
 *   - no import from the fixture modules, no fixture relation named in code;
 *   - no demo store, no browser storage, no wall clock, no frozen instant and no
 *     test-environment branch;
 *   - a stated page size on every list read — including `useCompensations`, which
 *     the generic catalogues cannot see — and a windowed `useSessions` read that
 *     carries `from`/`to`/`per_page`, with variable arguments unable to evade it;
 *   - none of the M7 figure patterns, no timer, no hardcoded ISO date;
 *   - the effective-session contract: actions are aimed at
 *     `currentAttempt.sessionId`, and `bookedSessionId` stays a displayed fact;
 *   - the permission boundary (`schedule.write` plus an authenticated principal,
 *     never a role name), and dialogs that own no feedback of their own;
 *   - the C-2 disclosure as display only — it may never gate a booking;
 *   - the hardening invariants (S-1, S-3, M-1): a failed count, a failed ledger
 *     refresh and a failed effective-session read each stay visible, name
 *     themselves and offer their own retry, instead of becoming an empty list.
 *
 * HOW IT READS
 *
 * Comments are stripped before every check, so prose about a rule can neither
 * satisfy it nor trip it. Import assertions PARSE statements, so a namespace
 * import, an `import type`, a shared clause or a dynamic import is seen as what it
 * is. Line numbers are used nowhere: they drift, and a gate that breaks on an
 * unrelated edit gets deleted.
 *
 * Every rule carries a probe it must fire on, and the discovery cases name the
 * exact files, so the gate can neither pass with nothing to scan nor shrink
 * quietly when a file moves.
 *
 * NOT FIXED HERE, ON PURPOSE: the wider gate defects the same recon found (M1–M6
 * in the package record) are global gate-hardening work, not this surface's.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, viewPermissions } from "@/domains/auth/permissions";

const SRC = join(process.cwd(), "src");
const VIEWS = join(SRC, "views");
const VIEW_FILE = join(VIEWS, "Compensation.tsx");
const SURFACE_DIR = join(VIEWS, "compensation");
const SHARED_FILE = join(VIEWS, "shared", "jalaliInput.ts");

/** `src`-relative, forward-slashed — how every other gate names a file. */
const rel = (file: string): string => relative(SRC, file).split("\\").join("/");

/** Strips comments, so only code is ever judged. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Every `.ts`/`.tsx` file under `dir`, recursively, sorted.
 *
 * Recursive on purpose: a fabrication that moves one directory down is still the
 * same defect, which is the lesson `schedulingNoFixtures` records for its own
 * surface. The directory is read by its real (lower-case) name — the view's
 * basename would not find it.
 */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out.sort();
}

/**
 * The surface, DISCOVERED rather than listed. `jalaliInput.ts` is named
 * explicitly because it lives beside no surface: it is shared view-layer code
 * that three surfaces import, and until this file nothing per-surface scanned it.
 */
const SURFACE_FILES: readonly string[] = [VIEW_FILE, ...filesUnder(SURFACE_DIR), SHARED_FILE];

const SURFACE = SURFACE_FILES.map((file) => ({
  file,
  name: rel(file),
  source: code(readFileSync(file, "utf8")),
}));

const VIEW = "views/Compensation.tsx";
const DIALOGS = "views/compensation/CompensationDialogs.tsx";
const SHARED = "views/shared/jalaliInput.ts";

const names = (): string[] => SURFACE.map((entry) => entry.name);

function sourceNamed(name: string): string {
  const found = SURFACE.find((entry) => entry.name === name);
  if (!found) throw new Error(`the surface no longer contains ${name}`);
  return found.source;
}

const view = (): string => sourceNamed(VIEW);
const dialogSources = (): string[] =>
  SURFACE.filter((entry) => entry.name.startsWith("views/compensation/")).map((entry) => entry.source);

/* ------------------------------------------------------------------ */
/* Reading the source                                                  */
/* ------------------------------------------------------------------ */

interface ImportStatement {
  names: readonly string[];
  module: string;
  dynamic: boolean;
}

/**
 * The import statements of a source file, parsed rather than substring-matched:
 * `import { a, b } from "…"`, `import type { A }`, `import * as ns from "…"`,
 * `import "…"` and `import("…")`. A namespace import hides every export behind
 * one alias, and a dynamic import bypasses the static clause entirely, so both
 * are recognised here instead of being missed by a name-level search.
 */
function importStatements(source: string): ImportStatement[] {
  const found: ImportStatement[] = [];
  const clauses: { clause: string; module: string }[] = [];
  for (const match of source.matchAll(/\bimport\s+([^;]*?)\s+from\s+"([^"]+)"/g)) {
    clauses.push({ clause: match[1], module: match[2] });
  }
  for (const match of source.matchAll(/\bimport\s+"([^"]+)"/g)) {
    clauses.push({ clause: "", module: match[1] });
  }
  for (const { clause, module } of clauses) {
    const braced = clause.match(/\{([\s\S]*)\}/);
    const names: string[] = braced
      ? braced[1]
          .split(",")
          .map((name) => name.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0].trim())
          .filter((name) => name.length > 0)
      : [];
    if (clause.includes("*")) names.push("*");
    const bare = clause
      .replace(/\{[\s\S]*\}/, "")
      .replace(/^\s*type\s+/, "")
      .trim();
    if (bare.length > 0 && !bare.startsWith("*")) names.push(bare.split(/[,\s]+/)[0]);
    found.push({ names, module, dynamic: false });
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)) {
    found.push({ names: [], module: match[1], dynamic: true });
  }
  return found;
}

/** True when one import statement pulls `name` from `module`. */
function importsFrom(source: string, name: string, module: string): boolean {
  return importStatements(source).some(
    (statement) => statement.module === module && statement.names.includes(name),
  );
}

/**
 * The argument text of every call of `callee`, balanced-paren aware.
 *
 * The text is judged, not a name: a call whose arguments are a VARIABLE cannot
 * state a page size, so it is reported like an object literal that omits one.
 */
function callArguments(source: string, callee: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`\\b${callee.replace(/\./g, "\\.")}\\s*\\(`, "g");
  for (const match of source.matchAll(pattern)) {
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

/* ------------------------------------------------------------------ */
/* The catalogues this surface is held to                              */
/* ------------------------------------------------------------------ */

/** The fixture modules, by prefix — `@/data/records` and `@/data/academy`. */
const FIXTURE_MODULE_PREFIX = "@/data/";

/**
 * Fixture relations that reach a view as an identifier rather than as an import
 * clause. The list is M7's (`relationsNoFixtures`): the resolvers and legacy
 * collections, plus `studentIds`, the denormalized projection §9 forbids as a
 * source of truth. No broader blacklist is invented here.
 */
const FIXTURE_IDENTIFIERS = [
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
  "studentIds",
] as const;

/** Seams a view may not reach through: they are the domains' and the store's. */
const OWN_SOURCE_PATTERNS: readonly { what: string; pattern: RegExp }[] = [
  { what: "the demo store", pattern: /services\/demoStore/ },
  { what: "browser storage", pattern: /\blocalStorage\b|\bsessionStorage\b/ },
  { what: "the wall clock instead of the academy clock", pattern: /new Date\(\s*\)/ },
  { what: "the wall clock instead of the academy clock", pattern: /Date\.now\(/ },
  { what: "the frozen demo instant", pattern: /\bACADEMY_NOW\b/ },
  { what: "a test-environment branch", pattern: /NODE_ENV/ },
];

/**
 * Figures and claims that assert a measurement nothing measured — the M7 figure
 * vocabulary, which is the one this surface's milestone shares. Only these
 * patterns: a blanket "no digits" rule would fail on the surface's own legitimate
 * Jalali and clock exemplars («۱۴۰۴/۰۷/۰۱», «۱۶:۰۰»), which are the shape of an
 * input, not a claim about data.
 */
const FABRICATED_FIGURES: readonly { what: string; pattern: RegExp }[] = [
  { what: "a trend delta nothing measured", pattern: /\bdelta\s*:/ },
  { what: "a hardcoded course fee", pattern: /\b3_600_000\b|\b3600000\b/ },
  { what: "a synthesized attendance series", pattern: /i\s*\*\s*7\s*\+/ },
  { what: "an invented preferred-slot", pattern: /عصرها بعد از/ },
  { what: "an invented substitution workload", pattern: /نیازمند جایگزین/ },
  { what: "an availability percentage written into a select option", pattern: /options\s*:\s*\[[^\]]*٪/ },
  {
    what: "a written-in count inside a select option",
    pattern: /options\s*:\s*\[[^\]]*\(\s*[\u06F0-\u06F9\d]+\s*\)/,
  },
];

/**
 * Every list read this surface makes, and the keys it must state.
 *
 * `useCompensations` is the entry the generic catalogues lack: the ledger and the
 * four count reads go through it, and a read that omits `per_page` falls back to
 * the API default and silently truncates the ledger.
 */
const BOUNDED_READS = [
  { hook: "useCompensations", required: ["per_page"], constant: "LEDGER_PER_PAGE" },
  { hook: "useSessions", required: ["per_page", "from", "to"], constant: "CANDIDATES_PER_PAGE" },
  { hook: "useClasses", required: ["per_page"], constant: "SUPPORT_PER_PAGE" },
  { hook: "useStudentList", required: ["per_page"], constant: "SUPPORT_PER_PAGE" },
  { hook: "useRooms", required: ["per_page"], constant: "SUPPORT_PER_PAGE" },
  { hook: "useTeachers", required: ["per_page"], constant: "SUPPORT_PER_PAGE" },
] as const;

/** Reads that act on a session, and may therefore never be aimed at the booked id. */
const SESSION_ACTIONS = ["useSessionRow", "rescheduleSession", "ledger.register", "ledger.schedule", "ledger.complete"] as const;

/** The verb calls a compensation write may make, for the gating checks below. */
const COMPENSATION_VERBS = ["ledger.register", "ledger.schedule", "ledger.complete"] as const;

/* ------------------------------------------------------------------ */
/* The rule catalogue                                                  */
/* ------------------------------------------------------------------ */

type RuleId =
  | "fixture-import"
  | "fixture-identifier"
  | "own-source-of-truth"
  | "unbounded-read"
  | "fabricated-figure"
  | "timer"
  | "hardcoded-iso-date"
  | "effective-session-target"
  | "permission-boundary"
  | "dialog-owned-feedback"
  | "roster-disclosure-not-a-gate"
  | "read-failure-honesty";

interface Rule {
  id: RuleId;
  /** What the rule forbids, one line — used in failure messages. */
  forbids: string;
  /** Source that MUST be reported: the rule's own proof that it can fire. */
  probe: string;
  /** The file the probe is judged as, for rules that only speak about one file. */
  probeFile: string;
  find: (source: string, file: string) => string[];
}

const patterns = (catalogue: readonly { what: string; pattern: RegExp }[]) =>
  (source: string): string[] =>
    catalogue.filter((entry) => entry.pattern.test(source)).map((entry) => `carries ${entry.what}`);

const RULES: readonly Rule[] = [
  {
    id: "fixture-import",
    forbids: "imports a fixture collection or helper instead of a domain read",
    probe: 'import { weekSessions } from "@/data/records";',
    probeFile: VIEW,
    find: (source) =>
      importStatements(source)
        .filter((statement) => statement.module.startsWith(FIXTURE_MODULE_PREFIX))
        .map((statement) =>
          statement.dynamic
            ? `dynamically imports 「${statement.module}」`
            : `imports 「${statement.names.join(", ")}」 from 「${statement.module}」`,
        ),
  },
  {
    id: "fixture-identifier",
    forbids: "names a fixture relation resolver or the legacy weekly template",
    probe: "const rows = weekSessions.filter((w) => w.classId === classById(w.classId)?.id);",
    probeFile: VIEW,
    find: (source) =>
      FIXTURE_IDENTIFIERS.filter((name) => new RegExp(`\\b${name}\\b`).test(source)).map(
        (name) => `names the fixture relation 「${name}」`,
      ),
  },
  {
    id: "own-source-of-truth",
    forbids: "reaches past the domains to the store, browser storage or a clock of its own",
    probe: 'import { demoStore } from "@/services/demoStore";',
    probeFile: VIEW,
    find: patterns(OWN_SOURCE_PATTERNS),
  },
  {
    id: "unbounded-read",
    forbids: "reads a list without an explicit page size, or sessions without a window",
    probe: "const rows = useCompensations(params);",
    probeFile: VIEW,
    find: (source) => {
      const out: string[] = [];
      for (const { hook, required } of BOUNDED_READS) {
        for (const args of callArguments(source, hook)) {
          const flat = args.replace(/\s+/g, " ");
          for (const key of required) {
            if (!new RegExp(`\\b${key}\\s*:`).test(flat)) out.push(`${hook}(…) states no ${key}`);
          }
        }
      }
      return out;
    },
  },
  {
    id: "fabricated-figure",
    forbids: "renders a number or a claim that nothing in this build measured",
    probe: 'const stat = { label: "x", value: "y", delta: 11 };',
    probeFile: VIEW,
    find: patterns(FABRICATED_FIGURES),
  },
  {
    id: "timer",
    forbids: "fakes a completion or a latency with a timer",
    probe: "setTimeout(() => setDone(true), 420);",
    probeFile: VIEW,
    find: (source) => {
      const out: string[] = [];
      if (/\bsetTimeout\s*\(/.test(source)) out.push("calls setTimeout(");
      if (/\bsetInterval\s*\(/.test(source)) out.push("calls setInterval(");
      return out;
    },
  },
  {
    id: "hardcoded-iso-date",
    forbids: "hardcodes a calendar date instead of deriving it",
    probe: 'const date = "2026-09-08";',
    probeFile: VIEW,
    find: (source) => {
      const match = source.match(/\d{4}-\d{2}-\d{2}/);
      return match ? [`hardcodes the ISO date 「${match[0]}」`] : [];
    },
  },
  {
    id: "effective-session-target",
    forbids: "aims a session action at the booked id instead of the effective one",
    probe: "useSessionRow(row.currentAttempt.bookedSessionId);",
    probeFile: VIEW,
    find: (source, file) => {
      if (!file.endsWith("Compensation.tsx")) return [];
      const out: string[] = [];
      for (const action of SESSION_ACTIONS) {
        for (const args of callArguments(source, action)) {
          if (/bookedSessionId/.test(args)) out.push(`${action}(…) is given bookedSessionId`);
        }
      }
      return out;
    },
  },
  {
    id: "permission-boundary",
    forbids: "offers a write without the RBAC permission and a principal, or branches on a role name",
    probe: "export function CompensationView() { return null; }",
    probeFile: VIEW,
    find: (source, file) => {
      if (!file.endsWith("Compensation.tsx")) return [];
      const out: string[] = [];
      if (!source.includes('useCan("schedule.write")')) {
        out.push("no write control states the schedule.write permission");
      }
      if (!/user\s*!==\s*null/.test(source)) out.push("the permission is not paired with a principal");
      if (!/canWrite\s*&&\s*actor/.test(source)) out.push("the write section is not gated on both");
      for (const role of ROLES) {
        if (source.includes(`"${role}"`)) out.push(`branches on the role name 「${role}」`);
      }
      return out;
    },
  },
  {
    id: "dialog-owned-feedback",
    forbids: "a dialog announces, reaches a repository or claims a success of its own",
    probe: 'notify({ tone: "success", title: "جبرانی ثبت شد" });',
    probeFile: DIALOGS,
    find: (source, file) => {
      if (!file.startsWith("views/compensation/")) return [];
      const out: string[] = [];
      if (/\bnotify\s*\(/.test(source)) out.push("calls notify() itself");
      if (/\bget[A-Z]\w*Repository\s*\(/.test(source)) out.push("reaches a repository of its own");
      if (/tone\s*:/.test(source)) out.push("carries toast copy");
      if (/\buseApp\s*\(/.test(source)) out.push("reads the app context to report");
      return out;
    },
  },
  {
    id: "roster-disclosure-not-a-gate",
    forbids: "uses the C-2 roster disclosure as an eligibility condition",
    probe: "if (compensation.currentAttempt.studentOnRoster === false) return false;",
    probeFile: VIEW,
    find: (source, file) => {
      const mentions = source.match(/studentOnRoster/g) ?? [];
      if (mentions.length === 0) return [];
      const out: string[] = [];
      if (file.startsWith("views/compensation/")) {
        out.push("a dialog sees the roster disclosure");
        return out;
      }
      // Every mention must sit inside the DISPLAY helper that words it; a mention
      // anywhere else is either a gate or a second source of truth for the fact.
      const start = source.indexOf("function rosterDisclosure(");
      const end = start === -1 ? -1 : source.indexOf("\n}", start);
      const inside = start === -1 || end === -1 ? "" : source.slice(start, end);
      const outside = source.replace(inside, "");
      if (/studentOnRoster/.test(outside)) out.push("names studentOnRoster outside the disclosure helper");
      for (const verb of COMPENSATION_VERBS) {
        for (const args of callArguments(source, verb)) {
          if (/studentOnRoster/.test(args)) out.push(`${verb}(…) is told about the roster`);
        }
      }
      if (/studentOnRoster[^\n]*(?:\breturn\s+false|disabled|\.register\(|\.schedule\(|\.complete\()/.test(source)) {
        out.push("gates a write on the disclosure");
      }
      return out;
    },
  },
  {
    id: "read-failure-honesty",
    forbids: "lets a failed read look like an empty or absent value",
    probe: "const ledger = useCompensations({ per_page: 1 });",
    probeFile: VIEW,
    find: (source, file) => {
      if (!file.endsWith("Compensation.tsx")) return [];
      const required: readonly { what: string; pattern: RegExp }[] = [
        { what: "the failed ledger refresh is not named", pattern: /ledger\.error !== null/ },
        { what: "the failed ledger refresh has no retry", pattern: /ledger\.reload\(\)/ },
        { what: "the failed effective-session read is not named", pattern: /drawerEffective\.error !== null/ },
        { what: "the failed effective-session read has no retry", pattern: /drawerEffective\.reload\(\)/ },
        { what: "a failed count is rendered as a value", pattern: /read\.error !== null/ },
        { what: "no retry re-runs the failed count reads", pattern: /failedCounts/ },
        { what: "the empty ledger names its own emptiness", pattern: /ledger\.items\.length === 0/ },
      ];
      const out = required.filter((entry) => !entry.pattern.test(source)).map((entry) => entry.what);
      if (/\.items\s*\|\|\s*\[\]/.test(source)) out.push("defaults a failed read to an empty list");
      return out;
    },
  },
];

const ruleById = (id: RuleId): Rule => {
  const rule = RULES.find((entry) => entry.id === id);
  if (!rule) throw new Error(`unknown rule id ${id}`);
  return rule;
};

const describeHit = (file: string, message: string): string => `${file} — ${message}`;

/* ------------------------------------------------------------------ */
/* Discovery — named, so a move or a rename fails here                 */
/* ------------------------------------------------------------------ */

describe("the compensation surface is discovered, and shrinking it fails here", () => {
  it("scans the view, every file beside it, and the shared view-layer helper", () => {
    // Named, so a rename, a move or a deletion fails here instead of silently
    // shrinking the gate. A FOURTH file is also an explicit edit: the gate says
    // what it scans rather than following whatever happens to be there.
    expect(names()).toEqual([VIEW, DIALOGS, SHARED]);
  });

  it("reads files that exist, and refuses to pass with nothing to scan", () => {
    expect(SURFACE.length, "the gate must not pass with no files").toBeGreaterThanOrEqual(3);
    for (const { file, name, source } of SURFACE) {
      expect(existsSync(file), `${name} is named but does not exist`).toBe(true);
      expect(source.length, `${name} scanned as empty`).toBeGreaterThan(0);
    }
  });

  it("keeps the directory discovered rather than listed", () => {
    const beside = names().filter((name) => name.startsWith("views/compensation/"));
    expect(beside.length, "the dialogs must be discovered through the directory").toBeGreaterThan(0);
    expect(beside).toContain(DIALOGS);
    // The shared helper lives outside the view's directory, so it is the one file
    // that a directory walk cannot find — it is named, and it is asserted here.
    expect(names()).toContain(SHARED);
  });
});

/* ------------------------------------------------------------------ */
/* Liveness — every rule fires on its own probe                        */
/* ------------------------------------------------------------------ */

describe("every rule still detects what it names", () => {
  for (const rule of RULES) {
    it(`${rule.id} fires on its probe`, () => {
      expect(
        rule.find(rule.probe, rule.probeFile),
        `rule ${rule.id} did not fire on its own probe — it protects nothing`,
      ).not.toEqual([]);
    });
  }

  it("covers every rule the surface declares, and no dead entry", () => {
    const ids = RULES.map((rule) => rule.id);
    expect(ids).toEqual([
      "fixture-import",
      "fixture-identifier",
      "own-source-of-truth",
      "unbounded-read",
      "fabricated-figure",
      "timer",
      "hardcoded-iso-date",
      "effective-session-target",
      "permission-boundary",
      "dialog-owned-feedback",
      "roster-disclosure-not-a-gate",
      "read-failure-honesty",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* The surface satisfies every rule today                              */
/* ------------------------------------------------------------------ */

describe("the compensation surface satisfies every rule today", () => {
  for (const rule of RULES) {
    it(`${rule.id}: ${rule.forbids}`, () => {
      const hits = SURFACE.flatMap((entry) =>
        rule.find(entry.source, entry.name).map((message) => describeHit(entry.name, message)),
      );
      expect(hits.join("\n"), `${rule.id} is violated`).toBe("");
    });
  }
});

/* ------------------------------------------------------------------ */
/* The reads                                                           */
/* ------------------------------------------------------------------ */

describe("the view reads the compensation domain and nothing beside it", () => {
  it("imports the domain hooks it renders from", () => {
    const source = view();
    expect(importsFrom(source, "useCompensations", "@/domains/compensation/useCompensations")).toBe(true);
    expect(importsFrom(source, "useSessions", "@/domains/scheduling/useScheduling")).toBe(true);
    // Today comes from the M7 day primitive, which reads the academy clock and
    // nothing else (`relationsNoFixtures` asserts that of the primitive itself);
    // what this gate pins is that the surface takes its day from there rather
    // than from the machine (the wall-clock patterns below are the negative half).
    expect(importsFrom(source, "academyIsoDate", "@/views/relations/academyDay")).toBe(true);
    expect(source).toContain("academyIsoDate()");
  });

  it("imports nothing from the fixture modules, in any import form", () => {
    for (const { name, source } of SURFACE) {
      const imports = importStatements(source);
      expect(imports.length, `${name} has no imports at all`).toBeGreaterThan(0);
      expect(
        imports.filter((statement) => statement.module.startsWith(FIXTURE_MODULE_PREFIX)).map((s) => s.module),
        `${name} imports a fixture module`,
      ).toEqual([]);
    }
  });

  it("names none of the fixture relations", () => {
    for (const { name, source } of SURFACE) {
      for (const identifier of FIXTURE_IDENTIFIERS) {
        expect(new RegExp(`\\b${identifier}\\b`).test(source), `${name} carries ${identifier}`).toBe(false);
      }
    }
  });

  it("states a page size on every bounded read, the ledger read included", () => {
    const source = view();
    for (const { hook, required, constant } of BOUNDED_READS) {
      const calls = callArguments(source, hook);
      expect(calls.length, `${hook} is called at least once`).toBeGreaterThan(0);
      for (const args of calls) {
        const flat = args.replace(/\s+/g, " ");
        for (const key of required) {
          expect(flat, `${hook}(…) must state ${key}`).toMatch(new RegExp(`\\b${key}\\s*:`));
        }
      }
      expect(source, `${constant} must exist`).toContain(`const ${constant} =`);
    }
  });

  it("bounds the cancelled-session read by the window it is showing", () => {
    const source = view();
    expect(source).toContain("CANDIDATE_DAYS_BACK");
    expect(source).toContain("CANDIDATE_DAYS_FORWARD");
    const args = callArguments(source, "useSessions").join(" ");
    expect(args).toMatch(/from:\s*candidateWindow\.from/);
    expect(args).toMatch(/to:\s*candidateWindow\.to/);
  });
});

/* ------------------------------------------------------------------ */
/* The write surface                                                   */
/* ------------------------------------------------------------------ */

describe("the write surface", () => {
  it("moves the EFFECTIVE session, and keeps the booked id as history", () => {
    const source = view();
    // The read model's effective id is the one the actions act on: the move is
    // armed from the effective session's own read, and the dialog that moves it is
    // handed that session — never the id the ledger line originally recorded.
    expect(source).toContain("currentAttempt.sessionId");
    expect(source).toContain("setMoving({ compensation: open, session: drawerEffective.session })");
    expect(source).toContain("session={moving.session}");
    expect(source).toContain("getSchedulingRepository().rescheduleSession(id, input)");
    // The booked id stays on screen (it is the history the operator needs) and the
    // rule above is what keeps it from becoming a target.
    expect(source, "the booked id is still displayed as history").toContain("bookedSessionId");
  });

  it("gates every write control on the permission and a principal", () => {
    const source = view();
    expect(importsFrom(source, "useCan", "@/domains/auth/AuthContext")).toBe(true);
    expect(source).toContain('useCan("schedule.write")');
    // Permission alone is not enough: a decision attributed to nobody is one the
    // ledger cannot answer for, so the controls are absent without a principal.
    expect(source).toMatch(/useCan\("schedule\.write"\)\s*&&\s*user\s*!==\s*null/);
    expect(source).toMatch(/canWrite\s*&&\s*actor/);
    for (const role of ROLES) {
      expect(source.includes(`"${role}"`), `the surface branches on the role name 「${role}」`).toBe(false);
    }
  });

  it("keeps the permission the surface is declared with", () => {
    // The surface reads the schedule's own permission and writes only with the
    // schedule-write permission; both are catalogue entries, not local strings.
    expect(PERMISSIONS).toContain(viewPermissions.compensation);
    expect(viewPermissions.compensation).toBe("schedule.read");
    expect(PERMISSIONS).toContain("schedule.write");
  });

  it("hands the dialogs no feedback of their own", () => {
    const dialogs = dialogSources();
    expect(dialogs.length, "the dialogs must be discovered").toBeGreaterThan(0);
    for (const source of dialogs) {
      // The caller owns every claim: a dialog reports through the callbacks it is
      // given, and reaches nothing that could write behind the caller's back.
      expect(source).toContain("onRejected");
      expect(source).toContain("onWritten");
      expect(/\bnotify\s*\(/.test(source), "a dialog announces by itself").toBe(false);
      expect(/\buseApp\s*\(/.test(source), "a dialog reads the app context to report").toBe(false);
      expect(/\bget[A-Z]\w*Repository\s*\(/.test(source), "a dialog holds a repository").toBe(false);
      expect(/tone\s*:/.test(source), "a dialog carries toast copy").toBe(false);
    }
  });

  it("does not gate the booking on the roster disclosure", () => {
    const source = view();
    // The disclosure is a DISPLAY helper: it words a fact about the effective
    // session's date and hides nor disables nothing (C-2). It must never be a
    // condition on a write.
    expect(source).toContain("function rosterDisclosure(");
    const start = source.indexOf("function rosterDisclosure(");
    const end = source.indexOf("\n}", start);
    const helper = source.slice(start, end);
    expect(helper).toMatch(/attempt\.studentOnRoster/);
    expect(/return\s+false/.test(helper), "the disclosure returns a gate").toBe(false);
    expect(/disabled/.test(helper), "the disclosure disables a control").toBe(false);
    for (const verb of COMPENSATION_VERBS) {
      const args = callArguments(source, verb).join(" ");
      expect(/studentOnRoster/.test(args), `${verb}(…) is told about the roster`).toBe(false);
    }
    for (const dialog of dialogSources()) {
      expect(/studentOnRoster/.test(dialog), "a dialog sees the disclosure").toBe(false);
    }
  });

  it("keeps a failed read visible instead of turning it into an empty state", () => {
    const source = view();
    // Counts (M-1): a count that is loading or failed renders the indeterminate
    // value and names itself, and the retry re-runs exactly those reads.
    expect(source).toMatch(/entry\.read\.error !== null\)\s*return\s+"خوانده نشد"/);
    expect(source).toContain("failedCounts");
    expect(source).toMatch(/read\.reload\(\)/);
    // The ledger (S-1): an empty ledger and a failed refresh are different facts.
    expect(source).toContain("ledger.error !== null");
    expect(source).toContain("ledger.reload()");
    expect(source).toContain("ledger.items.length === 0");
    // The effective session (S-3): a read failure is named, and the move is
    // withheld until the session has actually been read.
    expect(source).toContain("drawerEffective.error !== null");
    expect(source).toContain("drawerEffective.reload()");
    expect(source).toContain("disabled={!drawerEffective.session}");
    // …and nothing defaults a failed read away.
    expect(/\.items\s*\|\|\s*\[\]/.test(source), "a failed read is defaulted to an empty list").toBe(false);
  });

  it("keeps the probe for each rule anchored to a real file", () => {
    for (const rule of RULES) {
      expect(names(), `rule ${rule.id} probes a file the surface does not scan`).toContain(rule.probeFile);
    }
    expect(ruleById("unbounded-read").find("const rows = useSessions({ per_page: 200 });", VIEW)).not.toEqual([]);
    expect(ruleById("effective-session-target").find("rescheduleSession(row.bookedSessionId, input);", VIEW)).not.toEqual([]);
    expect(
      ruleById("roster-disclosure-not-a-gate").find(
        "const gate = row.currentAttempt.studentOnRoster !== false;",
        VIEW,
      ),
    ).not.toEqual([]);
  });
});
