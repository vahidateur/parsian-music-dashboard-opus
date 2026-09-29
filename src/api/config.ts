/**
 * Data-source configuration.
 *
 * `local` — the on-device implementation. `VITE_DATA_SOURCE=demo` is the legacy
 * alias and resolves to the same mode. It is not a second application.
 * `api`  — repositories talk to a real REST backend at VITE_API_BASE_URL.
 *
 * SAFETY RULE (see docs/architecture/environments.md):
 * Production must never silently fall back to local data. An unrecognised or
 * misspelled `VITE_DATA_SOURCE` is a configuration error, not a cue to serve
 * fabricated data — `resolveConfig` reports it instead of guessing. Only an
 * absent/empty value selects local, and only in the demo composition.
 */

export type DataSourceMode = "local" | "api";

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

/** Values people plausibly type meaning "real data". None may map to local. */
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

  // Unset → local… but ONLY in the demo composition. The client build has no
  // local dataset capability (its target files and local repositories are not
  // in the bundle), so an unset data source there means the API — falling back
  // to local here would be exactly the silent downgrade this module exists to
  // prevent, and could not work anyway.
  if (raw === "") {
    if (__APP_TARGET__ === "client") return { mode: "api", apiBaseUrl, error: null };
    return { mode: "local", apiBaseUrl, error: null };
  }

  // `demo` is the legacy env value. It is the same mode as `local`, not a
  // second source and not a production alias.
  if (raw === "local" || raw === "demo") return { mode: "local", apiBaseUrl, error: null };

  if ((PRODUCTION_ALIASES as readonly string[]).includes(raw)) {
    // `staging`/`production` are not distinct data sources: both mean "use the
    // real API". They are accepted rather than silently downgraded to local.
    return { mode: "api", apiBaseUrl, error: null };
  }

  return {
    mode: "local",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${env.VITE_DATA_SOURCE ?? ""}" is not a valid data source. ` +
      `Use "local" or "demo", or one of: ${PRODUCTION_ALIASES.join(", ")}. ` +
      `Refusing to start: falling back to local data here could present fabricated records as real.`,
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

/** True for the local data-source mode, including the legacy `demo` env alias. */
export const isDemoMode = (): boolean => current.mode === "local";

/** True when the app must refuse to boot because the environment is invalid. */
export const hasConfigError = (): boolean => current.error !== null;
