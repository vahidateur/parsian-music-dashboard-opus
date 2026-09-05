import { afterEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import { ApiStudentRepository } from "@/domains/students/apiRepository";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import type { StudentRepository } from "@/domains/students/repository";
import { getApiClient, getStudentRepository, resetRegistry, setStudentRepository } from "@/domains/registry";

afterEach(() => {
  resetRegistry();
  resetRuntimeConfig();
});

describe("repository selection", () => {
  it("defaults to demo mode", () => {
    expect(getStudentRepository()).toBeInstanceOf(DemoStudentRepository);
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
    expect(getStudentRepository()).toBeInstanceOf(DemoStudentRepository);
  });
});
