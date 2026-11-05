import { afterEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { ApiStudentRepository } from "@/domains/students/apiRepository";
import { LocalStudentRepository } from "@/domains/students/localRepository";
import type { StudentRepository } from "@/domains/students/repository";
import { getApiClient, getStudentRepository, resetRegistry, setStudentRepository, studentScopeIsServerEnforced } from "@/domains/registry";

afterEach(() => {
  resetRegistry();
  resetRuntimeConfig();
});

describe("repository selection", () => {
  it("defaults to demo mode", () => {
    expect(getStudentRepository()).toBeInstanceOf(LocalStudentRepository);
  });

  it("returns the API implementation in api mode", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    expect(getStudentRepository()).toBeInstanceOf(ApiStudentRepository);
    expect(getApiClient().baseUrl).toBe("https://backend.test/api/v1");
  });

  it("honours injected test doubles", () => {
    const fake = {} as StudentRepository;
    setStudentRepository(fake);
    expect(getStudentRepository()).toBe(fake);
    setStudentRepository(undefined);
    expect(getStudentRepository()).toBeInstanceOf(LocalStudentRepository);
  });

  it("reports server-enforced student scope only in api mode", () => {
    // Local mode has no server scope, so the view keeps its own T-02 filter.
    expect(studentScopeIsServerEnforced()).toBe(false);
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    // API mode selects ApiStudentRepository, whose list/get are scoped in SQL.
    expect(studentScopeIsServerEnforced()).toBe(true);
  });
});
