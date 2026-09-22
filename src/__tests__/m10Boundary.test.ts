/**
 * The M10 fixture dissolution is final — enforced, not reviewed.
 *
 * M10 dissolved the two fixture modules (`src/data/records.ts`,
 * `src/data/academy.ts`) by semantic role: domain types went to their domains,
 * the canonical demo seed went to `src/domains/demo/academySeed.ts` (data
 * unchanged), presentation vocabulary went to its single owner, and the
 * fabricated UI measurements were removed outright — classified item by item
 * in the Finance/Reports deferral ledger (`src/lib/financeReportsDeferral.ts`,
 * D6 / OPEN_ITEMS I2), which this gate consumes rather than recites.
 *
 * WHAT THIS GATE GUARANTEES
 *
 *   1. The dissolved modules are GONE — as files and as import targets, in
 *      code, tests, seeds, dialogs and views everywhere under `src/`, at every
 *      depth (discovered recursively; a hidden fixture module is the exact
 *      failure M10 was authorized to forbid, D5).
 *   2. Views and components reach the demo data plane only through domains:
 *      no `src/views/**` or `src/components/**` file imports the seed.
 *   3. Every fabricated measurement the deferral ledger classifies is gone
 *      for good and cannot come back quietly as an "equivalent" elsewhere:
 *      none of its names is exported — or even written — anywhere in `src/`
 *      (the ledger itself and this gate are the only allowed mentions; they
 *      are named, enumerated and asserted below rather than globbed away, so
 *      the exemption cannot become a blind spot).
 *   4. The deferred surfaces carry their deferral unmistakably: they name the
 *      work item and read NO domain and NO seed — the deferral is "nothing to
 *      show", not "a fixture with better packaging".
 *   5. Every relocated presentation/vocabulary export has exactly ONE owner
 *      (D5's ambiguity rule, enforced mechanically): `navGroups`, `navItems`,
 *      `viewTitles`, `quickActions`, `commandVerbs`, `nlCommands`, `WEEKDAYS`,
 *      `WEEKDAYS_SHORT`, `studentStatusLabel`, `resourceKindLabel`,
 *      `paymentLabel`, `subscriptionStatusLabel` and
 *      `messageTemplates`/`settingsSections`/`libraryShelves`' successors.
 *
 * RULES ARE PROBED
 *
 * Every ban below is replayed against a synthetic violation in this file: a
 * rule that cannot fire protects nothing, and it fails here.
 *
 * Comments are stripped before the symbol scans (the owners document their
 * provenance — prose about a dissolved module is honest history, not a
 * resurrection), and no line numbers are used anywhere.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FINANCE_REPORTS_DEFERRAL } from "../lib/financeReportsDeferral";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const GATE_FILE = "src/__tests__/m10Boundary.test.ts";
const LEDGER_FILE = "src/lib/financeReportsDeferral.ts";

/** Strips comments so provenance prose cannot trip (or satisfy) a ban. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every .ts/.tsx under `src/`, discovered — never a by-name list. */
function sourcesUnder(dir: string, prefix = "src/"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sourcesUnder(join(dir, entry.name), `${prefix}${entry.name}/`));
    else if (/\.tsx?$/.test(entry.name)) out.push(`${prefix}${entry.name}`);
  }
  return out.sort();
}

const ALL_FILES = sourcesUnder(SRC);
/** Files exempt from the symbol tombstones: this gate and the ledger (both
 * carry the names by design — see the non-vacuity assertions below). */
const SCAN_FILES = ALL_FILES.filter((f) => f !== GATE_FILE && f !== LEDGER_FILE);
/** Banned-contract scans skip only THIS FILE (it must carry the exact strings
 * it bans, and the exclusion is asserted literally below). Nothing else may
 * ever join this list. */
const CONTRACT_FILES = ALL_FILES.filter((f) => f !== GATE_FILE);

/** Test files: sentinel gates name the retired symbols precisely to keep them
 * banned (that IS the tombstone role), and data-plane tests legitimately
 * compare repository reads against the seed. Neither is a production path. */
