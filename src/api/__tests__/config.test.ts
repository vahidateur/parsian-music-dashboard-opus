import { describe, expect, it } from "vitest";
import { resolveConfig } from "@/api/config";

/**
 * The governing safety rule: production must never silently fall back to demo.
 * An earlier version of this suite asserted that `VITE_DATA_SOURCE=production`
 * resolved to demo mode — it encoded the bug as expected behaviour. It now
 * asserts the opposite.
 */
describe("resolveConfig", () => {
  it("defaults to local mode when nothing is configured", () => {
    expect(resolveConfig({})).toEqual({ mode: "local", apiBaseUrl: "/api/v1", error: null });
  });

  it("treats an empty value as unset rather than invalid", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "   " })).toEqual({
      mode: "local",
      apiBaseUrl: "/api/v1",
      error: null,
    });
  });

  it("selects api mode from the environment, case- and space-insensitively", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: " API ", VITE_API_BASE_URL: "https://x.test/api/v1" })).toEqual({
      mode: "api",
      apiBaseUrl: "https://x.test/api/v1",
      error: null,
    });
  });

  it.each(["production", "prod", "live", "real", "staging", "stage"])(
    "maps the production-intent alias %s to api mode, never demo",
    (alias) => {
      const config = resolveConfig({ VITE_DATA_SOURCE: alias });
      expect(config.mode).toBe("api");
      expect(config.error).toBeNull();
    },
  );

  it("reports an error for an unrecognised value instead of guessing", () => {
    const config = resolveConfig({ VITE_DATA_SOURCE: "prodution" });
    expect(config.error).toBeTruthy();
    expect(config.error).toContain("prodution");
  });

  it("never resolves an unknown value to a usable config", () => {
    // The mode field is local only because the union has no third value.
    // `error` is set so the boot guard refuses to start the app.
    const config = resolveConfig({ VITE_DATA_SOURCE: "typo" });
    expect(config.error).not.toBeNull();
    expect(config.mode).toBe("local");
  });

  it("keeps an explicit local selection valid and error-free", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "local" }).error).toBeNull();
    expect(resolveConfig({ VITE_DATA_SOURCE: "local" }).mode).toBe("local");
  });

  it("keeps VITE_DATA_SOURCE=demo as a legacy alias of local", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: " DEMO " })).toEqual({
      mode: "local",
      apiBaseUrl: "/api/v1",
      error: null,
    });
  });
});

describe("resolveConfig in the client composition", () => {
  it("defaults to api when nothing is configured", () => {
    expect(resolveConfig({}, "client")).toEqual({ mode: "api", apiBaseUrl: "/api/v1", error: null });
  });

  it("treats an empty value as unset api, not as local", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "   " }, "client").mode).toBe("api");
    expect(resolveConfig({ VITE_DATA_SOURCE: "   " }, "client").error).toBeNull();
  });

  it.each(["local", "demo", " DEMO ", "local "])(
    "refuses %s without selecting a local dataset",
    (value) => {
      const config = resolveConfig({ VITE_DATA_SOURCE: value }, "client");
      expect(config.mode).toBe("api");
      expect(config.mode).not.toBe("local");
      expect(config.error).toBeTruthy();
      expect(config.error).toContain("API-only");
    },
  );

  it("still accepts an explicit api source", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "api", VITE_API_BASE_URL: "https://x.test/api/v1" }, "client")).toEqual({
      mode: "api",
      apiBaseUrl: "https://x.test/api/v1",
      error: null,
    });
  });
});
