import type { ApiError } from "@/api/errors";

/**
 * Whether a failed read must drop the data it was holding.
 *
 * A 403 is a resource-level denial: the server just refused THIS read, so the
 * page/record/derived value it was displaying is no longer proven accessible.
 * Keeping it would leave previously authorized data on screen after access was
 * denied. A 401 belongs to the session lifecycle, a 404 is a not-found answer,
 * and a 5xx/network failure is a retryable failure — none of those proves the
 * data is forbidden, so their existing presentation is preserved.
 *
 * This is deliberately per-read, not per-domain: a 403 answers one request.
 * Other queries keep their own valid caches until their own response denies
 * them, which is what keeps unrelated state intact.
 */
export function invalidatesOnAuthorization(error: ApiError): boolean {
  return error.kind === "authorization";
}
