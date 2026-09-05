import { describe, expect, it } from "vitest";
import { resolveConfig } from "@/api/config";

/**
 * The governing safety rule: production must never silently fall back to demo.
 * An earlier version of this suite asserted that `VITE_DATA_SOURCE=production`
 * resolved to demo mode — it encoded the bug as expected behaviour. It now
 * asserts the opposite.
 */
describe("resolveConfig", () => {
  it("defaults to demo mode when nothing is configured", () => {
    expect(resolveConfig({})).toEqual({ mode: "demo", apiBaseUrl: "/api/v1", error: null });
  });

  it("treats an empty value as unset rather than invalid", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "   " })).toEqual({
      mode: "demo",
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

  it("never resolves an unknown value to a usable demo config", () => {
    // Even though mode is demo (nothing else is renderable), `error` is set so
    // the boot guard refuses to start the app.
    const config = resolveConfig({ VITE_DATA_SOURCE: "typo" });
    expect(config.error).not.toBeNull();
  });

  it("keeps an explicit demo selection valid and error-free", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "demo" }).error).toBeNull();
    expect(resolveConfig({ VITE_DATA_SOURCE: "demo" }).mode).toBe("demo");
  });
});
