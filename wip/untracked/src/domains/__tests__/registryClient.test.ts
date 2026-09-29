/**
 * Client composition root — Phase 2A build-separation contract.
 *
 * `registry.client.ts` is the client target's selection layer (the demo
 * target uses `registry.ts`; `vite.config.ts` aliases the specifier per
 * APP_TARGET). Its own header promises three things this file asserts:
 *
 *   1. SOURCE BOUNDARY — it imports no demo repository, no demo store, no
 *      seed and no demo credentials: only Api implementations, explicit
 *      unavailable stubs and shared plumbing from `./registryCore`;
 *   2. EXPLICIT UNAVAILABLE — every id in `UNAVAILABLE_DOMAINS` has a getter
 *      whose repository rejects every call with `DOMAIN_UNAVAILABLE` (never
 *      demo data, never a speculative endpoint), and `organization` is one of
 *      them (the domain with no served implementation in this composition);
 *   3. COMPOSITION PARITY — the export-compatible `DEMO_SERVED_DOMAINS` stub
 *      is empty (nothing is demo-served here), and the served getters resolve
 *      to the same Api classes the demo composition selects in `api` mode.
 *
 * The complementary BUNDLE assertion (strings in the real `dist/client`
 * output, both negative and positive) lives in
 * `src/__tests__/bundleBoundary.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DOMAIN_UNAVAILABLE } from "@/domains/shared/unavailableRepository";
import { UNAVAILABLE_DOMAINS } from "@/domains/shared/unavailableDomains";
import { ApiAuthRepository } from "@/domains/auth/apiAuthRepository";
import { ApiUserRepository } from "@/domains/auth/userRepository";
import { ApiStudentRepository } from "@/domains/students/apiRepository";
import { ApiTeacherRepository } from "@/domains/teachers/apiRepository";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import * as client from "@/domains/registry.client";

const CLIENT_ROOT = join(process.cwd(), "src", "domains", "registry.client.ts");

afterEach(() => {
  client.resetRegistry();
  resetRuntimeConfig();
});

function source(): string {
  return readFileSync(CLIENT_ROOT, "utf8");
}

function importLines(): string[] {
  return source()
    .split("\n")
    .filter((line) => /^import\b|^} from\b|^\s+.*from\b/.test(line) && !line.trimStart().startsWith("*"));
}

describe("source boundary — no demo capability in the client composition", () => {
  it("never imports a demo repository, the demo store, a seed, or demo credentials", () => {
    const imports = importLines().join("\n");
    expect(imports).not.toMatch(/demoRepository|demoUserRepository|demoRoleRepository/);
    expect(imports).not.toMatch(/demoStore|demoCredentials|demoAuthRepository/);
    expect(imports).not.toMatch(/\/seed|gallerySeed|academySeed|createSeedDataset/);
    // and not through the shared barrel either — the client resolves the
    // unavailable stubs, never a demo module.
    expect(imports).not.toMatch(/@\/domains\/demo\b|@\/domains\/auth\/demo/);
  });

  it("keeps the shared plumbing import to registryCore only", () => {
    const imports = importLines().join("\n");
    expect(imports).toMatch(/from "\.\/registryCore"/);
    expect(imports).not.toMatch(/from "\.\/registry"/);
  });
});

describe("explicit unavailable — DOMAIN_UNAVAILABLE, never demo data", () => {
  it("UNAVAILABLE_DOMAINS is the single disclosure enumeration (12 ids, no duplicates)", () => {
    const ids = UNAVAILABLE_DOMAINS.map((d) => d.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(ids.length);
    // organization has no served implementation in this composition and must
    // be disclosed, not silently dropped.
    expect(ids).toContain("organization");
  });

  it("every unavailable id has a getter whose every call rejects with DOMAIN_UNAVAILABLE", async () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    const getters: Record<string, () => object> = {
      instruments: client.getInstrumentRepository,
      learning: client.getLearningRepository,
      chat: client.getChatRepository,
      media: client.getMediaRepository,
      library: client.getLibraryRepository,
      branding: client.getBrandingRepository,
      organization: client.getOrganizationRepository,
      gallery: client.getGalleryRepository,
      progress: client.getProgressRepository,
      scheduling: client.getSchedulingRepository,
      attendance: client.getAttendanceRepository,
      compensation: client.getCompensationRepository,
    };
    expect(Object.keys(getters).sort()).toEqual([...UNAVAILABLE_DOMAINS.map((d) => d.id)].sort());

    for (const [id, get] of Object.entries(getters)) {
      const repo = get() as { list: () => Promise<unknown>; get: (id: string) => Promise<unknown> };
      await expect(repo.list()).rejects.toMatchObject({
        name: "ApiError",
        code: DOMAIN_UNAVAILABLE,
      });
      // a second, different method — the proxy rejects uniformly
      await expect(repo.get("anything")).rejects.toMatchObject({ code: DOMAIN_UNAVAILABLE });
      const message = await repo.list().catch((error: Error) => error.message);
      expect(message).toContain(id);
      expect(message).toContain("متصل نیست");
    }
  });

  it("organization coverage — the org domain reports unavailable, never demo fallback", async () => {
    const org = client.getOrganizationRepository();
    await expect(org.get()).rejects.toMatchObject({ code: DOMAIN_UNAVAILABLE });
    expect(client.DEMO_SERVED_DOMAINS.map((d) => d.id)).not.toContain("organization");
  });
});

describe("composition parity — served domains are the real Api classes", () => {
  it("DEMO_SERVED_DOMAINS is an empty export-compat stub (nothing is demo-served here)", () => {
    expect(client.DEMO_SERVED_DOMAINS).toEqual([]);
  });

  it("served getters resolve to Api implementations, same as demo's api mode", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    expect(client.getAuthRepository()).toBeInstanceOf(ApiAuthRepository);
    expect(client.getUserRepository()).toBeInstanceOf(ApiUserRepository);
    expect(client.getStudentRepository()).toBeInstanceOf(ApiStudentRepository);
    expect(client.getTeacherRepository()).toBeInstanceOf(ApiTeacherRepository);
    expect(client.getApiClient().baseUrl).toBe("https://backend.test/api/v1");
  });
});
