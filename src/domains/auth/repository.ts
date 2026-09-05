import type { Page } from "@/api/types";
import type { AuthUser, CreateUserInput, LoginInput, Session, UpdateUserInput } from "./types";

/**
 * Authentication contract. Implementations: DemoAuthRepository (#1) and
 * ApiAuthRepository (#2). Failures are always `ApiError`s.
 */
export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  logout(): Promise<void>;
  /** Restores a persisted session, or null when there is none / it expired. */
  restore(): Promise<Session | null>;
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
}
