import { ApiClient } from "@/api/client";
import { getRuntimeConfig } from "@/api/config";
import { ApiAuthRepository } from "./auth/apiAuthRepository";
import { DemoAuthRepository } from "./auth/demoAuthRepository";
import { ApiUserRepository, DemoUserRepository } from "./auth/userRepository";
import type { AuthRepository, UserRepository } from "./auth/repository";
import { ApiStudentRepository } from "./students/apiRepository";
import { DemoStudentRepository } from "./students/demoRepository";
import type { StudentRepository } from "./students/repository";

/**
 * Composition root. The only place that decides whether a domain is served by
 * the DemoStore or by the HTTP API. Views depend on these getters, never on a
 * concrete class.
 */

let client: ApiClient | null = null;
let authToken: string | null = null;

interface Overrides {
  students?: StudentRepository;
  auth?: AuthRepository;
  users?: UserRepository;
}
const overrides: Overrides = {};

const isApiMode = (): boolean => getRuntimeConfig().mode === "api";

export function getApiClient(): ApiClient {
  if (!client) {
    client = new ApiClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getToken: () => authToken,
      onUnauthenticated: () => {
        authToken = null;
      },
    });
  }
  return client;
}

/** Auth integration point — called by the auth domain after login/refresh. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getStudentRepository(): StudentRepository {
  if (overrides.students) return overrides.students;
  return isApiMode() ? new ApiStudentRepository(getApiClient()) : new DemoStudentRepository();
}

export function getAuthRepository(): AuthRepository {
  if (overrides.auth) return overrides.auth;
  return isApiMode()
    ? new ApiAuthRepository(getApiClient(), (session) => setAuthToken(session?.token ?? null))
    : new DemoAuthRepository();
}

export function getUserRepository(): UserRepository {
  if (overrides.users) return overrides.users;
  return isApiMode() ? new ApiUserRepository(getApiClient()) : new DemoUserRepository();
}

/* Test seams: inject fakes. Pass `undefined` to restore the real selection. */
export function setStudentRepository(repository: StudentRepository | undefined): void {
  overrides.students = repository;
}
export function setAuthRepository(repository: AuthRepository | undefined): void {
  overrides.auth = repository;
}
export function setUserRepository(repository: UserRepository | undefined): void {
  overrides.users = repository;
}

/** Drops memoized instances (used after `setRuntimeConfig`). */
export function resetRegistry(): void {
  client = null;
  authToken = null;
  overrides.students = undefined;
  overrides.auth = undefined;
  overrides.users = undefined;
}
