/**
 * Session lifetime — the ONE definition, shared by every authentication
 * implementation.
 *
 * This module deliberately imports NOTHING from the demo authentication
 * implementation: `AuthContext` needs the TTL to anchor the session clock, and
 * pulling `localAuthRepository` into the shared auth path would drag the demo
 * store (and its seed payload) into every build. The demo repository re-exports
 * this constant so its public surface is unchanged.
 */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
