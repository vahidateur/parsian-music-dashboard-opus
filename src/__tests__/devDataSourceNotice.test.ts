/**
 * The dev-server data-source disclosure.
 *
 * WHAT THIS FILE PROVES
 * 1. The disclosure says the TRUE thing in every combination that can occur
 *    (composition × data source × backend presence) — in particular that a
 *    running backend is announced as UNUSED when the composition reads local
 *    data, and that a missing backend is announced when the composition needs
 *    one.
 * 2. The classification the disclosure prints is the SAME classification the
 *    runtime config uses. This is the drift guard: if `config.ts` and the
 *    vocabulary ever disagreed, the terminal could claim "local data" while
 *    the panel was reading the API — the exact lie the disclosure exists to
 *    prevent. The two are compared over the WHOLE vocabulary, not a sample.
 *
 * The disclosure's text lives in `scripts/lib/` (outside `src/`), so the
 * client bundler can never resolve it.
 */
import { describe, expect, it } from "vitest";
import { resolveConfig } from "@/api/config";
import { API_DATA_SOURCES, LOCAL_DATA_SOURCES, classifyDataSource } from "@/api/dataSourceVocabulary";
import { resolveDataSourceNotice } from "../../scripts/lib/data-source-notice.mjs";

const HOST = "127.0.0.1";
const PORT = 8080;

const notice = (overrides: Partial<Parameters<typeof resolveDataSourceNotice>[0]> = {}) =>
  resolveDataSourceNotice({
    appTarget: "demo",
    sourceClass: "local",
    apiPortBusy: false,
    apiHost: HOST,
    apiPort: PORT,
    ...overrides,
  });

describe("the dev-server disclosure", () => {
  it("announces local data when the composition reads the browser's own storage", () => {
    const result = notice();
    expect(result.level).toBe("info");
    expect(result.lines.join("\n")).toContain("demo");
    expect(result.lines.join("\n")).toContain("محلی");
  });

  it("warns when a backend is running that this server will not use", () => {
    // The trap: `npm run dev` next to a running Laravel. The backend is up,
    // the panel does not talk to it, and every change lands in the browser.
    const result = notice({ sourceClass: "local", apiPortBusy: true });
    expect(result.level).toBe("warn");
    const text = result.lines.join("\n");
    expect(text).toContain(`${HOST}:${PORT}`);
    expect(text).toContain("npm run dev:full");
  });

  it("does not warn about an unused backend when the composition reads the API", () => {
    const result = notice({ sourceClass: "api", apiPortBusy: true });
    expect(result.level).toBe("info");
    expect(result.lines.join("\n")).not.toContain("npm run dev:full");
  });

  it("warns when the composition needs a backend and none is listening", () => {
    const result = notice({ appTarget: "client", sourceClass: "api", apiPortBusy: false });
    expect(result.level).toBe("warn");
    expect(result.lines.join("\n")).toContain(`${HOST}:${PORT}`);
  });

  it("stays silent when the client composition has its backend up", () => {
    // `scripts/dev-full.mjs` already announces the client composition, and the
    // panel discloses its own unavailable domains. A second signage for one
    // fact would train people to ignore both — so the notice speaks only when
    // something is off.
    const result = notice({ appTarget: "client", sourceClass: "api", apiPortBusy: true });
    expect(result.level).toBe("none");
    expect(result.lines).toEqual([]);
  });

  it("flags an invalid data source instead of guessing one", () => {
    const result = notice({ sourceClass: "invalid" });
    expect(result.level).toBe("warn");
    expect(result.lines.join("\n")).toContain("VITE_DATA_SOURCE");
  });
});

describe("the disclosure cannot contradict the running panel", () => {
  const VALUES = ["", ...LOCAL_DATA_SOURCES, ...API_DATA_SOURCES, "typo", "prodution"];

  it("classifies every vocabulary value the way the runtime config resolves it", () => {
    for (const value of VALUES) {
      for (const target of ["demo", "client"] as const) {
        const runtime = resolveConfig({ VITE_DATA_SOURCE: value }, target);
        const classified = classifyDataSource(value, target);

        // An invalid value is a configuration error in both places: the runtime
        // refuses to boot, and the disclosure says so instead of naming a
        // source the panel will never use.
        if (classified === "invalid") {
          expect(runtime.error, `${value}/${target}`).toBeTruthy();
          continue;
        }
        expect(runtime.error, `${value}/${target}`).toBeNull();
        expect(runtime.mode, `${value}/${target}`).toBe(classified);
      }
    }
  });

  it("reads an unset value as local in the demo composition and as the API in the client one", () => {
    expect(classifyDataSource(undefined, "demo")).toBe("local");
    expect(classifyDataSource(undefined, "client")).toBe("api");
  });
});
