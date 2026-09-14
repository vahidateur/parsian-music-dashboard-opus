/**
 * The attendance view reads its domain — a structural gate (M5).
 *
 * WHY A SOURCE GATE AND NOT ONLY BEHAVIOUR
 *
 * `attendanceWrites.test.tsx` proves the view writes through the repository and
 * says only what happened. It cannot prove a negative: that no fabricated rate,
 * no fixture import and no retired sentence is sitting in the file waiting for a
 * tab nobody clicked in that suite. This gate reads the source the way
 * `architectureBoundaries.test.ts` and `writeFeedbackHonesty.test.ts` do, so a
 * future edit that puts one back fails CI instead of landing quietly.
 *
 * WHAT IT PINS
 *
 *   - the view reaches `@/domains/attendance` and nothing in `@/data/records`;
 *   - every list read states a page size, and the window comes from the academy
 *     clock rather than an inline `new Date()` or a hardcoded ISO date;
 *   - no percentage, no delta and none of the five fabricated figures the fixture
 *     register carried (92, 89, 96, 93, 84);
 *   - the three write verbs the repository actually has, and none it does not;
 *   - provenance from the authenticated principal, writes gated on the RBAC
 *     permission and on a principal existing at all;
 *   - the identity guard that keeps a register from being written through when it
 *     answers for a session other than the one selected (I13, mitigated in the
 *     view, OPEN upstream);
 *   - and the same sweep over `src/views/attendance/`, the panels beside the view,
 *     so a fabrication cannot move one directory down and survive.
 *
 * HOW IT READS
 *
 * Comments are stripped before every check, so prose ABOUT a rule can neither
 * satisfy it nor trip it — this file's own header names the fabricated figures it
 * forbids, and the view's header explains what it removed. Line numbers are used
 * nowhere: they drift, and a gate that breaks on an unrelated edit gets deleted.
 *
 * Import assertions parse import STATEMENTS rather than matching a substring, so
 * three hooks sharing one `import { a, b, c } from "…"` are seen as what they are.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const VIEW = join(SRC, "views", "Attendance.tsx");
const PANEL_DIR = join(SRC, "views", "attendance");

const rel = (file: string) => relative(SRC, file).split("\\").join("/");

/** Strips block and line comments, so only code is ever judged. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const view = () => code(readFileSync(VIEW, "utf8"));

/** Every file beside the view: the register panel and the correction dialog. */
function panelFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(PANEL_DIR)) {
    const full = join(PANEL_DIR, entry);
    if (statSync(full).isDirectory()) continue;
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const panels = () => panelFiles().map((file) => code(readFileSync(file, "utf8")));

/**
 * The import statements of a source file, as `{ names, module }`.
 *
 * Parsed rather than substring-matched: `toContain("import { useSessionAttendance")`
 * passes or fails on how many hooks happen to share a line, which is formatting
 * and not meaning.
 */
function imports(source: string): { names: string[]; module: string }[] {
  const found: { names: string[]; module: string }[] = [];
  const pattern = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    found.push({
      names: match[1]
        .split(",")
        .map((name) => name.replace(/^\s*type\s+/, "").trim())
        .filter((name) => name.length > 0),
      module: match[2],
    });
  }
  return found;
}

/** True when one import statement pulls `name` from `module`. */
function importsFrom(source: string, name: string, module: string): boolean {
  return imports(source).some((statement) => statement.module === module && statement.names.includes(name));
}

/** The five figures the fixture register asserted, and the shapes that carry them. */
const FABRICATED_FIGURES = ["92", "89", "96", "93", "84"];

/** Copy that described an analysis this view has no data for. */
const RETIRED_NARRATIVES = [
  "نرخ حضور امروز",
  "نبض انضباط",
  "میانگین ماه",
  "بیشترین غیبت",
  "روند حضور",
  "حضور بر حسب روز",
  "الگوی غیبت",
  "آخرین حضور",
  "حضور کلی",
  "ثبت نهایی",
];

/** Fixture symbols from `src/data/records.ts` this view used to render. */
const FIXTURE_SYMBOLS = [
  "todayAttendance",
  "attendanceTrend",
  "attendanceByDay",
  "AttendanceRoster",
  "AttendanceMark",
  "attendanceLabel",
  "classById",
  "teacherById",
];

