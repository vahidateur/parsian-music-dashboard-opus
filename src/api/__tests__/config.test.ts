import { describe, expect, it } from "vitest";
import { resolveConfig } from "@/api/config";

describe("resolveConfig", () => {
  it("defaults to demo mode with a relative base url", () => {
    expect(resolveConfig({})).toEqual({ mode: "demo", apiBaseUrl: "/api/v1" });
  });
  it("selects api mode from the environment", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "API", VITE_API_BASE_URL: "https://x.test/api/v1" })).toEqual({
      mode: "api",
      apiBaseUrl: "https://x.test/api/v1",
    });
  });
  it("falls back to demo for unknown values", () => {
    expect(resolveConfig({ VITE_DATA_SOURCE: "production" }).mode).toBe("demo");
  });
});
