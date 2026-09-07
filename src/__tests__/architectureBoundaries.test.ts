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
      // Scheduling and attendance list hooks additionally require `per_page`
      // at the type level (see `Paged`), so this is a second line of defence.
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
