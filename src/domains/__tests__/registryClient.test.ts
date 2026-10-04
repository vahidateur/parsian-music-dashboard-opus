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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DOMAIN_UNAVAILABLE } from "@/domains/shared/unavailableRepository";
import { UNAVAILABLE_DOMAINS } from "@/domains/shared/unavailableDomains";
import { ApiAuthRepository } from "@/domains/auth/apiAuthRepository";
import { ApiUserRepository } from "@/domains/auth/userRepository";
import { ApiStudentRepository } from "@/domains/students/apiRepository";
import { ApiTeacherRepository } from "@/domains/teachers/apiRepository";
import { ApiProgressRepository } from "@/domains/progress/apiRepository";
import { ApiOrganizationRepository } from "@/domains/organization/apiRepository";
import { ApiSchedulingRepository } from "@/domains/scheduling/apiRepository";
import { ApiAttendanceRepository } from "@/domains/attendance/apiRepository";
import { ApiLibraryRepository } from "@/domains/library/apiRepository";
import type { ProgressRepository } from "@/domains/progress/repository";
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
    expect(imports).not.toMatch(
      /demoRepository|localRepository|demoUserRepository|localUserRepository|demoRoleRepository|localRoleRepository/,
    );
    expect(imports).not.toMatch(
      /demoStore|localStore|demoCredentials|demoAuthRepository|localAuthRepository/,
    );
    // Non-vacuous: renaming demo repositories to local repositories must not
    // open a client-bundle path. Both the old and the new module names fail.
    expect(/demoStore|localStore/.test('import { localStore } from "@/services/localStore";')).toBe(true);
    expect(
      /demoRepository|localRepository/.test(
        'import { LocalStudentRepository } from "./students/localRepository";',
      ),
    ).toBe(true);
    expect(
      /demoRepository|localRepository/.test(
        'import { DemoStudentRepository } from "./students/demoRepository";',
      ),
    ).toBe(true);
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
  it("UNAVAILABLE_DOMAINS is the single disclosure enumeration (7 ids, no duplicates)", () => {
    const ids = UNAVAILABLE_DOMAINS.map((d) => d.id);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    // Served domains must NOT be disclosed as unavailable. Progress and
    // organization left on 2026-10-03; scheduling, attendance and library left
    // on 2026-10-04 after their contracts were verified (and, for attendance,
    // after the server was corrected to emit the authoritative keys).
    for (const served of ["progress", "organization", "scheduling", "attendance", "library"]) {
      expect(ids).not.toContain(served);
    }
    // The still-unserved domains remain disclosed, never silently dropped.
    expect(ids).toContain("instruments");
    expect(ids).toContain("learning");
    expect(ids).toContain("chat");
    expect(ids).toContain("media");
    expect(ids).toContain("branding");
    expect(ids).toContain("gallery");
    expect(ids).toContain("compensation");
  });

  it("every unavailable id has a getter whose every call rejects with DOMAIN_UNAVAILABLE", async () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    const getters: Record<string, () => object> = {
      instruments: client.getInstrumentRepository,
      learning: client.getLearningRepository,
      chat: client.getChatRepository,
      media: client.getMediaRepository,
      branding: client.getBrandingRepository,
      gallery: client.getGalleryRepository,
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

  it("served-since-2026-10-03 coverage — progress and organization are NEVER unavailable", async () => {
    // The two domains the backend began serving are the ones most likely to be
    // silently re-listed if someone edits the enumeration by hand.
    expect(UNAVAILABLE_DOMAINS.map((d) => d.id)).toEqual(
      expect.not.arrayContaining(["progress", "organization"]),
    );
    expect(client.DEMO_SERVED_DOMAINS.map((d) => d.id)).toEqual([]);
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

  /**
   * Progress and organization joined the served set on 2026-10-03; scheduling,
   * attendance and library on 2026-10-04. The point of these assertions is the
   * failure mode they prevent: a domain that reverts to the unavailable stub
   * still typechecks and still builds, so only an explicit instance check
   * catches it.
   */
  it("every served domain resolves to its Api repository, not the unavailable stub", async () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });

    expect(client.getProgressRepository()).toBeInstanceOf(ApiProgressRepository);
    expect(client.getOrganizationRepository()).toBeInstanceOf(ApiOrganizationRepository);
    expect(client.getSchedulingRepository()).toBeInstanceOf(ApiSchedulingRepository);
    expect(client.getAttendanceRepository()).toBeInstanceOf(ApiAttendanceRepository);
    expect(client.getLibraryRepository()).toBeInstanceOf(ApiLibraryRepository);

    // Not the stub: the stub rejects every call, the real repository must not.
    // A rejection here is a network failure against a fixture base URL, never
    // DOMAIN_UNAVAILABLE — that code can only come from the stub.
    await expect(client.getProgressRepository().listPieces()).not.rejects.toMatchObject({
      code: DOMAIN_UNAVAILABLE,
    });
    await expect(client.getOrganizationRepository().get()).not.rejects.toMatchObject({
      code: DOMAIN_UNAVAILABLE,
    });
    await expect(client.getSchedulingRepository().list()).not.rejects.toMatchObject({
      code: DOMAIN_UNAVAILABLE,
    });
    await expect(client.getAttendanceRepository().list()).not.rejects.toMatchObject({
      code: DOMAIN_UNAVAILABLE,
    });
    await expect(client.getLibraryRepository().list()).not.rejects.toMatchObject({
      code: DOMAIN_UNAVAILABLE,
    });
  });

  it("an explicit override still wins over the wired Api repository", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://backend.test/api/v1" });
    const stub = {
      listPieces: async () => ({ items: [], page: 1, perPage: 25, total: 0 }),
    } as unknown as ProgressRepository;

    client.setProgressRepository(stub);
    expect(client.getProgressRepository()).toBe(stub);
  });
});

describe("the two registries stay separate", () => {
  const demoRegistry = join(process.cwd(), "src", "domains", "registry.ts");
  const clientRegistry = join(process.cwd(), "src", "domains", "registry.client.ts");

  it("does not merge registry.ts into registry.client.ts or add a third registry", () => {
    const demo = readFileSync(demoRegistry, "utf8");
    const clientSource = readFileSync(clientRegistry, "utf8");
    expect(demo).not.toBe(clientSource);
    expect(clientSource).not.toMatch(/export\s+\*\s+from\s+["']\.\/registry["']/);
    expect(demo).not.toMatch(/export\s+\*\s+from\s+["']\.\/registry\.client["']/);
    expect(existsSync(join(process.cwd(), "src", "domains", "registry.customer.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src", "domains", "registry.operator.ts"))).toBe(false);
    expect(/export\s+\*\s+from\s+["']\.\/registry["']/.test('export * from "./registry";')).toBe(true);
  });

  it("aliases the client build to registry.client.ts and has no dynamic demo import", () => {
    const vite = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    expect(vite).toContain('path.resolve(__dirname, "src/domains/registry.client.ts")');
    expect(vite).toMatch(/APP_TARGET === "client"/);
    expect(vite).not.toMatch(/APP_TARGET === "(?:operator|customer)"/);
    expect(source()).not.toMatch(/\bimport\s*\(/);
    expect(/\bimport\s*\(/.test('import("@/domains/demo/demoDataManager")')).toBe(true);
  });
});
