/**
 * Data-source configuration.
 *
 * `local` — the on-device implementation of the operator/fixture composition.
 * The legacy env alias of that mode is accepted only in that composition.
 * `api`  — repositories talk to a real REST backend at VITE_API_BASE_URL.
 *
 * SAFETY RULE (see docs/architecture/environments.md):
 * Production must never silently fall back to local data. An unrecognised or
 * misspelled `VITE_DATA_SOURCE` is a configuration error, not a cue to serve
 * fabricated data — `resolveConfig` reports it instead of guessing. Only an
 * absent/empty value selects local, and only when `__APP_TARGET__` is
 * `"operator"`. That comparison is a build-time constant. The operator
 * function is not referenced from the customer or client branch, so its
 * strings are eliminated from those artifacts.
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

/**
 * Resolves the data source for the composition this build actually is.
 *
 * The operator branch is referenced only from `if (__APP_TARGET__ === "operator")`.
 * Vite replaces that identifier with a string literal before minify, so customer
 * and client builds drop the function and every string inside it.
 */
export function resolveConfig(env: RawEnv = readEnv()): RuntimeConfig {
  if (__APP_TARGET__ === "operator") return resolveOperatorConfig(env);
  return resolveDeliveryConfig(env);
}

/**
 * Customer and client. API-only. No local store. A non-API value sets `error`
 * so boot refuses; `mode` stays `api` so a missed guard cannot select local.
 */
export function resolveDeliveryConfig(env: RawEnv): RuntimeConfig {
  const raw = (env.VITE_DATA_SOURCE ?? "").trim().toLowerCase();
  const apiBaseUrl = (env.VITE_API_BASE_URL ?? "").trim() || DEFAULT_BASE_URL;
  const supplied = env.VITE_DATA_SOURCE;
  if (raw === "" || (PRODUCTION_ALIASES as readonly string[]).includes(raw)) {
    return { mode: "api", apiBaseUrl, error: null };
  }
  return {
    mode: "api",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${supplied ?? raw}" is not available in this composition. ` +
      `This build is API-only and has no local dataset. ` +
      `Use one of: ${PRODUCTION_ALIASES.join(", ")}. Refusing to start.`,
  };
}

/** Operator/fixture only. Not referenced by the delivery branch. */
function resolveOperatorConfig(env: RawEnv): RuntimeConfig {
  const raw = (env.VITE_DATA_SOURCE ?? "").trim().toLowerCase();
  const apiBaseUrl = (env.VITE_API_BASE_URL ?? "").trim() || DEFAULT_BASE_URL;
  const supplied = env.VITE_DATA_SOURCE;

  // W6: the legacy alias and `local` are the same mode. Unset is local.
  if (raw === "") return { mode: "local", apiBaseUrl, error: null };
  if (raw === "local" || raw === "demo") return { mode: "local", apiBaseUrl, error: null };
  if ((PRODUCTION_ALIASES as readonly string[]).includes(raw)) {
    return { mode: "api", apiBaseUrl, error: null };
  }
  return {
    mode: "local",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${supplied ?? ""}" is not a valid data source. ` +
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