/** Session ids of the fixture registers, which match no session any domain made. */
const FIXTURE_SESSION_IDS = ["g7", "g8", "g9", "g10", "g11", "g12", "g13", "g14", "g15"];

/** Verbs `AttendanceRepository` does not have, so no control may claim one. */
const FORBIDDEN_VERBS = [".update(", ".delete(", ".remove(", ".save(", ".destroy(", ".bulkSave("];

describe("the view reads the attendance domain, not the fixtures", () => {
  it("pulls its register hooks from the attendance domain", () => {
    const source = view();
    for (const hook of ["useSessionAttendance", "useAttendanceRecords", "useAttendanceCorrections"]) {
      expect(
        importsFrom(source, hook, "@/domains/attendance/useAttendance"),
        `${hook} is not imported from the attendance domain`,
      ).toBe(true);
    }
  });

  it("reaches the attendance repository itself, for the writes", () => {
    // The same literal `writeFeedbackHonesty.test.ts` requires of a graduated view:
    // hooks are not enough, because a write goes through the repository.
    expect(view()).toContain("getAttendanceRepository(");
  });

  it("reads its session window from the scheduling domain", () => {
    expect(importsFrom(view(), "useSessions", "@/domains/scheduling/useScheduling")).toBe(true);
  });

  it("imports nothing from the fixture module", () => {
    const offenders = [VIEW, ...panelFiles()].filter((file) =>
      imports(code(readFileSync(file, "utf8"))).some((statement) => statement.module === "@/data/records"),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("names no fixture symbol anywhere in the view or its panels", () => {
    const sources = { [rel(VIEW)]: view(), ...Object.fromEntries(panelFiles().map((f) => [rel(f), code(readFileSync(f, "utf8"))])) };
    for (const [file, source] of Object.entries(sources)) {
      for (const symbol of FIXTURE_SYMBOLS) {
        expect(source.includes(symbol), `${file} still names «${symbol}»`).toBe(false);
      }
    }
  });

  it("renders none of the retired narratives", () => {
    const sources = [view(), ...panels()].join("\n");
    for (const narrative of RETIRED_NARRATIVES) {
      expect(sources.includes(narrative), `the view still says «${narrative}»`).toBe(false);
    }
  });
});

describe("every figure it shows is one the data supplied", () => {
  it("computes no percentage", () => {
    // A rate over one session is a sample of one, and a rate over a term needs a
    // read the domain does not expose. Neither may be rendered (E-1, I16).
    for (const source of [view(), ...panels()]) {
      expect(source).not.toContain("faPercent");
    }
  });

  it("carries none of the five fabricated figures", () => {
    for (const source of [view(), ...panels()]) {
      for (const figure of FABRICATED_FIGURES) {
        expect(new RegExp(`\\b${figure}\\b`).test(source), `the code still carries «${figure}»`).toBe(false);
      }
    }
  });

  it("reports no delta against a period it never read", () => {
    for (const source of [view(), ...panels()]) {
      expect(source).not.toMatch(/delta\s*:/);
    }
  });

  it("draws no trend, ring or meter over data it does not have", () => {
    for (const source of [view(), ...panels()]) {
      for (const component of ["ProgressRing", "Meter", "Sparkline"]) {
        expect(source.includes(component), `the view still renders «${component}»`).toBe(false);
      }
    }
  });
});

describe("time and pages come from the academy, not from the machine", () => {
  it("reads the current date from the academy clock", () => {
    expect(importsFrom(view(), "academyNow", "@/domains/shared/clock")).toBe(true);
    expect(view()).toContain("academyNow()");
  });

  it("constructs no date and reads no machine clock", () => {
    for (const source of [view(), ...panels()]) {
      expect(source).not.toContain("new Date(");
      expect(source).not.toContain("Date.now(");
    }
  });

  it("hardcodes no ISO date and no fixture session id", () => {
    for (const source of [view(), ...panels()]) {
      expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      for (const id of FIXTURE_SESSION_IDS) {
        expect(source.includes(`"${id}"`), `the code still names fixture session «${id}»`).toBe(false);
      }
    }
  });

  it("states a page size on every bounded read", () => {
    const source = view();
    // Each list read in the view, and the page size it must state. A read without
    // one falls back to the API default and silently truncates (the reason
    // `Paged<…>` exists, and what `architectureBoundaries.test.ts` enforces).
    const reads = [
      { hook: "useSessions", constant: "SESSIONS_PER_PAGE" },
      { hook: "useAttendanceRecords", constant: "RECORDS_PER_PAGE" },
      { hook: "useAttendanceCorrections", constant: "CORRECTIONS_PER_PAGE" },
      { hook: "useClasses", constant: "SUPPORT_PER_PAGE" },
      { hook: "useTeachers", constant: "SUPPORT_PER_PAGE" },
      { hook: "useStudentList", constant: "SUPPORT_PER_PAGE" },
    ];
    for (const { hook, constant } of reads) {
      const calls = source.match(new RegExp(`${hook}\\s*\\(\\s*\\{[^}]*\\}`, "g")) ?? [];
      expect(calls.length, `${hook} is called at least once`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call, `${hook} must state ${constant}`).toContain(constant);
      }
      expect(source, `${constant} is defined`).toContain(`const ${constant} =`);
    }
  });

  it("bounds the record reads by the window it is showing", () => {
    const source = view();
    // A record list with no bounds is every mark the academy has ever taken, and
    // its total would then describe a period the user is not looking at.
    expect(source).toContain("windowInstants(from, to)");
    expect(source).toMatch(/useAttendanceRecords\(\{\s*since,\s*until/);
    expect(source).toMatch(/useAttendanceRecords\(\{\s*status:\s*"absent",\s*since,\s*until/);
  });
});

describe("writes are the three verbs the repository has", () => {
  it("records, bulk-records and corrects", () => {
    const source = view();
    expect(source).toContain(".record({");
    expect(source).toContain(".bulkRecord({");
    expect(source).toContain(".correct(");
  });

  it("calls no verb the repository does not have", () => {
    for (const source of [view(), ...panels()]) {
      for (const verb of FORBIDDEN_VERBS) {
        expect(source.includes(verb), `the code calls «${verb}»`).toBe(false);
      }
    }
  });

  it("attributes every write to the authenticated principal", () => {
    const source = view();
    expect(importsFrom(source, "useAuth", "@/domains/auth/AuthContext")).toBe(true);
    expect(source).toMatch(/recordedByUserId:\s*recorderId/);
    expect(source).toMatch(/changedByUserId:\s*recorderId/);
    // The fixture stamped a hardcoded recorder name on its fake save. The name a
    // user reads may come from the session; the id a record carries may not.
    expect(source.includes("آرمان احمدی"), "the view hardcodes a recorder name").toBe(false);
    for (const panel of panels()) {
      expect(panel.includes("آرمان احمدی"), "a panel hardcodes a recorder name").toBe(false);
    }
  });

  it("gates the write controls on the RBAC permission", () => {
    const source = view();
    expect(importsFrom(source, "useCan", "@/domains/auth/AuthContext")).toBe(true);
    expect(source).toContain(`useCan("attendance.write")`);
    // Permission alone is not enough: a mark attributed to nobody is a mark the
    // audit trail cannot answer for.
    expect(source).toMatch(/canWrite\s*=\s*useCan\("attendance\.write"\)\s*&&\s*recorderId\s*!==\s*null/);
  });

  it("attempts no write without a principal or a permission", () => {
    const source = view();
    // Both write paths refuse before reaching the repository.
    const guards = source.match(/recorderId === null \|\| !canWrite/g) ?? [];
    expect(guards.length, "record and bulkRecord each guard the principal").toBeGreaterThanOrEqual(2);
  });

  it("hands the correction dialog no provenance of its own", () => {
    // The form's contract omits `changedByUserId`, so a dialog cannot type one:
    // provenance belongs to the caller that can read the session.
    const dialog = code(readFileSync(join(PANEL_DIR, "CorrectMarkDialog.tsx"), "utf8"));
    expect(dialog).toContain(`Omit<CorrectionInput, "changedByUserId">`);
    expect(dialog).not.toMatch(/changedByUserId\s*:/);
  });
});

describe("the register on screen belongs to the selected session", () => {
  it("compares the register's session with the one selected", () => {
    const source = view();
    expect(source).toMatch(/attendance\.sessionId === selectedSessionId/);
  });

  it("withholds a register that answers for another session", () => {
    const source = view();
    // The guard gates the render branch, and every write path checks it too: a
    // stale register must not be writable even for the frame it is on screen.
    expect(source).toContain("!registerMatches");
    const guarded = source.match(/!registerMatches \|\| attendance === undefined/g) ?? [];
    expect(guarded.length, "both write paths check the guard").toBeGreaterThanOrEqual(2);
  });

  it("keeps the upstream defect visible rather than claiming a fix", () => {
    // I13 3C is the hook's fix and was explicitly out of scope for M5. The view's
    // own source says so, so a reader cannot mistake the guard for the cure.
    const raw = readFileSync(VIEW, "utf8");
    expect(raw).toContain("I13");
    expect(raw.toLowerCase()).toContain("open");
  });

  it("selects a session from the window it read, never a default id", () => {
    const source = view();
    // The selected session is derived from the loaded list, so a window change
    // cannot leave a session open that the user can no longer see.
    expect(source).toMatch(/sessions\.items\.find\(\(session\) => session\.id === selectedId\) \?\? sessions\.items\[0\]/);
  });
});

describe("the panels beside the view hold the same line", () => {
  it("exist, and are the two the view mounts", () => {
    expect(panelFiles().map(rel).sort()).toEqual([
      "views/attendance/CorrectMarkDialog.tsx",
      "views/attendance/RegisterPanel.tsx",
    ]);
    const source = view();
    expect(importsFrom(source, "RegisterPanel", "./attendance/RegisterPanel")).toBe(true);
    expect(importsFrom(source, "CorrectMarkDialog", "./attendance/CorrectMarkDialog")).toBe(true);
  });

  it("announce nothing themselves: the caller owns every claim", () => {
    // A panel that called `notify` would be a second place a success could be
    // claimed, away from the write it describes. Neither does.
    for (const file of panelFiles()) {
      const source = code(readFileSync(file, "utf8"));
      expect(source.includes("notify("), `${rel(file)} announces its own result`).toBe(false);
      expect(source.includes(`tone: "success"`), `${rel(file)} reports a success`).toBe(false);
      expect(source.includes("useApp"), `${rel(file)} reaches the app context`).toBe(false);
    }
  });

  it("take no repository of their own", () => {
    // Writes go through the view, which holds the principal and the guard. A panel
    // that reached a repository could write around both.
    for (const file of panelFiles()) {
      const source = code(readFileSync(file, "utf8"));
      expect(source).not.toMatch(/\bget[A-Z]\w*Repository\s*\(/);
    }
  });

  it("withdraw a control whose operation cannot run, instead of disabling it", () => {
    const register = code(readFileSync(join(PANEL_DIR, "RegisterPanel.tsx"), "utf8"));
    // Read-only and locked registers render no mark control at all: both are
    // conditions on the JSX, not a `disabled` attribute on a button that stays.
    expect(register).toContain("canWrite &&");
    expect(register).not.toMatch(/disabled=\{!canWrite\}/);
    expect(register).not.toMatch(/disabled=\{locked\}/);
  });

  it("refuse an empty correction reason before any write", () => {
    const dialog = code(readFileSync(join(PANEL_DIR, "CorrectMarkDialog.tsx"), "utf8"));
    // Presence is the local check; the repository's own rule still decides, and its
    // field errors render on the same field.
    expect(dialog).toMatch(/reason\.trim\(\)\.length === 0/);
    expect(dialog).toContain("دلیل اصلاح الزامی است.");
  });

  it("show the four domain statuses and no fifth state of their own", () => {
    const register = code(readFileSync(join(PANEL_DIR, "RegisterPanel.tsx"), "utf8"));
    expect(register).toContain("ATTENDANCE_STATUSES");
    expect(register).toContain("ATTENDANCE_STATUS_LABEL");
    // "Unmarked" is the absence of a record, never a status value: the domain has
    // no null mark, and inventing one here would blur the distinction a disputed
    // absence turns on.
    expect(register).not.toMatch(/status:\s*(null|"unmarked")/);
  });
});
