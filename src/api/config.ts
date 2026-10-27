/**
 * Data-source configuration.
 *
 * `local` — the on-device implementation of the demo/fixture composition.
 * `VITE_DATA_SOURCE=demo` is the legacy alias and resolves to the same mode
 * there. It is not a second application, and it is not a client data source.
 * `api`  — repositories talk to a real REST backend at VITE_API_BASE_URL.
 *
 * SAFETY RULE (see docs/architecture/environments.md):
 * Production must never silently fall back to local data. An unrecognised or
 * misspelled `VITE_DATA_SOURCE` is a configuration error, not a cue to serve
 * fabricated data — `resolveConfig` reports it instead of guessing. Only an
 * absent/empty value selects local, and only in the demo composition.
 */

import { API_DATA_SOURCES, classifyDataSource } from "./dataSourceVocabulary";

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
 * Resolves the data source for one composition.
 *
 * The second argument exists so tests can prove the client rule without a
 * second Vitest project. Production code omits it: the build injects
 * `__APP_TARGET__`, and the aliases — not this string — keep demo modules out
 * of the client bundle.
 */
export function resolveConfig(env: RawEnv = readEnv(), target: "demo" | "client" = __APP_TARGET__): RuntimeConfig {
  const raw = (env.VITE_DATA_SOURCE ?? "").trim().toLowerCase();
  const apiBaseUrl = (env.VITE_API_BASE_URL ?? "").trim() || DEFAULT_BASE_URL;
  const supplied = env.VITE_DATA_SOURCE;

  // The client composition has no local store and no demo fixture. `local` and
  // the legacy `demo` alias must not become a hidden path back into one.
  // Unset still means the API. Any other non-API value sets `error` so boot
  // refuses; `mode` stays `api` only so a missed guard cannot select local.
  if (target === "client") return resolveClientConfig(raw, apiBaseUrl, supplied);

  // Demo/fixture composition. W6: `demo` aliases to `local`. Unset is local.
  //
  // The CLASSIFICATION comes from the shared vocabulary (one owner, so the
  // dev-server disclosure in vite.config.ts can never say something different
  // from what the panel actually does). The messages stay here, because they
  // are the user's copy, not the rule.
  const kind = classifyDataSource(raw, "demo");
  if (kind === "local") return { mode: "local", apiBaseUrl, error: null };

  if (kind === "api") {
    // `staging`/`production` are not distinct data sources: both mean "use the
    // real API". They are accepted rather than silently downgraded to local.
    return { mode: "api", apiBaseUrl, error: null };
  }

  return {
    mode: "local",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${supplied ?? ""}" is not a valid data source. ` +
      `Use "local" or "demo", or one of: ${API_DATA_SOURCES.join(", ")}. ` +
      `Refusing to start: falling back to local data here could present fabricated records as real.`,
  };
}

function resolveClientConfig(raw: string, apiBaseUrl: string, supplied: string | undefined): RuntimeConfig {
  if (classifyDataSource(raw, "client") === "api") {
    return { mode: "api", apiBaseUrl, error: null };
  }
  return {
    mode: "api",
    apiBaseUrl,
    error:
      `VITE_DATA_SOURCE="${supplied ?? raw}" is not available in the client composition. ` +
      `This build is API-only and has no local dataset. ` +
      `Use one of: ${API_DATA_SOURCES.join(", ")}. Refusing to start.`,
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
