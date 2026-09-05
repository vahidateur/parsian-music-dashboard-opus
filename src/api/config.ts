/**
 * Data-source configuration.
 *
 * `demo` (default) — everything is served by the localStorage-backed DemoStore.
 * `api`            — repositories talk to a real REST backend at VITE_API_BASE_URL.
 *
 * There is intentionally no third "production-ish" mode: if the app is in demo
 * mode it must behave, and be labelled, as demo.
 */

export type DataSourceMode = "demo" | "api";

export interface RuntimeConfig {
  mode: DataSourceMode;
  apiBaseUrl: string;
}

const DEFAULT_BASE_URL = "/api/v1";

interface RawEnv {
  VITE_DATA_SOURCE?: string;
  VITE_API_BASE_URL?: string;
}

function readEnv(): RawEnv {
  try {
    return (import.meta.env ?? {}) as RawEnv;
  } catch {
    return {};
  }
}

export function resolveConfig(env: RawEnv = readEnv()): RuntimeConfig {
  const raw = (env.VITE_DATA_SOURCE ?? "").trim().toLowerCase();
  const apiBaseUrl = (env.VITE_API_BASE_URL ?? "").trim() || DEFAULT_BASE_URL;
  const mode: DataSourceMode = raw === "api" ? "api" : "demo";
  return { mode, apiBaseUrl };
}

let current: RuntimeConfig = resolveConfig();

export function getRuntimeConfig(): RuntimeConfig {
  return current;
}

/** Test/bootstrap seam — overrides the environment-derived configuration. */
export function setRuntimeConfig(next: Partial<RuntimeConfig>): RuntimeConfig {
  current = { ...current, ...next };
  return current;
}

export function resetRuntimeConfig(): RuntimeConfig {
  current = resolveConfig();
  return current;
}

export const isDemoMode = (): boolean => current.mode === "demo";
