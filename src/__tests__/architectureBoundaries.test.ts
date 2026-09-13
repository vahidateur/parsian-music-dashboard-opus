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

describe("list hooks request an explicit page size", () => {
  /**
   * A detail route resolves its id against the loaded list, so a hook that
   * relies on the repository's default page size silently truncates the
   * dataset and turns real records into "not found". Until the detail routes
   * fetch by id, every call site must state its own ceiling.
   */
  it("no domain list hook is called with no arguments", () => {
    const hooks = [
      "useStudentList",
      "useTeachers",
      "useRooms",
      "useClasses",
      "useEnrollments",
      // `useSessions` and `useAttendanceRecords` additionally require `per_page`
      // at the TYPE level (`Paged<…>` in their own signatures), pinned by the two
      // cases below — so this empty-argument check is a second line of defence
      // rather than the only one, and a call like `useSessions({ from, to })`
      // fails to compile instead of silently reading 25 sessions.
      "useSessions",
      "useAttendanceRecords",
      "useAttendanceCorrections",
    ];
    const offenders: string[] = [];
    for (const file of [...viewLayer, ...sourceFiles(join(ROOT, "domains"))]) {
      const source = code(readFileSync(file, "utf8"));
      for (const hook of hooks) {
        // `useX()` with an empty argument list, i.e. no params object.
        if (new RegExp(`\\b${hook}\\s*\\(\\s*\\)`).test(source)) offenders.push(`${file} → ${hook}()`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The hooks whose params are `Paged<…>`, so the compiler rejects a call site
   * that omits the page size. Recorded here because a signature is easy to relax
   * in a hurry — widening a parameter type never breaks the callers that already
   * pass it, so nothing else would complain.
   */
  const PAGED_HOOKS = [
    {
      hook: "useSessions",
      file: join("domains", "scheduling", "useScheduling.ts"),
      params: "Paged<SessionListParams>",
    },
    {
      hook: "useAttendanceRecords",
      file: join("domains", "attendance", "useAttendance.ts"),
      params: "Paged<AttendanceListParams>",
    },
    {
      hook: "useLibraryList",
      file: join("domains", "library", "useLibrary.ts"),
      params: "Paged<LibraryListParams>",
    },
  ];

  it("the page-size guarantee exists at the type level, not only in a comment", () => {
    // Reported as a list rather than one assertion per hook, so a signature relaxed
    // in two places names both instead of stopping at the first.
    const offenders: string[] = [];
    for (const { hook, file, params } of PAGED_HOOKS) {
      const source = code(readFileSync(join(ROOT, file), "utf8"));
      const escaped = params.replace(/[<>]/g, (char) => `\\${char}`);
      // A multi-line parameter list may carry a trailing comma.
      const signature = new RegExp(`${hook}\\s*\\(\\s*params:\\s*${escaped}\\s*,?\\s*\\)`);
      if (!signature.test(source)) offenders.push(`${file} → ${hook} must take ${params}`);
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Every list hook whose page size is a caller decision — including the ones the
   * compiler cannot help with, because their params type leaves `per_page`
   * optional (`useAttendanceCorrections`) or because the call passes a variable.
   *
   * `useClasses`, `useRooms` and `useTeachers` are here for the first reason:
   * their params types extend `ListParams`, so omitting `per_page` compiles and
   * silently falls back to the API default of 25. A calendar that reads its rooms
   * or teachers without a stated ceiling renders a quarter of the academy and
   * looks complete — which is what the scheduling view did before M4/CP1 wired it.
   */
  const PAGE_SIZE_CALLERS = [
    "useSessions",
    "useAttendanceRecords",
    "useAttendanceCorrections",
    "useLibraryList",
    "useClasses",
    "useRooms",
    "useTeachers",
  ];

  /**
   * The first argument of each `name(…)` call, with nested parens balanced.
   * A definition (`function useSessions(params: …)`) yields a parameter list
   * rather than an object literal, which the caller below skips.
   */
  function firstArguments(source: string, name: string): string[] {
    const out: string[] = [];
    const pattern = new RegExp(`\\b${name}\\s*\\(`, "g");
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
      let depth = 1;
      let index = match.index + match[0].length;
      const start = index;
      while (index < source.length && depth > 0) {
        if (source[index] === "(") depth += 1;
        else if (source[index] === ")") depth -= 1;
        index += 1;
      }
      out.push(source.slice(start, index - 1));
    }
    return out;
  }

  it("no list hook is called with a params object that omits `per_page`", () => {
    const offenders: string[] = [];
    for (const file of [...viewLayer, ...sourceFiles(join(ROOT, "domains"))]) {
      const source = code(readFileSync(file, "utf8"));
      for (const hook of PAGE_SIZE_CALLERS) {
        for (const args of firstArguments(source, hook)) {
          const trimmed = args.trim();
          // Only an inline object literal can be judged here; a variable is the
          // type system's job (see the case above).
          if (!trimmed.startsWith("{")) continue;
          if (!/\bper_page\s*:/.test(trimmed)) {
            offenders.push(`${file} → ${hook}({ … }) without per_page`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Instruments are runtime data (see domains/instruments/catalog.ts).
   *
   * Reintroducing a closed union or a hardcoded instrument list would silently
   * re-break academies that define their own instruments, and the compiler
   * cannot catch it because the union would type-check fine on its own.
   */
  it("no module redefines instruments as a fixed set", () => {
    const offenders: string[] = [];
    const allSource = [...viewLayer, ...sourceFiles(join(ROOT, "domains")), ...sourceFiles(join(ROOT, "data"))];

    for (const file of allSource) {
      // The catalogue is the one place allowed to enumerate the seeded set.
      if (file.includes(join("domains", "instruments", "catalog.ts"))) continue;
      const source = code(readFileSync(file, "utf8"));

      // The deleted union and its label map must not come back.
      if (/\binstrumentLabel\b/.test(source)) offenders.push(`${file} → instrumentLabel`);
      if (/type\s+Instrument\s*=/.test(source)) offenders.push(`${file} → type Instrument = …`);
      if (/Record<\s*Instrument\s*,/.test(source)) offenders.push(`${file} → Record<Instrument, …>`);

      // An inline list of instrument slugs is the same mistake by another name.
      if (/["'`]piano["'`]\s*,\s*["'`]guitar["'`]/.test(source)) {
        offenders.push(`${file} → hardcoded instrument list`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * §38 — no fixture constant may be presented as a real measurement.
   *
   * `student.skills` is seed data. It was previously rendered under the
   * caption "ارزیابی مدرس" (teacher assessment), which is a false claim about
   * where the number came from. Real progress is derived from the immutable
   * ProgressEvent log and lives in the progress domain.
   */
  it("no view renders the fixture skills array as a progress metric", () => {
    const offenders: string[] = [];
    for (const file of viewLayer) {
      const source = code(readFileSync(file, "utf8"));
      if (/\.skills\b/.test(source)) offenders.push(`${file} → renders student.skills`);
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Scheduling must not reach into attendance storage.
   *
   * An earlier iteration read the legacy `attendance` roster fixture to decide
   * whether a session was protected. That coupled a domain to data it does not
   * own AND could never actually match: legacy rosters key off `g*` ids while
   * real sessions are `ses_*`, so the guard looked present but never fired.
   *
   * The only permitted channel is the injected `AttendancePresenceProvider`.
   */
  it("the scheduling domain never reads attendance storage", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, "domains", "scheduling"))) {
      const source = code(readFileSync(file, "utf8"));
      if (/snapshot\(\)\s*\.\s*attendance/.test(source)) {
        offenders.push(`${file} → reads snapshot().attendance`);
      }
      if (/\bstore\s*\.\s*attendance\b/.test(source)) {
        offenders.push(`${file} → reads store.attendance`);
      }
      if (/\b(todayAttendance|AttendanceRoster|attendanceLabel|AttendanceMark)\b/.test(source)) {
        offenders.push(`${file} → imports a legacy attendance fixture symbol`);
      }
      // Nor the attendance DOMAIN. Scheduling consumes only the narrow
      // `AttendancePresenceProvider` boundary, injected by the registry, so
      // the dependency stays one-directional and free of cycles.
      if (/from\s+"@\/domains\/attendance/.test(readFileSync(file, "utf8"))) {
        offenders.push(`${file} → imports the attendance domain directly`);
      }
      if (/\bstore\s*\.\s*attendanceRecords\b/.test(source)) {
        offenders.push(`${file} → reads attendanceRecords directly`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
