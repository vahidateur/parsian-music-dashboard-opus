// @vitest-environment jsdom
/**
 * ApiInstrumentRepository — request construction against a stubbed fetch.
 *
 * Mirrors the students apiRepository suite: every verb asserts the exact URL,
 * method and body it sends, and the query mapper drops unset params rather
 * than sending them. A rejection from the server surfaces as ApiError, never
 * as a silent empty page.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { ApiInstrumentRepository, toQuery } from "@/domains/instruments/apiRepository";
import type { CreateInstrumentInput } from "@/domains/instruments/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiInstrumentRepository(client) };
}

describe("ApiInstrumentRepository request construction", () => {
  it("GET /instruments with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ search: "زهی", activeOnly: true, page: 2, per_page: 25 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/instruments?search=%D8%B2%D9%87%DB%8C&activeOnly=1&page=2&per_page=25");
    expect(req.init.method).toBe("GET");
  });

  it("omits the activeOnly flag when not requested", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ search: "پیانو" });
    const req = requestOf(mock);
    expect(req.url).not.toContain("activeOnly");
  });

  it("GET /instruments/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "violin" } }));
    await repo.get("violin");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/instruments/violin");
  });

  it("POST /instruments", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "santoor" } }));
    await repo.create({ name: "سنتور", slug: "santoor", description: "", active: true } as unknown as CreateInstrumentInput);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/instruments");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(
      JSON.stringify({ name: "سنتور", slug: "santoor", description: "", active: true }),
    );
  });

  it("PATCH /instruments/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "violin", name: "ویولن (زهی)" } }));
    const result = await repo.update("violin", { name: "ویولن (زهی)" });
    const req = requestOf(mock);
    expect(req.init.method).toBe("PATCH");
    expect(req.init.body).toBe(JSON.stringify({ name: "ویولن (زهی)" }));
    expect(result.name).toBe("ویولن (زهی)");
  });

  it("POST /instruments/{id}/active", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "drums", active: false } }));
    const result = await repo.setActive("drums", false);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/instruments/drums/active");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ active: false }));
    expect(result.active).toBe(false);
  });

  it("DELETE /instruments/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.delete("sant oor")).resolves.toBeUndefined();
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/instruments/sant%20oor");
    expect(req.init.method).toBe("DELETE");
  });

  it("surfaces a referenced-instrument refusal as ApiError", async () => {
    const { repo } = harness(
      () => jsonResponse({ error: { code: "INSTRUMENT_IN_USE", message: "در برنامه‌های آموزشی استفاده شده است." } }, 409),
    );
    const error = (await repo.delete("piano").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("INSTRUMENT_IN_USE");
  });

  it("surfaces backend errors as ApiError", async () => {
    const { repo } = harness(() => jsonResponse({ error: { code: "INSTRUMENT_NOT_FOUND", message: "not found" } }, 404));
    const error = (await repo.get("nope").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("INSTRUMENT_NOT_FOUND");
  });

  it("omits unset query params", () => {
    expect(toQuery({ search: "x" })).toMatchObject({ search: "x", activeOnly: undefined });
  });
});
