/**
 * I16 — the enrollment list forwards `search` to the API.
 *
 * The server searches the related student's name and the class title; the
 * client's only job is to put the term on the wire. `buildQueryString` drops
 * `undefined` values, so an absent term simply does not appear.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiEnrollmentRepository, toQuery } from "@/domains/enrollments/apiRepository";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiEnrollmentRepository(client) };
}

const emptyPage = () => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } });

describe("ApiEnrollmentRepository search", () => {
  it("forwards the term in the list query", async () => {
    const { mock, repo } = harness(emptyPage);
    await repo.list({ search: "آرمین", per_page: 25 });
    expect(requestOf(mock).url).toBe(
      "https://example.test/api/v1/enrollments?per_page=25&search=%D8%A2%D8%B1%D9%85%DB%8C%D9%86",
    );
  });

  it("omits the parameter when no term is supplied", async () => {
    const { mock, repo } = harness(emptyPage);
    await repo.list({ per_page: 25 });
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/enrollments?per_page=25");
  });

  it("keeps the term alongside the existing membership filters", async () => {
    const { mock, repo } = harness(emptyPage);
    await repo.list({ search: "ویولن", status: "active", activeOnly: true });
    const url = requestOf(mock).url;
    expect(url).toContain("search=");
    expect(url).toContain("status=active");
    expect(url).toContain("active=1");
  });

  it("serialises search through toQuery for both states", () => {
    expect(toQuery({ search: "x" }).search).toBe("x");
    expect(toQuery({}).search).toBeUndefined();
  });
});
