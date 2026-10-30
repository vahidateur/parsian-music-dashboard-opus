/**
 * DOMAIN_UNAVAILABLE — the explicit "no server implements this domain" result.
 *
 * The client composition must NEVER fall back to demo data when a backend is
 * missing (§ no-client-demo-fallback). Instead every call to a domain without
 * a real server rejects with this error: a typed, identifiable, honest failure
 * that views already render through their normal error states, and that the
 * shell's unavailable-domains disclosure enumerates up front.
 *
 * Deliberately NOT modeled as a `network`/`server` kind: no request was made
 * and retrying cannot succeed, so `retryable` stays false and no caller can
 * mistake "not built yet" for "the server is down".
 */
import { ApiError } from "@/api/errors";
import { unavailableCapabilityDescription } from "@/targets/targetCopy";

export const DOMAIN_UNAVAILABLE = "DOMAIN_UNAVAILABLE";

export function domainUnavailableError(domainId: string, label: string): ApiError {
  return new ApiError({
    kind: "unknown",
    code: DOMAIN_UNAVAILABLE,
    message: `بخش «${label}» در دسترس نیست. ${unavailableCapabilityDescription} (نام دامنه: ${domainId}).`,
  });
}

/**
 * A repository whose every method rejects with `DOMAIN_UNAVAILABLE`.
 *
 * All domain repository contracts are method-only and Promise-returning, so a
 * uniform rejecting factory is a faithful implementation of "the interface
 * exists, the server does not" — without inventing a single speculative
 * endpoint or copying any domain logic. Each call constructs its own error so
 * the domain id/label are exact.
 */
export function createUnavailableRepository<T extends object>(domainId: string, label: string): T {
  const factory = (): (() => Promise<never>) => () => Promise.reject(domainUnavailableError(domainId, label));
  return new Proxy({} as T, {
    get(_target, property, _receiver) {
      if (typeof property === "symbol") return undefined;
      // Any method access yields a fresh rejecting function. The contracts
      // carry no data properties; returning a function for everything keeps
      // the object shape usable through the typed interface.
      return factory();
    },
  });
}
