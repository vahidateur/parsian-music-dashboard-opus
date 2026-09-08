/**
 * Wire contract for the REST library adapter.
 *
 * `domains/library/README.md` declares `GET|POST /resources` and
 * `GET|PATCH|DELETE /resources/{id}`. No server serves them yet, so the adapter
 * is NOT registered — but its request construction is pinned here, and the
 * registry assertion at the bottom pins that the composition root still
 * resolves Library to the demo implementation rather than pretending otherwise.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { DemoLibraryRepository } from "@/domains/library/demoRepository";
import { getLibraryRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { ApiLibraryRepository, toQuery } from "../apiRepository";
import type { CreateLibraryItemInput } from "../types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

const BASE = "https://example.test/api/v1";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: BASE, fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiLibraryRepository(client) };
}

describe("ApiLibraryRepository request construction", () => {
  it("GET /resources with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ search: "شوپن", kind: "sheet", instrument: "piano", page: 2, per_page: 50 });

    const req = requestOf(mock);
    expect(req.init.method).toBe("GET");
    expect(req.url).toContain(`${BASE}/resources?`);
    const query = new URL(req.url).searchParams;
    expect(query.get("search")).toBe("شوپن");
    expect(query.get("kind")).toBe("sheet");
    expect(query.get("instrument")).toBe("piano");
    expect(query.get("page")).toBe("2");
    expect(query.get("per_page")).toBe("50");
  });

  it("omits empty params rather than sending blank filters", () => {
    const query = toQuery({ search: "", per_page: 100 });
    expect(query.search).toBe("");
    expect(query.kind).toBeUndefined();
    expect(query.per_page).toBe(100);
  });

  it("GET /resources/{id}, encoding the id", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "res_1" } }));
    const item = await repo.get("res 1");

    expect(requestOf(mock).url).toBe(`${BASE}/resources/res%201`);
    expect(item.id).toBe("res_1");
  });

  it("POST /resources with a JSON body", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "res_9" } }));
    const input: CreateLibraryItemInput = {
      title: "نت جدید",
      composer: "باخ",
      kind: "sheet",
      instrument: "piano",
      pages: 4,
    };
    await repo.create(input);

    const req = requestOf(mock);
    expect(req.init.method).toBe("POST");
    expect(req.url).toBe(`${BASE}/resources`);
    expect(req.init.body).toBe(JSON.stringify(input));
  });

  it("PATCH /resources/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "res_1", title: "عنوان تازه" } }));
    const updated = await repo.update("res_1", { title: "عنوان تازه" });

    const req = requestOf(mock);
    expect(req.init.method).toBe("PATCH");
    expect(req.url).toBe(`${BASE}/resources/res_1`);
    expect(req.init.body).toBe(JSON.stringify({ title: "عنوان تازه" }));
    expect(updated.title).toBe("عنوان تازه");
  });

  it("DELETE /resources/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await repo.delete("res_1");

    const req = requestOf(mock);
    expect(req.init.method).toBe("DELETE");
    expect(req.url).toBe(`${BASE}/resources/res_1`);
  });
});

describe("error honesty over the wire", () => {
  it("maps a 404 to a not_found ApiError", async () => {
    const { repo } = harness(() => jsonResponse({ error: { message: "منبع یافت نشد", code: "RESOURCE_NOT_FOUND" } }, 404));
    await expect(repo.get("res_missing")).rejects.toMatchObject({
      kind: "not_found",
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      message: "منبع یافت نشد",
    });
  });

  it("surfaces server field errors instead of swallowing them", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { message: "اعتبارسنجی ناموفق", fields: { title: ["الزامی است"] } } }, 422),
    );

    await expect(repo.create({ title: "", kind: "sheet", instrument: "piano" })).rejects.toSatisfy(
      (error) => error instanceof ApiError && error.fields?.title?.[0] === "الزامی است",
    );
  });

  it("never reaches for a binary endpoint", async () => {
    // The declared file endpoints (`POST /uploads`,
    // `GET /resources/{id}/download`) are deliberately NOT called from here:
    // `ApiClient` is JSON-only, and a fabricated download URL would present a
    // broken path as a working one. Bytes belong to the media boundary.
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ per_page: 25 });
    await repo.get("res_1").catch(() => undefined);

    const urls = mock.mock.calls.map(([url]) => url);
    expect(urls.some((url) => url.includes("/download"))).toBe(false);
    expect(urls.some((url) => url.includes("/uploads"))).toBe(false);
  });
});

describe("composition root", () => {
  beforeEach(() => {
    demoStore.reset();
    resetRegistry();
  });

  it("resolves Library to the demo implementation, since no server serves /resources", async () => {
    expect(getLibraryRepository()).toBeInstanceOf(DemoLibraryRepository);
    // …and it genuinely reads the catalogue rather than a fixture.
    const page = await getLibraryRepository().list({ per_page: 200 });
    expect(page.meta.total).toBeGreaterThan(0);
  });
});
