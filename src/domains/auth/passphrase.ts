/**
 * Passphrase policy — shared by every environment that lets an operator set a
 * per-account passphrase.
 *
 * Extracted from `demoCredentials.ts` for the same reason `session.ts` exists:
 * `UsersPanel` and `ApiUserRepository` both need the minimum length and the
 * acceptability check, and neither may import the demo credential store to get
 * them — that module belongs to the demo/local credential seam and must not be
 * part of the client bundle's graph.
 *
 * SECURITY: still a local, client-side convenience. Real credential storage —
 * hashing, rotation, lockout — remains the server's job (docs/security.md).
 */

/** Shortest passphrase the panel accepts. Long enough to not be a formality. */
export const MIN_PASSPHRASE_LENGTH = 6;

/** A passphrase must be long enough to be worth calling one. */
export function isAcceptablePassphrase(value: string): boolean {
  return value.trim().length >= MIN_PASSPHRASE_LENGTH;
}
