// @vitest-environment jsdom
/**
 * ApiLearningRepository — request construction against a stubbed fetch.
 *
 * Mirrors the students/instruments apiRepository suites: every verb asserts
 * the exact URL, method and body it sends, and the query mappers drop unset
 * params rather than sending them. A rejection surfaces as ApiError with the
 * domain code the server owns — never as a silent empty page.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import {
  ApiLearningRepository,
  toContentQuery,
  toLevelQuery,
  toPlacementQuery,
  toProgramQuery,
} from "@/domains/learning/apiRepository";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiLearningRepository(client) };
}

const page = (items: unknown[]) => ({ data: items, meta: { page: 1, per_page: 25, total: items.length } });

describe("ApiLearningRepository — programs", () => {
  it("GET /learning/programs with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse(page([])));
    await repo.listPrograms({ instrumentId: "violin", activeOnly: true, search: "کلاسیک", page: 1, per_page: 25 });
    const req = requestOf(mock);
    expect(req.url).toBe(
      "https://example.test/api/v1/learning/programs?search=%DA%A9%D9%84%D8%A7%D8%B3%DB%8C%DA%A9&instrumentId=violin&activeOnly=1&page=1&per_page=25",
    );
    expect(req.init.method).toBe("GET");
  });

  it("POST /learning/programs", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "pg_1" } }));
    await repo.createProgram({ instrumentId: "violin", name: "دورهٔ ویولن", description: "", active: true });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/learning/programs");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(
      JSON.stringify({ instrumentId: "violin", name: "دورهٔ ویولن", description: "", active: true }),
    );
  });

  it("PATCH /learning/programs/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "pg_1", name: "تازه" } }));
    const result = await repo.updateProgram("pg_1", { name: "تازه" });
    expect(requestOf(mock).init.method).toBe("PATCH");
    expect(result.name).toBe("تازه");
  });

  it("DELETE /learning/programs/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.deleteProgram("pg 1")).resolves.toBeUndefined();
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/learning/programs/pg%201");
  });

  it("surfaces PROGRAM_HAS_LEVELS as a conflict", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "PROGRAM_HAS_LEVELS", message: "ابتدا سطوح را حذف کنید." } }, 409),
    );
    const error = (await repo.deleteProgram("pg_1").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("PROGRAM_HAS_LEVELS");
  });
});

describe("ApiLearningRepository — levels", () => {
  it("GET /learning/levels filtered by program", async () => {
    const { mock, repo } = harness(() => jsonResponse(page([])));
    await repo.listLevels({ programId: "pg_1", page: 1, per_page: 200 });
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/learning/levels?programId=pg_1&page=1&per_page=200");
  });

  it("POST /learning/levels/{id}/reorder carries the target order", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "lv_1", order: 2 } }));
    const result = await repo.reorderLevel("lv_1", 2);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/learning/levels/lv_1/reorder");
    expect(req.init.body).toBe(JSON.stringify({ order: 2 }));
    expect(result.order).toBe(2);
  });

  it("PATCH never carries order — order moves only through reorder", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "lv_1" } }));
    await repo.updateLevel("lv_1", { name: "سطح تازه" });
    expect(requestOf(mock).init.body).toBe(JSON.stringify({ name: "سطح تازه" }));
  });

  it("omits unset query params", () => {
    expect(toLevelQuery({})).toMatchObject({ programId: undefined, activeOnly: undefined });
    expect(toProgramQuery({ search: "x" })).toMatchObject({ search: "x", instrumentId: undefined });
  });
});

describe("ApiLearningRepository — content and links", () => {
  it("GET /learning/content with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse(page([])));
    await repo.listContent({ type: "pdf", levelId: "lv_1", activeOnly: true, page: 1, per_page: 25 });
    const req = requestOf(mock);
    expect(req.url).toContain("/learning/content?");
    expect(req.url).toContain("type=pdf");
    expect(req.url).toContain("levelId=lv_1");
    expect(req.url).toContain("activeOnly=1");
  });

  it("attaching content sends the caller's program intent", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "lnk_1" } }));
    await repo.attachContent("lv_1", "lc_1", { programId: "pg_1" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/learning/levels/lv_1/links");
    expect(req.init.body).toBe(JSON.stringify({ contentId: "lc_1", programId: "pg_1" }));
  });

  it("surfaces LINK_INVALID when the level belongs to another program", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "LINK_INVALID", message: "با برنامه هم‌خوان نیست." } }, 422),
    );
    const error = (await repo.attachContent("lv_1", "lc_1", { programId: "pg_2" }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("validation");
    expect(error.code).toBe("LINK_INVALID");
  });

  it("listLinks unwraps the bare data array", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [{ id: "lnk_1" }] }));
    const links = await repo.listLinks("lv_1");
    expect(links).toEqual([{ id: "lnk_1" }]);
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/learning/links?levelId=lv_1");
  });
});

describe("ApiLearningRepository — placements and derived reads", () => {
  it("assignPlacement posts to the collection endpoint", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "plc_1" } }));
    await repo.assignPlacement({ studentId: "st_1", programId: "pg_1", levelId: "lv_1" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/learning/placements");
    expect(JSON.parse(req.init.body as string)).toMatchObject({ studentId: "st_1", programId: "pg_1", levelId: "lv_1" });
  });

  it("a missing placement resolves to undefined, not an error", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "PLACEMENT_NOT_FOUND", message: "یافت نشد." } }, 404),
    );
    await expect(repo.getStudentPlacement("st_x")).resolves.toBeUndefined();
  });

  it("other failures still throw", async () => {
    const { repo } = harness(() => jsonResponse({ error: { code: "FORBIDDEN", message: "ندارید." } }, 403));
    const error = (await repo.getStudentPlacement("st_x").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("authorization");
  });

  it("derived reads hit the student-scoped endpoints", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [] }));
    await repo.eligibleContent("st_1");
    expect(requestOf(mock, 0).url).toBe("https://example.test/api/v1/learning/students/st_1/eligible-content");
    await repo.lockedContent("st_1");
    expect(requestOf(mock, 1).url).toBe("https://example.test/api/v1/learning/students/st_1/locked-content");
    await repo.eligibleStudentIds("lc_1");
    expect(requestOf(mock, 2).url).toBe("https://example.test/api/v1/learning/content/lc_1/eligible-students");
  });

  it("omits unset placement query params", () => {
    expect(toPlacementQuery({ studentId: "st_1" })).toMatchObject({ studentId: "st_1", programId: undefined });
    expect(toContentQuery({})).toMatchObject({ type: undefined, levelId: undefined });
  });
});
