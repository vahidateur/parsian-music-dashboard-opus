import { ApiClient } from "@/api/client";
import { getRuntimeConfig } from "@/api/config";
import { ApiStudentRepository } from "./students/apiRepository";
import { DemoStudentRepository } from "./students/demoRepository";
import type { StudentRepository } from "./students/repository";

/**
 * Composition root. The only place in the app that decides whether a domain is
 * served by the DemoStore or by the HTTP API. Views depend on
 * `getStudentRepository()`, never on a concrete class.
 */

let client: ApiClient | null = null;
let authToken: string | null = null;
const overrides: { students?: StudentRepository } = {};

export function getApiClient(): ApiClient {
  if (!client) {
    client = new ApiClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getToken: () => authToken,
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
  return getRuntimeConfig().mode === "api"
    ? new ApiStudentRepository(getApiClient())
    : new DemoStudentRepository();
}

/** Test seam: inject a fake implementation. Pass `undefined` to restore. */
export function setStudentRepository(repository: StudentRepository | undefined): void {
  overrides.students = repository;
}

/** Drops memoized instances (used after `setRuntimeConfig`). */
export function resetRegistry(): void {
  client = null;
  authToken = null;
  overrides.students = undefined;
}
