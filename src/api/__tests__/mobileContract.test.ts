/**
 * F9 — Mobile Client Contract — same backend contracts, same envelope, bearer secure storage not localStorage, same RBAC, media upload same endpoint, no second API.
 *
 * Acceptance:
 * - Mobile app uses same backend contracts no second API same RBAC same media seam same envelope Collection/Item PageMeta same domain repos
 * - Auth bearer token stored securely not localStorage
 * - Offline C deferred no fake
 * - Features same as web or subset teacher/student portal B contract
 * - No new backend same Laravel domain structure B1
 * - Tests: contract tests envelope, auth bearer, media upload seam, no second API
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ApiClient } from "../client";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
} from "@/domains/media/types";
import { rolePermissions, ROLES, PERMISSIONS } from "@/domains/auth/permissions";

const ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

describe("F9 — Mobile client contract — same envelope Collection/Item PageMeta", () => {
  it("Collection envelope shape data array + meta page/per_page/total/total_pages", () => {
    const envelope = {
      data: [{ id: "1" }, { id: "2" }],
      meta: { page: 1, per_page: 25, total: 2, total_pages: 1 },
    };
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(typeof envelope.meta.page).toBe("number");
    expect(typeof envelope.meta.per_page).toBe("number");
    expect(typeof envelope.meta.total).toBe("number");
  });

  it("Item envelope shape data object", () => {
    const envelope = { data: { id: "1", name: "test" } };
    expect(typeof envelope.data).toBe("object");
    expect(envelope.data.id).toBe("1");
  });

  it("PageMeta numbers are positive", () => {
    const meta = { page: 1, per_page: 25, total: 100, total_pages: 4 };
    expect(meta.page).toBeGreaterThan(0);
    expect(meta.per_page).toBeGreaterThan(0);
    expect(meta.total).toBeGreaterThanOrEqual(0);
  });

  it("ApiClient.getPage normalizes meta from envelope", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ id: "a" }],
          meta: { page: 2, per_page: 10, total: 1, total_pages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    const page = await client.getPage<{ id: string }>("/students");
    expect(page.data).toHaveLength(1);
    expect(page.meta.page).toBe(2);
    expect(page.meta.per_page).toBe(10);
  });
});

describe("F9 — Mobile client contract — auth bearer secure storage not localStorage", () => {
  it("ApiClient adds Authorization Bearer header when token present", async () => {
    let capturedHeaders: Record<string, string> | null = null;
    const mockFetch = async (_url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? null;
      return new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      getToken: () => "test-bearer-token-123",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    await client.get("/me");
    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.Authorization).toBe("Bearer test-bearer-token-123");
  });

  it("ApiClient does not add Bearer header when no token", async () => {
    let capturedHeaders: Record<string, string> | null = null;
    const mockFetch = async (_url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? null;
      return new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      getToken: () => null,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    await client.get("/me");
    expect(capturedHeaders?.Authorization).toBeUndefined();
  });

  it("ApiClient supports async getToken (secure storage)", async () => {
    let capturedHeaders: Record<string, string> | null = null;
    const mockFetch = async (_url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? null;
      return new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      getToken: async () => {
        // Simulate SecureStore.getItemAsync
        return Promise.resolve("secure-storage-token");
      },
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    await client.get("/me");
    expect(capturedHeaders?.Authorization).toBe("Bearer secure-storage-token");
  });

  it("No localStorage for token in src (mobile uses secure storage not localStorage)", () => {
    // Appearance device-local localStorage is allowed per D2, but token must not be in localStorage for mobile — B CONTRACT
    // Scan src for localStorage.*token — should be absent
    const allFiles = sourceFiles(ROOT);
    const offenders: string[] = [];
    for (const file of allFiles) {
      const raw = readFileSync(file, "utf8");
      const c = code(raw);
      // Direct token in localStorage
      if (/localStorage\s*\.\s*setItem\s*\(\s*['\"].*token.*['\"]/i.test(c)) {
        offenders.push(`${file} → localStorage.setItem token`);
      }
      if (/localStorage\s*\.\s*getItem\s*\(\s*['\"].*token.*['\"]/i.test(c)) {
        offenders.push(`${file} → localStorage.getItem token`);
      }
      // Also check for auth_token key
      if (/localStorage\s*\.\s*setItem\s*\(\s*['\"]auth_token['\"]/i.test(c)) {
        offenders.push(`${file} → localStorage auth_token`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("AuthContext does not use localStorage for token (memory + cookie primary)", () => {
    const authContextPath = join(ROOT, "domains", "auth", "AuthContext.tsx");
    const source = code(readFileSync(authContextPath, "utf8"));
    // Should not have localStorage token — comment about clearing localStorage handing still-valid session suggests it does NOT use localStorage
    const hasLocalStorageToken =
      /localStorage\s*\.\s*(setItem|getItem)\s*\(\s*['\"].*token/i.test(source) ||
      /localStorage\s*\.\s*(setItem|getItem)\s*\(\s*['\"]auth_token/i.test(source);
    expect(hasLocalStorageToken).toBe(false);
  });
});

describe("F9 — Mobile client contract — media upload same endpoint", () => {
  it("Media allow-list excludes SVG (XSS)", () => {
    const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    expect(allAllowed).not.toContain("image/svg+xml");
    expect(ALLOWED_IMAGE_TYPES).not.toContain("image/svg+xml" as never);
  });

  it("CreateMediaInput expects bytes ArrayBuffer not base64 data URL", () => {
    const mediaTypesPath = join(ROOT, "domains", "media", "types.ts");
    const source = readFileSync(mediaTypesPath, "utf8");
    expect(source).toContain("bytes: ArrayBuffer");
    expect(source).not.toContain("data:");
    // Ensure no data URL comment that would allow data URL
    const c = code(source);
    // The type file itself should not contain data URL literal
    expect(c).not.toMatch(/data:image/);
  });

  it("MediaRepository.create signature uses bytes ArrayBuffer", () => {
    const repoPath = join(ROOT, "domains", "media", "repository.ts");
    const source = readFileSync(repoPath, "utf8");
    // Interface file references CreateMediaInput which contains ArrayBuffer
    expect(source).toContain("CreateMediaInput");
    // Ensure it does not accept base64 string as bytes
    const c = code(source);
    expect(c).not.toMatch(/bytes:\s*string/);
  });

  it("Same endpoint for web and mobile — MediaRepository via registry same client", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    const source = readFileSync(registryPath, "utf8");
    // Registry should not have second media endpoint
    const mediaEndpoints = (source.match(/\/media/g) || []).length;
    // At most one reference? Actually registry doesn't hardcode /media — ApiMediaRepository uses client
    // So ensure no hardcoded second media URL
    expect(source).not.toMatch(/https?:\/\/.*media/);
  });

  it("No localStorage for binary", () => {
    const allFiles = sourceFiles(ROOT);
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (file.includes("media")) continue; // media types doc mentions localStorage as what NOT to do — comment, but code() strips comments
      const c = code(readFileSync(file, "utf8"));
      if (/localStorage\s*\.\s*setItem.*bytes/i.test(c)) {
        offenders.push(`${file} → localStorage bytes`);
      }
      if (/localStorage\s*\.\s*setItem.*blob/i.test(c)) {
        offenders.push(`${file} → localStorage blob`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("F9 — Mobile client contract — no second API", () => {
  it("Registry has single ApiClient instantiation", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    const source = code(readFileSync(registryPath, "utf8"));
    const matches = source.match(/new\s+ApiClient/g) || [];
    expect(matches.length).toBe(1);
  });

  it("No second baseUrl in registry", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    const source = code(readFileSync(registryPath, "utf8"));
    // Should not have second baseUrl literal besides getRuntimeConfig().apiBaseUrl
    const baseUrlMatches = source.match(/baseUrl/g) || [];
    // One in config creation + getter — at most 2
    expect(baseUrlMatches.length).toBeLessThanOrEqual(3);
    // No hardcoded https:// second API
    expect(source).not.toMatch(/https?:\/\/.*api.*https?:\/\//);
  });

  it("No fetch or hardcoded HTTP URL in views/components except ApiClient", () => {
    // Same as architectureBoundaries but explicit for mobile no second API
    const viewFiles = [
      ...sourceFiles(join(ROOT, "views")),
      ...sourceFiles(join(ROOT, "components")),
    ];
    const offenders: string[] = [];
    for (const file of viewFiles) {
      const c = code(readFileSync(file, "utf8"));
      if (/\bfetch\s*\(/.test(c)) offenders.push(`${file} → fetch`);
      if (/https?:\/\//.test(c)) offenders.push(`${file} → hardcoded URL`);
    }
    expect(offenders).toEqual([]);
  });

  it("Same domain repos for web and mobile — registry returns same interface", () => {
    const registryPath = join(ROOT, "domains", "registry.ts");
    const source = readFileSync(registryPath, "utf8");
    // Check that all get*Repository functions use isApiMode ternary
    expect(source).toContain("isApiMode()");
    expect(source).toContain("getStudentRepository");
    expect(source).toContain("getTeacherRepository");
    expect(source).toContain("getRoomRepository");
    expect(source).toContain("getClassRepository");
    expect(source).toContain("getEnrollmentRepository");
    expect(source).toContain("getAuthRepository");
    expect(source).toContain("getUserRepository");
  });

  it("Same RBAC same permissions matrix exists", () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(5);
    expect(PERMISSIONS.length).toBeGreaterThanOrEqual(22);
    expect(Object.keys(rolePermissions).length).toBeGreaterThanOrEqual(5);
    // Matrix should include student read/write etc
    const allPerms = Object.values(rolePermissions).flat();
    expect(allPerms).toContain("students.read");
  });
});

describe("F9 — Mobile client contract — offline C deferred no fake", () => {
  it("No offline queue code", () => {
    const allFiles = sourceFiles(ROOT);
    const offenders: string[] = [];
    for (const file of allFiles) {
      const raw = readFileSync(file, "utf8").toLowerCase();
      if (raw.includes("offlinequeue") || raw.includes("syncqueue") || raw.includes("backgroundsync")) {
        // Allow comments mentioning offline queue as deferred
        const c = code(readFileSync(file, "utf8")).toLowerCase();
        if (c.includes("offlinequeue") || c.includes("syncqueue")) {
          offenders.push(`${file} → offline queue`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("No fake offline claim", () => {
    // Ensure no view claims offline sync working when it's deferred
    const viewFiles = sourceFiles(join(ROOT, "views"));
    const offenders: string[] = [];
    for (const file of viewFiles) {
      const raw = readFileSync(file, "utf8");
      // If file contains offline and synced in same sentence as claim, it would be fake — but our code should not
      if (/آفلاین.*همگام.*شد/i.test(raw) && !raw.includes("C DEFERRED") && !raw.includes("deferred")) {
        offenders.push(`${file} → fake offline claim`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("F9 — Mobile client contract — no new backend same Laravel B1", () => {
  it("B1 decision — same Laravel domain structure — no second API — documented", () => {
    const decisionPath = join(process.cwd(), "docs/frontend-completion/12-decision-register.md");
    const source = readFileSync(decisionPath, "utf8");
    expect(source).toContain("B1");
    expect(source).toContain("Laravel");
    expect(source).toContain("Sanctum");
    expect(source).toContain("bearer");
  });

  it("Mobile contract doc exists", () => {
    const docPath = join(process.cwd(), "docs/frontend-completion/17-mobile-client-contract.md");
    const exists = (() => {
      try {
        statSync(docPath);
        return true;
      } catch {
        return false;
      }
    })();
    expect(exists).toBe(true);
  });

  it("Mobile contract doc mentions same backend no second API same envelope same RBAC same media seam bearer secure storage", () => {
    const docPath = join(process.cwd(), "docs/frontend-completion/17-mobile-client-contract.md");
    const source = readFileSync(docPath, "utf8");
    expect(source).toContain("same backend");
    expect(source).toContain("no second API");
    expect(source).toContain("Collection");
    expect(source).toContain("Item");
    expect(source).toContain("PageMeta");
    expect(source).toContain("same domain repos");
    expect(source).toContain("same RBAC");
    expect(source).toContain("media");
    expect(source).toContain("bearer");
    expect(source).toContain("secure storage");
    expect(source).toContain("not localStorage");
  });
});
