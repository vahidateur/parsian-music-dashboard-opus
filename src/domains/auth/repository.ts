import type { Page } from "@/api/types";
import type { AuthUser, CreateUserInput, LoginInput, Session, UpdateUserInput } from "./types";
import type { SessionEndReason } from "@/security/useIdleTimeout";

/**
 * Authentication contract. Implementations: LocalAuthRepository (#1) and
 * ApiAuthRepository (#2). Failures are always `ApiError`s.
 */
export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  logout(): Promise<void>;
  /** Restores a persisted session, or null when there is none / it expired. */
  restore(): Promise<Session | null>;
  /**
   * Restores a persisted session and says WHY it is gone when it is.
   *
   * `expiredReason` is set only when the stored session provably outlived a
   * lifetime ceiling the server (or, for #1, the local TTL) enforces —
   * never for a missing, malformed, or revoked credential, which stay
   * silent so the login screen cannot be used to probe credential states.
   * The shell shows the reason as a notice; `restore()` keeps its
   * null-on-any-failure contract for every existing caller.
   */
  restoreDetailed(): Promise<{ session: Session | null; expiredReason: Extract<SessionEndReason, "idle" | "absolute"> | null }>;
  /** Re-reads the current principal from the source of truth. */
  me(): Promise<Session>;
}

/** User administration. Separate from authentication by design. */
export interface UserRepository {
  list(signal?: AbortSignal): Promise<Page<AuthUser>>;
  get(id: string): Promise<AuthUser>;
  create(input: CreateUserInput): Promise<AuthUser>;
  update(id: string, input: UpdateUserInput): Promise<AuthUser>;
  delete(id: string): Promise<void>;
  /**
   * Sets the passphrase this account signs in with.
   *
   * A credential is never part of the user record: it is written through this
   * verb so the record can be exported, backed up and displayed without ever
   * carrying a secret. Pass an empty string to clear a per-account passphrase
   * and return the account to the environment's default.
   */
  setPassword(id: string, passphrase: string): Promise<void>;
  /** True when this account has its own passphrase rather than the default. */
  hasOwnPassword(id: string): Promise<boolean>;
}