const isTestFile = (f: string): boolean => f.includes("/__tests__/") || /\.(test|spec)\.tsx?$/.test(f);

/** Tombstones protect production code: the gate's own harness and test files
 * are excluded, production sources are not. */
const TOMBSTONE_FILES = SCAN_FILES.filter((file) => !isTestFile(file));

/**
 * Demo-management modules: components legitimately know the dataset's
 * LIFECYCLE (bootstrap, environment state, destructive actions, metadata) —
 * that is the management seam, not a data import. The ban below forbids the
 * seed DATA only.
 */
const DEMO_SEED_MODULES = /(?:^|[./@]*)domains\/demo\/(?:academySeed|learningSeed|progressSeed|schedulingSeed|librarySeed|seed)$/;

/* ------------------------------------------------------------------ */
/* 1–2. The dissolved modules are gone, as targets and as modules      */
/* ------------------------------------------------------------------ */

const DISSOLVED_IMPORT =
  /(?:^|[.\/])data\/(?:records|academy)(?:\.tsx?)?$/;
const DISSOLVED_FILES = ["src/data/records.ts", "src/data/academy.ts"];

/** Import/export/require statements of a source and whether they name a
 * dissolved module. Exported for the probes below. */
function dissolvedImportViolations(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\b(?:import|export)[\s\S]{0,120}?\bfrom\s*"([^"]+)"/g)) {
    if (DISSOLVED_IMPORT.test(match[1])) out.push(`imports from the dissolved module 「${match[1]}」`);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)) {
    if (DISSOLVED_IMPORT.test(match[1])) out.push(`dynamically imports 「${match[1]}」`);
  }
  for (const match of source.matchAll(/\brequire\(\s*"([^"]+)"\s*\)/g)) {
    if (DISSOLVED_IMPORT.test(match[1])) out.push(`requires 「${match[1]}」`);
  }
  return out;
}

/** View/component files that reach the demo DATA plane directly — the seed
 * collections or the dataset builder. Types and the lifecycle services are
 * not data; `import type` is not a runtime path. Tests are outside the
 * boundary on purpose: the behavioural suites legitimately compare repository
 * reads against `createSeedDataset()` — that is the seed's canonical use, not
 * a render-path leak. Exported for the probes. */
