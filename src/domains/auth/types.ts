import type { Permission, RoleId } from "./permissions";

/**
 * Authentication domain types.
 *
 * NOTE ON SECRETS: no password, hash, or salt ever appears in these types. The
 * demo implementation verifies a non-secret demo passphrase and the API
 * implementation delegates to the server; neither stores credentials.
 */

export type UserStatus = "active" | "disabled";

/** An account that can sign in. Persisted in the demo dataset. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  status: UserStatus;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Optional link to a teacher record in the academy domain. */
  teacherId?: string;
}

/** The authenticated principal: user + resolved permissions. */
export interface Session {
  user: AuthUser;
  permissions: Permission[];
  /**
   * Opaque token. In demo mode this is a random, non-cryptographic reference
   * with NO security value; in API mode it is whatever the backend issues.
   */
  token: string;
  /** ISO expiry timestamp. */
  expiresAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type AuthStatus = "restoring" | "authenticated" | "unauthenticated";

/* ------------------------------------------------------------------ */
/* User management                                                     */
/* ------------------------------------------------------------------ */

export interface CreateUserInput {
  name: string;
  email: string;
  role: RoleId;
  status?: UserStatus;
}

export type UpdateUserInput = Partial<Omit<AuthUser, "id" | "createdAt">>;
