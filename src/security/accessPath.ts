/**
 * Secret access path — the panel is not served at a guessable URL.
 *
 * WHAT THIS IS
 *
 * The app refuses to render anything until the URL carries the configured
 * access slug (`VITE_ACCESS_PATH`). Anything else gets an indistinguishable
 * blank 404-style page: no branding, no product name, no hint that a login
 * exists here at all.
 *
 * WHAT THIS IS NOT
 *
 * **This is obscurity, not security, and it must never be counted as a second
 * factor.** A URL leaks constantly — browser history, the Referer header,
 * bookmark sync, corporate TLS inspection, a screenshot in a chat. Treat it as
 * a filter that removes opportunistic scanners and mass exploitation, which is
 * genuinely worth having, and nothing more. Authentication and server-side
 * authorization remain the real controls.
 *
 * WHY IT STILL EARNS ITS PLACE
 *
 * Internet-wide scanners fetch `/`, `/admin`, `/login` on every IP and hostname
 * they can resolve. A random 32-hex-character path means those scans return
 * nothing, so the panel never enters a "known hosts running X" dataset — which
 * is precisely how a private SaaS ends up in an AI training corpus or on a
 * shodan-style index.
 *
 * DEPLOYMENT
 *
 * Best practice is to enforce the path at the EDGE too (nginx/Caddy), so that
 * a wrong path never even reaches the bundle. Client-side enforcement alone
 * still ships the JavaScript to the requester.
 */

/** Generated slug from build config. Empty string = gate disabled. */
const CONFIGURED = (import.meta.env.VITE_ACCESS_PATH ?? "").trim();

/**
 * A slug must be long and unguessable.
 *
 * 24 chars of hex is ~96 bits — far beyond brute force over the network,
 * especially behind rate limiting. Shorter slugs give false comfort, so a
 * misconfigured short value is rejected rather than silently accepted.
 */
const MIN_SLUG_LENGTH = 24;
const SLUG_PATTERN = /^[a-zA-Z0-9_-]{24,128}$/;

export interface AccessPathState {
  /** Whether a gate is configured at all. */
  enabled: boolean;
  /** True when the current URL satisfies the gate. */
  granted: boolean;
  /** Set when a slug is configured but malformed. */
  misconfigured: string | null;
}

/**
 * Reads the slug from the URL path or the `?k=` query parameter.
 *
 * Both are supported because a static host may not allow arbitrary path
 * rewriting. The path form is preferred: query strings are more likely to be
 * captured verbatim by analytics and proxy logs.
 */
export function evaluateAccessPath(url: URL = new URL(window.location.href)): AccessPathState {
  if (CONFIGURED.length === 0) {
    // No gate configured. Honest default: the app runs, and the deployment
    // docs state plainly that the path gate is off.
    return { enabled: false, granted: true, misconfigured: null };
  }

  if (!SLUG_PATTERN.test(CONFIGURED)) {
    return {
      enabled: true,
      granted: false,
      misconfigured:
        `VITE_ACCESS_PATH must be ${MIN_SLUG_LENGTH}–128 characters of [A-Za-z0-9_-]. ` +
        `A short or malformed slug offers no protection, so the app refuses to start.`,
    };
  }

  const fromPath = url.pathname.split("/").filter(Boolean);
  const fromQuery = url.searchParams.get("k");

  // Constant-time-ish comparison. Timing attacks over a network against a
  // string compare are impractical, but there is no reason to be sloppy.
  const granted =
    fromPath.some((segment) => safeEqual(segment, CONFIGURED)) ||
    (fromQuery !== null && safeEqual(fromQuery, CONFIGURED));

  return { enabled: true, granted, misconfigured: null };
}

/** Length-independent comparison that does not early-exit on first mismatch. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * The base path every internal link must be built on, so navigating inside the
 * app never drops the slug and bounces the user to the decoy page.
 */
export function accessBasePath(): string {
  return CONFIGURED.length > 0 ? `/${CONFIGURED}` : "";
}

/** Generates a fresh slug. Used by `npm run gen:access-path`. */
export function generateAccessSlug(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, "0")).join("");
}