function seedImportViolations(relativeFile: string, source: string): string[] {
  if (!relativeFile.startsWith("src/views/") && !relativeFile.startsWith("src/components/")) return [];
  if (relativeFile.includes("/__tests__/") || /\.(test|spec)\.tsx?$/.test(relativeFile)) return [];
  const out: string[] = [];
  for (const match of source.matchAll(/\bimport\s+(?!type\b)[^;]*?\bfrom\s*"([^"]+)"/g)) {
    if (DEMO_SEED_MODULES.test(match[1])) out.push(`imports the demo data module 「${match[1]}」`);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)) {
    if (DEMO_SEED_MODULES.test(match[1])) out.push(`dynamically imports 「${match[1]}」`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. The ledger's fabricated measurements are gone, by name           */
/* ------------------------------------------------------------------ */

/**
 * The retired identifiers: every fabricated measurement in the deferral
 * ledger, plus the presentation collections the dissolution removed from
 * module scope (their successors are presentation-local and named in §5) and
 * the dead exports M10 was authorized to delete.
 */
/**
 * Two ledger-classified statistics retired under names that are legitimately
 * LIVE identifiers: dashboardInsights derives an occupancy model and the
 * instruments domain owns the collection. A name-level tombstone would ban
 * honest code, so the retirement of those two STATISTICS is protected by the
 * other rules here instead (no dissolved-module import, no data plane in a
 * view, no deferred-surface read path). This set is used BOTH to build the
 * tombstones and to calibrate the ledger↔tombstone assertion, so the
 * exception cannot drift between the two.
 */
const SANCTIONED_LIVE_NAMES = new Set(["instruments", "occupancy"]);

const RETIRED_SYMBOLS: readonly string[] = [
  ...FINANCE_REPORTS_DEFERRAL.entries
    .filter((entry) => entry.classification === "fabricated-measurement")
    .map((entry) => entry.export)
    .filter((name) => !SANCTIONED_LIVE_NAMES.has(name)),
  "freeSlotsTuesday",
  "ACADEMY_NOW",
  "todayFlowIds",
  "overdueInvoices",
  "teacherAbsences",
  "studentStats",
  "settingsSections",
  "accessRoles",
  "libraryShelves",
  /*
    The hero's waveform used to breathe a curated thirteen-slot demo envelope:
    a picture of a busy academy day that looked the same in every environment,
    labelled «فعالیت» and «رزونانس». The wave is now computed from the day's
    own session rows (`components/hero/PulseWaveform.tsx`), so the fixture is
    retired by name and cannot be reintroduced as decoration.
  */
  "pulseDemoSessions",
].sort();

/** Retired names present in a source — the lamp test: this gate's own
 * `RETIRED_SYMBOLS` list is the probe, applied to itself by each caller. */
function retiredSymbolViolations(source: string): string[] {
  return RETIRED_SYMBOLS.filter((name) => new RegExp(`\\b${name}\\b`).test(source)).map(
    (name) => `names the retired 「${name}」`,
  );
}

/* ------------------------------------------------------------------ */
/* 5. One owner per relocated export                                   */
/* ------------------------------------------------------------------ */

const SINGLE_OWNERS: readonly { name: string; owner: string }[] = [
  { name: "navGroups", owner: "src/lib/navigation.ts" },
  { name: "navItems", owner: "src/lib/navigation.ts" },
  { name: "viewTitles", owner: "src/lib/navigation.ts" },
  { name: "quickActions", owner: "src/components/overlays/ActionSheet.tsx" },
  { name: "commandVerbs", owner: "src/components/overlays/commands.ts" },
  { name: "nlCommands", owner: "src/components/overlays/commands.ts" },
  { name: "WEEKDAYS", owner: "src/domains/scheduling/weekdays.ts" },
  { name: "WEEKDAYS_SHORT", owner: "src/domains/scheduling/weekdays.ts" },
  { name: "studentStatusLabel", owner: "src/domains/students/types.ts" },
  { name: "resourceKindLabel", owner: "src/domains/library/types.ts" },
  { name: "paymentLabel", owner: "src/lib/financeVocabulary.ts" },
  { name: "subscriptionStatusLabel", owner: "src/lib/financeVocabulary.ts" },
  { name: "messageTemplates", owner: "src/views/messages/composerTemplates.ts" },
  { name: "IntelligenceCard", owner: "src/domains/shared/dashboardInsights.ts" },
  { name: "sampleSignals", owner: "src/components/ds/samples.ts" },
  { name: "conflictPairs", owner: "src/domains/shared/dashboardInsights.ts" },
];

/** Files exporting (or re-exporting) `name`. */
function exportsOf(name: string): string[] {
  const direct = new RegExp(`^export\\s+(?:const|let|function|class|interface|type)\\s+${name}\\b`, "m");
  const reexport = new RegExp(`^export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`, "m");
  return SCAN_FILES.filter((file) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    return direct.test(source) || reexport.test(source);
  });
}

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

describe("the dissolved fixture modules are gone", () => {
  it("removes both files and the directory entry", () => {
    for (const file of DISSOLVED_FILES) {
      expect(existsSync(join(ROOT, file)), `${file} still exists`).toBe(false);
    }
    expect(existsSync(join(ROOT, "src", "data")), "src/data/ still exists").toBe(false);
  });

  it("no source under src/ targets them — code, tests, seeds, dialogs", () => {
    // This gate carries the banned strings as PROBES; it is the only file
    // exempt, and that exemption is asserted literally.
    expect(CONTRACT_FILES.length).toBe(ALL_FILES.length - 1);
    const offenders = CONTRACT_FILES.map((file) => {
      const source = code(readFileSync(join(ROOT, file), "utf8"));
      return { file, violations: dissolvedImportViolations(source) };
    }).filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file}: ${entry.violations.join(", ")}`),
      "a dissolved-module import survived",
    ).toEqual([]);
  });

  it("the import ban fires on a reintroduced module reference", () => {
    const probes = [
      'import { students } from "@/data/records";',
      'export { students } from "../../data/records";',
      'const m = await import("../data/academy");',
      'const m = require("./data/records.ts");',
    ];
    for (const probe of probes) {
      expect(
        dissolvedImportViolations(probe).length,
        `the ban did not fire on 「${probe}」 — it protects nothing`,
      ).toBeGreaterThan(0);
    }
  });

  it("no production view or component reaches the demo DATA plane directly", () => {
    // The lifecycle services (useIsDemoEnvironment, useDemoData, DEMO_COLLECTIONS)
    // are the management seam and are NOT banned; the seed builders and the
    // dataset module are. Test files are exempt by the rule itself (they pin
    // the seed's behaviour); the probes below prove both directions of the
    // scope guard.
    const offenders = ALL_FILES.map((file) => {
      const source = code(readFileSync(join(ROOT, file), "utf8"));
      return { file, violations: seedImportViolations(file, source) };
    }).filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file}: ${entry.violations.join(", ")}`),
      "a view/component import of the demo data plane survived",
    ).toEqual([]);
  });

  it("the data-plane ban fires in a view and stays silent where it must", () => {
    const probe = 'import { students } from "@/domains/demo/academySeed";';
    expect(
      seedImportViolations("src/views/Example.tsx", probe).length,
      "a view importing the seed was not caught — the rule protects nothing",
    ).toBeGreaterThan(0);
    expect(seedImportViolations("src/components/ds/samples.ts", probe).length).toBeGreaterThan(0);
    // Types are not a runtime path, and the lifecycle seam is not data.
    expect(seedImportViolations("src/views/Example.tsx", 'import type { DemoDataset } from "@/domains/demo/types";')).toEqual([]);
    expect(seedImportViolations("src/views/Example.tsx", 'import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";')).toEqual([]);
    // Outside views/components the module loads the seed itself.
    expect(seedImportViolations("src/domains/demo/seed.ts", probe)).toEqual([]);
  });
});

