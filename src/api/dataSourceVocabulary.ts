/**
 * The data-source vocabulary — ONE owner for the words that decide where the
 * panel reads from.
 *
 * Two consumers, and they must never disagree:
 *
 *   - `src/api/config.ts` — the runtime rule: which repository a domain
 *     resolves to, and the error the user sees for a misspelled value;
 *   - the dev-server disclosure in `vite.config.ts` — the terminal line that
 *     says, before a browser opens, whether THIS dev server talks to the
 *     backend or to the browser's own storage.
 *
 * If the two ever disagreed, the dev server could announce "local data" while
 * the panel was actually reading the API — a false statement about the data
 * source, which is the one thing that disclosure exists to prevent. So the
 * classification lives here and both sides call it.
 *
 * This module is deliberately free of build-time dependencies: no
 * `__APP_TARGET__`, no `import.meta.env`, no side effects. The dev server
 * resolves it at config-load time, where neither of those exists.
 */

/** Values that select the on-device store. */
export const LOCAL_DATA_SOURCES = ["local", "demo"] as const;

/**
 * Values people plausibly type meaning "the real API".
 *
 * None of them may map to local: an alias that silently degraded to the
 * on-device store would present fabricated records as real.
 */
export const API_DATA_SOURCES = ["api", "production", "prod", "live", "real", "staging", "stage"] as const;

/** How a raw `VITE_DATA_SOURCE` value resolves for one composition. */
export type DataSourceClass = "local" | "api" | "invalid";

/**
 * Classifies a raw `VITE_DATA_SOURCE` value for one composition.
 *
 * demo   — unset or an explicit local alias means the on-device store; an API
 *          alias means the API; anything else is a configuration error.
 * client — the API is the only source: unset means the API, and a local alias
 *          is a configuration error (this composition has no on-device store).
 */
export function classifyDataSource(raw: string | undefined, target: "demo" | "client"): DataSourceClass {
  const value = (raw ?? "").trim().toLowerCase();

  if (target === "client") {
    if (value === "") return "api";
    return (API_DATA_SOURCES as readonly string[]).includes(value) ? "api" : "invalid";
  }

  if (value === "") return "local";
  if ((LOCAL_DATA_SOURCES as readonly string[]).includes(value)) return "local";
  return (API_DATA_SOURCES as readonly string[]).includes(value) ? "api" : "invalid";
}
