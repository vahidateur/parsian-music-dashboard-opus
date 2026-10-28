/**
 * Architecture boundaries, enforced by the test suite rather than by review.
 *
 * The rule the whole data layer rests on is that a view knows nothing about
 * *where* data lives (§27). These checks read the source tree, so a future
 * change that reaches past the repository seam fails CI instead of quietly
 * landing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
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

  /**
   * W3 — the boundary is the store module, not the class name.
   *
   * Renaming `demoStore` to `localStore` must not open a path views can import.
   * The check reads the raw source (import specifiers survive; `code()` strips
   * string literals, which is why the case above cannot see a `from "..."` path)
   * and is non-vacuous: it fires on both module paths and does not fire on the
   * class name alone.
   */
  it("never import the local store module (interface boundary, not the class)", () => {
    const STORE_IMPORT = /services\/(?:demoStore|localStore)/;
    const offenders = viewLayer.filter((file) => STORE_IMPORT.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
    expect(STORE_IMPORT.test('import type { LocalDataStore } from "@/services/localStore";')).toBe(true);
    expect(STORE_IMPORT.test('import { demoStore } from "@/services/demoStore";')).toBe(true);
    expect(STORE_IMPORT.test("class DemoStoreImpl {}")).toBe(false);
    expect(STORE_IMPORT.test("class LocalStoreImpl {}")).toBe(false);
  });

  it("types the media reference check against the store interface, not the class", () => {
    const source = readFileSync(join(ROOT, "domains", "media", "mediaReferences.ts"), "utf8");
    expect(source).toContain("LocalDataStore");
    expect(source).toMatch(/mediaStillReferenced\(store:\s*LocalDataStore/);
    expect(source).not.toMatch(/\bDemoStoreImpl\b/);
    expect(source).not.toMatch(/import\s+(type\s+)?\{[^}]*\bDemoStore\b/);
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
    // M10 dissolved `src/data/`; its corpus lives under `domains/demo/` now,
    // which the `domains` walk already covers — the scan is unchanged.
    const allSource = [...viewLayer, ...sourceFiles(join(ROOT, "domains"))];

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

describe("F8 — Telegram/Bale adapters keep business logic out of bots", () => {
  it("chat provider adapter does not import business logic domains", () => {
    // Core business logic must remain independent of Telegram/Bale/external providers.
    // Adapter calls domain services, domain services enforce RBAC + scope — no business logic in bots.
    const providerFile = join(ROOT, "domains", "chat", "provider.ts");
    const source = code(readFileSync(providerFile, "utf8"));
    const forbidden = [
      "enrollment",
      "eligibility",
      "placement",
      "progress",
      "attendance",
      "compensation",
      "scheduling",
      "library",
      "gallery",
      "branding",
      "finance",
      "demoStore",
      "demo\\/store",
      "scope",
      "permissions",
      "canRead",
      "canWrite",
    ];
    const offenders: string[] = [];
    for (const term of forbidden) {
      if (new RegExp(`\\b${term}\\b`, "i").test(source)) {
        offenders.push(`provider.ts → contains business logic term ${term}`);
      }
    }
    // Also must not contain fetch, Telegram Bot API URL, Bale API URL, token
    // Use code-stripped source so comments mentioning VITE_* as documentation don't trigger
    if (/fetch\s*\(/.test(source)) offenders.push("provider.ts → fetch");
    if (/api\.telegram\.org/.test(source)) offenders.push("provider.ts → Telegram API URL");
    if (/bale\.ai|bale\.bot/.test(source)) offenders.push("provider.ts → Bale API URL");
    if (/BOT_TOKEN|TELEGRAM_TOKEN|BALE_TOKEN/.test(source)) offenders.push("provider.ts → token constant");
    if (/VITE_/.test(source)) offenders.push("provider.ts → VITE_ token");
    expect(offenders).toEqual([]);
  });

  it("backup envelope does not contain Telegram/Bale/external provider code", () => {
    const backupFile = join(ROOT, "domains", "demo", "backup.ts");
    const source = code(readFileSync(backupFile, "utf8"));
    const forbidden = ["telegram", "bale", "api.telegram", "fetch", "axios", "BOT_TOKEN", "VITE_", "sendDocument"];
    const offenders: string[] = [];
    for (const term of forbidden) {
      if (new RegExp(term, "i").test(source)) {
        offenders.push(`backup.ts → contains external provider term ${term}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no view contains Telegram/Bale token or hardcoded Bot API URL", () => {
    const offenders: string[] = [];
    for (const file of viewLayer) {
      const raw = readFileSync(file, "utf8");
      if (/api\.telegram\.org/.test(raw)) offenders.push(`${file} → Telegram API URL`);
      if (/bale\.ai|bale\.bot/.test(raw)) offenders.push(`${file} → Bale API URL`);
      if (/BOT_TOKEN|TELEGRAM_TOKEN|BALE_TOKEN/.test(raw)) offenders.push(`${file} → token`);
      if (/VITE_TELEGRAM|VITE_BALE/.test(raw)) offenders.push(`${file} → VITE_ token`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("F9 — Mobile client contract — same backend no second API bearer secure storage", () => {
  it("registry has single ApiClient instantiation — no second API", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    // The composition root was split (registry.ts = demo selection,
    // registryCore.ts = shared plumbing) — the invariant is still EXACTLY ONE
    // ApiClient instantiation across the composition files, so the scan
    // covers both halves.
    const source = code(
      readFileSync(registryPath, "utf8") + "\n" + readFileSync(join(dirname(registryPath), "registryCore.ts"), "utf8"),
    );
    const matches = source.match(/new\s+ApiClient/g) || [];
    expect(matches).toEqual(["new ApiClient"]);
  });

  it("no second baseUrl — single composition root — same backend contracts", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    const source = code(readFileSync(registryPath, "utf8"));
    // Only one getApiClient that creates client with baseUrl from runtime config — no second hardcoded URL
    expect(source).not.toMatch(/https?:\/\/.*\/api/);
    // No second ApiClient with different baseUrl
    const baseUrlOccurrences = (source.match(/baseUrl/g) || []).length;
    expect(baseUrlOccurrences).toBeLessThanOrEqual(3);
  });

  it("ApiClient envelope Collection/Item PageMeta — same for web and mobile", () => {
    const clientPath = join(ROOT, "api", "client.ts");
    const source = readFileSync(clientPath, "utf8");
    expect(source).toContain("CollectionEnvelope");
    expect(source).toContain("ItemEnvelope");
    expect(source).toContain("PageMeta");
    expect(source).toContain("Bearer");
    expect(source).toContain("Authorization");
  });

  it("auth bearer header — Authorization: Bearer — same for web and mobile", () => {
    const clientPath = join(ROOT, "api", "client.ts");
    const raw = readFileSync(clientPath, "utf8");
    // Use raw, not code(), because Bearer is inside template literal which code() strips
    expect(raw).toMatch(/Bearer/);
    expect(raw).toMatch(/Authorization/);
    expect(raw).toMatch(/getToken/);
  });

  it("no localStorage for binary — media abstraction same endpoint", () => {
    const allFiles = [...sourceFiles(join(ROOT, "domains", "media")), ...sourceFiles(join(ROOT, "api"))];
    const offenders: string[] = [];
    for (const file of allFiles) {
      const source = code(readFileSync(file, "utf8"));
      if (/localStorage\s*\.\s*setItem/.test(source) && /bytes|blob/i.test(source)) {
        offenders.push(`${file} → localStorage binary`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no offline queue — C deferred no fake", () => {
    const allFiles = sourceFiles(ROOT);
    const offenders: string[] = [];
    for (const file of allFiles) {
      const source = code(readFileSync(file, "utf8")).toLowerCase();
      if (source.includes("offlinequeue") || source.includes("syncqueue") || source.includes("backgroundsync")) {
        offenders.push(`${file} → offline queue`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no second ApiClient class — same backend contracts", () => {
    const apiFiles = sourceFiles(join(ROOT, "api"));
    const clientClasses: string[] = [];
    for (const file of apiFiles) {
      const source = code(readFileSync(file, "utf8"));
      const matches = source.match(/class\s+ApiClient/g) || [];
      if (matches.length > 0) clientClasses.push(`${file} → ${matches.length}`);
    }
    // Only one ApiClient class in src/api/client.ts
    expect(clientClasses.length).toBe(1);
    expect(clientClasses[0]).toContain("client.ts");
  });

  it("secure storage vs localStorage — no localStorage token — mobile uses secure storage", () => {
    // Appearance localStorage is allowed per D2, but token must not be in localStorage
    const allFiles = sourceFiles(ROOT);
    const offenders: string[] = [];
    for (const file of allFiles) {
      const source = code(readFileSync(file, "utf8"));
      if (/localStorage\s*\.\s*setItem\s*\(\s*[\"'].*token/i.test(source)) {
        offenders.push(`${file} → localStorage token`);
      }
      if (/localStorage\s*\.\s*setItem\s*\(\s*[\"']auth_token/i.test(source)) {
        offenders.push(`${file} → localStorage auth_token`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("media upload same endpoint — bytes ArrayBuffer not base64 data URL", () => {
    const mediaTypesPath = join(ROOT, "domains", "media", "types.ts");
    const source = readFileSync(mediaTypesPath, "utf8");
    expect(source).toContain("bytes: ArrayBuffer");
    expect(source).not.toMatch(/bytes:\s*string/);
    expect(source).not.toContain("data:image");
  });

  /*
    The count is deliberately NOT restated here. It used to read "5 roles 22
    perms" and went stale the moment DECISIONS §29 added the two Progress ids
    (22 → 25) — a number in a name is a claim nobody maintains. The vocabulary's
    size and its agreement with the server are owned by
    `src/domains/auth/__tests__/permissionParity.test.ts`, which parses the
    shipped backend config; this case owns the narrower claim its assertions
    actually make: web and mobile read ONE RBAC model.
  */
  it("same RBAC same permissions — one vocabulary for web and mobile", () => {
    const permPath = join(ROOT, "domains", "auth", "permissions.ts");
    const source = readFileSync(permPath, "utf8");
    expect(source).toContain("ROLES");
    expect(source).toContain("PERMISSIONS");
    expect(source).toContain("rolePermissions");
  });
});

/**
 * W8 — the client composition files must not import the fixture graph.
 * Comments may name those modules. Import specifiers may not.
 */
function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) out.push(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) out.push(match[1]);
  return out;
}

function clientImportForbidden(specifier: string): boolean {
  return /services\/(?:demoStore|localStore)|domains\/demo(?:\/|$)|(?:^|\/)dataset(?:\/|$)|data\/dataset|demoDataManager|DemoDataPanel|loadDatasetArtifact|demoCredentials|demoReferences|mediaReferences|demoCollection/.test(
    specifier,
  );
}

function clientCompositionFiles(): string[] {
  const targets = join(ROOT, "targets");
  const files = sourceFiles(targets).filter((file) => /\.client\.tsx?$/.test(file));
  files.push(join(ROOT, "domains", "registry.client.ts"));
  return files;
}

describe("client composition does not import the fixture graph", () => {
  it("never imports the store, the seed, the dataset artifact, or a demo panel", () => {
    const offenders: string[] = [];
    for (const file of clientCompositionFiles()) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        if (clientImportForbidden(specifier)) offenders.push(`${file} → ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(clientImportForbidden("@/services/localStore")).toBe(true);
    expect(clientImportForbidden("@/services/demoStore")).toBe(true);
    expect(clientImportForbidden("@/domains/demo/seed")).toBe(true);
    expect(clientImportForbidden("@/dataset/load")).toBe(true);
    expect(clientImportForbidden("@/components/settings/DemoDataPanel")).toBe(true);
    expect(clientImportForbidden("@/domains/media/mediaReferences")).toBe(true);
    expect(clientImportForbidden("@/domains/media/demoReferences")).toBe(true);
    expect(clientImportForbidden("@/domains/shared/demoCollection")).toBe(true);
    expect(clientImportForbidden("lucide-react")).toBe(false);
    expect(importSpecifiers('// would pull demoStore\nimport { PlugZap } from "lucide-react";')).toEqual(["lucide-react"]);
  });
});

describe("kept fixture gates are still present", () => {
  const KEPT = [
    "src/__tests__/m10Boundary.test.ts",
    "src/views/__tests__/attendanceNoFixtures.test.ts",
    "src/views/__tests__/compensationNoFixtures.test.ts",
    "src/views/__tests__/messagesNoFixtures.test.ts",
    "src/views/__tests__/relationsNoFixtures.test.ts",
    "src/views/__tests__/schedulingNoFixtures.test.ts",
  ];

  function missingKept(files: readonly { path: string; text: string | null }[]): string[] {
    return files.flatMap((file) => (file.text === null || file.text.length < 200 ? [file.path] : []));
  }

  it("m10Boundary and the five NoFixtures gates were not deleted", () => {
    const files = KEPT.map((path) => ({
      path,
      text: existsSync(join(process.cwd(), path)) ? readFileSync(join(process.cwd(), path), "utf8") : null,
    }));
    expect(missingKept(files)).toEqual([]);
    expect(missingKept([{ path: "src/__tests__/m10Boundary.test.ts", text: null }])).toEqual([
      "src/__tests__/m10Boundary.test.ts",
    ]);
    const m10 = files[0].text ?? "";
    expect(m10).toContain("data/records");
    expect(m10).toContain("data/academy");
  });
});
