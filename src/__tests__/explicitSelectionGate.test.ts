/**
 * W8 — explicit selection gate.
 *
 * The client composition cannot select local data, including through the
 * legacy `demo` alias. Production-intent aliases never map to local on either
 * composition. An unrecognised value is an error, not a silent local dataset.
 * Unset local mode exists only on the demo composition, and only as the
 * documented explicit default.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfig, type RuntimeConfig } from "@/api/config";

type Target = "demo" | "client";

function selectionViolations(target: Target, raw: string, config: RuntimeConfig): string[] {
  const violations: string[] = [];
  const production = ["api", "production", "prod", "live", "real", "staging", "stage"];
  const explicitLocal = raw.trim().toLowerCase() === "" || raw.trim().toLowerCase() === "local" || raw.trim().toLowerCase() === "demo";
  if (target === "client" && config.mode !== "api") violations.push("client selected local");
  if (target === "client" && (raw.trim().toLowerCase() === "local" || raw.trim().toLowerCase() === "demo") && !config.error) {
    violations.push("client accepted a local source");
  }
  if (production.includes(raw.trim().toLowerCase()) && config.mode !== "api") violations.push("production alias selected local");
  if (production.includes(raw.trim().toLowerCase()) && config.error) violations.push("production alias was refused");
  if (target === "demo" && explicitLocal && (config.mode !== "local" || config.error)) violations.push("explicit local was not selected");
  if (raw.trim().toLowerCase() === "typo" && !config.error) violations.push("typo was accepted");
  if (target === "client" && raw.trim().toLowerCase() === "typo" && config.mode !== "api") violations.push("client typo selected local");
  return violations;
}

describe("explicit selection", () => {
  const aliases = ["api", "production", "prod", "live", "real", "staging", "stage"] as const;

  it("reads the production-alias list from config and never maps one to local", () => {
    const source = readFileSync(join(process.cwd(), "src", "api", "config.ts"), "utf8");
    const match = source.match(/const PRODUCTION_ALIASES = \[([\s\S]*?)\] as const/);
    expect(match).not.toBeNull();
    const declared = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    expect(declared).toEqual([...aliases]);
    for (const alias of aliases) {
      for (const target of ["demo", "client"] as const) {
        const config = resolveConfig({ VITE_DATA_SOURCE: alias }, target);
        expect(selectionViolations(target, alias, config), `${target} ${alias}`).toEqual([]);
        expect(config.mode).toBe("api");
      }
    }
  });

  it("the client composition never selects local", () => {
    for (const value of ["", "   ", "local", "demo", " DEMO ", "typo", "operator", "customer"]) {
      const config = resolveConfig({ VITE_DATA_SOURCE: value }, "client");
      expect(config.mode, value).toBe("api");
      if (value.trim() !== "") expect(config.error, value).toBeTruthy();
    }
    expect(selectionViolations("client", "local", { mode: "local", apiBaseUrl: "/api/v1", error: null })).toContain(
      "client selected local",
    );
  });

  it("the demo composition selects local only from an explicit local source", () => {
    for (const value of ["", "local", "demo", " DEMO "]) {
      const config = resolveConfig({ VITE_DATA_SOURCE: value }, "demo");
      expect(selectionViolations("demo", value, config), value).toEqual([]);
      expect(config).toEqual({ mode: "local", apiBaseUrl: "/api/v1", error: null });
    }
    const typo = resolveConfig({ VITE_DATA_SOURCE: "typo" }, "demo");
    expect(typo.error).toBeTruthy();
    expect(selectionViolations("demo", "typo", { mode: "local", apiBaseUrl: "/api/v1", error: null })).toContain(
      "typo was accepted",
    );
  });

  it("the build target union is demo | client and nothing else", () => {
    const vite = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    expect(vite).toContain('const APP_TARGET: "demo" | "client"');
    expect(vite).not.toMatch(/"operator"|"customer"/);
  });
});
