/**
 * Data-source configuration.
 *
 * `demo` — everything is served by the localStorage-backed DemoStore.
 * `api`  — repositories talk to a real REST backend at VITE_API_BASE_URL.
 *
 * SAFETY RULE (see docs/architecture/environments.md):
 * Production must never silently fall back to Demo. An unrecognised or
 * misspelled `VITE_DATA_SOURCE` is a configuration error, not a cue to serve
 * fabricated data — `resolveConfig` reports it instead of guessing. Only an
 * absent/empty value selects demo, which keeps `npm run dev` convenient.
 */

export type DataSourceMode = "demo" | "api";

export interface RuntimeConfig {
  mode: DataSourceMode;
  apiBaseUrl: string;
  /**
   * Populated when the environment is unusable (unknown mode, or api mode with
   * no absolute base URL). The app must surface this and refuse to run rather
   * than degrade to demo data.
   */
  error: string | null;
}

const DEFAULT_BASE_URL = "/api/v1";

/** Values people plausibly type meaning "real data". None may map to demo. */
const PRODUCTION_ALIASES = ["api", "production", "prod", "live", "real", "staging", "stage"] as const;

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

  // Unset → demo. Developer convenience, and unambiguous: nobody who set
  // nothing believes they configured production.
  if (raw === "") return { mode: "demo", apiBaseUrl, error: null };

  if (raw === "demo") return { mode: "demo", apiBaseUrl, error: null };

  if ((PRODUCTION_ALIASES as readonly string[]).includes(raw)) {
    // `staging`/`production` are not distinct data sources: both mean "use the
    // real API". They are accepted rather than silently downgraded to demo.
    return { mode: "api", apiBaseUrl, error: null };
  }

  return {
    mode: "demo",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${env.VITE_DATA_SOURCE ?? ""}" is not a valid data source. ` +
      `Use "demo" or one of: ${PRODUCTION_ALIASES.join(", ")}. ` +
      `Refusing to start: falling back to demo data here could present fabricated records as real.`,
  };
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

/** True when the app must refuse to boot because the environment is invalid. */
export const hasConfigError = (): boolean => current.error !== null;