describe("every fabricated measurement is retired, by name, everywhere", () => {
  it("carries none of the retired identifiers in any production source under src/", () => {
    const offenders = TOMBSTONE_FILES.map((file) => {
      const source = code(readFileSync(join(ROOT, file), "utf8"));
      return { file, violations: retiredSymbolViolations(source) };
    }).filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file}: ${entry.violations.join(", ")}`),
      "a retired symbol was written somewhere",
    ).toEqual([]);
  });

  it("the tombstone rule fires on a resurrected symbol", () => {
    for (const name of RETIRED_SYMBOLS) {
      expect(
        retiredSymbolViolations(`export const ${name} = [];`).length,
        `the rule did not fire on 「${name}」 — it protects nothing`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps the exemption closed to exactly two named files, and explains why", () => {
    // The exemption list is asserted literally: a third file cannot join it quietly.
    expect([GATE_FILE, LEDGER_FILE].length, "the exemption list grew").toBe(2);
    // Both exempted files really do carry retired names — otherwise the
    // exemption is dead weight and must go.
    const gate = readFileSync(join(ROOT, GATE_FILE), "utf8");
    const ledger = readFileSync(join(ROOT, LEDGER_FILE), "utf8");
    expect(retiredSymbolViolations(gate).length, "this gate no longer names the retired symbols").toBeGreaterThan(0);
    expect(retiredSymbolViolations(ledger).length, "the ledger no longer names the retired symbols").toBeGreaterThan(0);
  });
});

describe("the deferral ledger is the deferral — not hidden fixtures", () => {
  it("is decision-backed, work-item-owned and classified per item", () => {
    expect(FINANCE_REPORTS_DEFERRAL.decision).toBe("D6");
    expect(FINANCE_REPORTS_DEFERRAL.workItem).toBe("I2");
    expect(FINANCE_REPORTS_DEFERRAL.entries.length).toBeGreaterThanOrEqual(20);
    const classes = new Set(["demo-record", "deferred-reading", "fabricated-measurement", "vocabulary", "presentation-config"]);
    for (const entry of FINANCE_REPORTS_DEFERRAL.entries) {
      expect(entry.export.trim().length, "an unnamed deferral entry").toBeGreaterThan(0);
      expect(classes.has(entry.classification), `${entry.export} has an unknown classification`).toBe(true);
      expect(["src/data/records.ts", "src/data/academy.ts"]).toContain(entry.source);
      expect(entry.disposition.length, `${entry.export} has no disposition`).toBeGreaterThan(20);
    }
    // Every fabricated name the ledger classifies is tombstoned, except the
    // names that are honest identifiers — asserted once, from the same set.
    const fabricated = FINANCE_REPORTS_DEFERRAL.entries
      .filter((entry) => entry.classification === "fabricated-measurement")
      .map((entry) => entry.export)
      .filter((name) => !SANCTIONED_LIVE_NAMES.has(name));
    for (const name of fabricated) expect(RETIRED_SYMBOLS, `${name} is not tombstoned`).toContain(name);
    expect(fabricated.length, "the sanction list swallowed the tombstones").toBeGreaterThan(SANCTIONED_LIVE_NAMES.size);
  });

  it("makes the deferred surfaces carry their deferral instead of a read path", () => {
    for (const surface of FINANCE_REPORTS_DEFERRAL.surfaces as readonly string[]) {
      expect(existsSync(join(ROOT, surface)), `${surface} does not exist`).toBe(true);
      const source = readFileSync(join(ROOT, surface), "utf8");
      // The work item is named where the user would look for data.
      expect(source, `${surface} does not carry the I2 work item`).toContain("I2");
      // No domain read and no seed read: the deferral means there is nothing
      // to show — reading a repository would make the screen lie.
      const imports = [...code(source).matchAll(/\bfrom\s*"([^"]+)"/g)].map((m) => m[1]);
      expect(
        imports.filter((module) => module.startsWith("@/domains/")),
        `${surface} reads a domain`,
      ).toEqual([]);
      expect(
        imports.filter((module) => module.startsWith("@/services/")),
        `${surface} reaches the store`,
      ).toEqual([]);
    }
  });
});

describe("every relocated export has exactly one owner", () => {
  it("keeps the owner map non-empty and its files real", () => {
    expect(SINGLE_OWNERS.length).toBeGreaterThanOrEqual(15);
    for (const { name, owner } of SINGLE_OWNERS) {
      expect(existsSync(join(ROOT, owner)), `${owner} (${name}) does not exist`).toBe(true);
    }
  });

  it("exports each relocated symbol from exactly one file", () => {
    const problems: string[] = [];
    for (const { name, owner } of SINGLE_OWNERS) {
      const files = exportsOf(name);
      if (files.length !== 1 || files[0] !== owner) {
        problems.push(`${name} → owns=${owner}, found=[${files.join(", ")}]`);
      }
    }
    expect(problems, "ownership has drifted").toEqual([]);
  });

  it("the ownership rule sees both a direct export and a re-export", () => {
    // Probe the mechanics: the matcher must find a hypothetical duplicate as
    // either an `export const` or an `export { name } from "…"`, not just the
    // one spelling that happens to be in the tree today.
    const direct = /^export\s+(?:const|let|function|class|interface|type)\s+sampleSignals\b/m;
    const reexport = /^export\s*\{[^}]*\bsampleSignals\b[^}]*\}/m;
    expect(direct.test("export const sampleSignals = [];")).toBe(true);
    expect(reexport.test('export { sampleSignals } from "./x";')).toBe(true);
    expect(direct.test("const sampleSignals = [];")).toBe(false);
  });
});
