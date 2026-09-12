import { describe, expect, it, vi } from "vitest";
import { ApiClient, buildQueryString, joinUrl, type ApiClientConfig } from "@/api/client";
import { ApiError } from "@/api/errors";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchMock } from "@/test/fetchMock";

function makeClient(mock: FetchMock, extra: Partial<ApiClientConfig> = {}) {
  return new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock), ...extra });
}

describe("buildQueryString", () => {
  it("skips empty values and serializes arrays", () => {
    expect(buildQueryString({ a: 1, b: undefined, c: null, d: "", e: ["x", "y"], f: false })).toBe(
      "?a=1&e%5B%5D=x&e%5B%5D=y&f=false",
    );
  });
  it("returns an empty string with no params", () => {
    expect(buildQueryString(undefined)).toBe("");
  });
});

describe("joinUrl", () => {
  it("joins without duplicating slashes", () => {
    expect(joinUrl("https://x.test/api/v1/", "/students")).toBe("https://x.test/api/v1/students");
  });
  it("passes absolute urls through", () => {
    expect(joinUrl("https://x.test", "https://other.test/a")).toBe("https://other.test/a");
  });
});

describe("ApiClient success", () => {
  it("unwraps the data envelope", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: { id: "stu_1" } }));
    await expect(makeClient(mock).get<{ id: string }>("students/stu_1")).resolves.toEqual({ id: "stu_1" });
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/students/stu_1");
  });

  it("sends query parameters and the auth header", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: [], meta: { page: 2, per_page: 10, total: 40 } }));
    const client = makeClient(mock, { getToken: () => "tok_1" });
    const page = await client.getPage("students", { query: { search: "ali", page: 2, per_page: 10, status: undefined } });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/students?search=ali&page=2&per_page=10");
    expect(req.headers.Authorization).toBe("Bearer tok_1");
    expect(page.meta).toEqual({ page: 2, per_page: 10, total: 40 });
  });

  it("serializes JSON bodies for POST", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: { id: "stu_2" } }));
    await makeClient(mock).post("students", { name: "علی" });
    const req = requestOf(mock);
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ name: "علی" }));
    expect(req.headers["Content-Type"]).toBe("application/json");
  });

  it("handles 204 responses", async () => {
    const mock = createFetchMock(() => new Response(null, { status: 204 }));
    await expect(makeClient(mock).delete("students/stu_1")).resolves.toBeUndefined();
  });

  it("derives page meta when the backend omits it", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: [{ id: "a" }, { id: "b" }] }));
    const page = await makeClient(mock).getPage("students", { query: { page: 1, per_page: 25 } });
    expect(page.meta).toEqual({ page: 1, per_page: 25, total: 2 });
  });
});

describe("ApiClient error normalization", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [401, "authentication"],
    [403, "authorization"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [500, "server"],
    [418, "unknown"],
  ];

  for (const [status, kind] of cases) {
    it(`maps ${status} to ${kind}`, async () => {
      const mock = createFetchMock(() => jsonResponse({ error: { message: "boom" } }, status));
      const error = (await makeClient(mock).get("students").catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe(kind);
      expect(error.status).toBe(status);
      expect(error.message).toBe("boom");
    });
  }

  it("preserves domain conflict codes", async () => {
    const body = { error: { code: "SCHEDULE_VERSION_CONFLICT", message: "The session was modified by another user." } };
    const mock = createFetchMock(() => jsonResponse(body, 409));
    const error = (await makeClient(mock).patch("sessions/ses_1", {}).catch((e: unknown) => e)) as ApiError;
    expect(error.isConflict("SCHEDULE_VERSION_CONFLICT")).toBe(true);
    expect(error.isConflict("OTHER")).toBe(false);
    expect(error.message).toBe("The session was modified by another user.");
  });

  it("exposes validation field errors", async () => {
    const mock = createFetchMock(() => jsonResponse({ errors: [{ code: "VALIDATION", fields: { name: ["الزامی است"] } }] }, 422));
    const error = (await makeClient(mock).post("students", {}).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("validation");
    expect(error.fields).toEqual({ name: ["الزامی است"] });
  });

  it("normalizes transport failures to a network error", async () => {
    const mock = createFetchMock(() => {
      throw new TypeError("Failed to fetch");
    });
    const error = (await makeClient(mock).get("students").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("network");
    expect(error.retryable).toBe(true);
  });

  it("normalizes aborts to a cancelled error", async () => {
    const controller = new AbortController();
    const mock = createFetchMock(() => {
      throw new DOMException("aborted", "AbortError");
    });
    controller.abort();
    const error = (await makeClient(mock).get("students", { signal: controller.signal }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("cancelled");
  });

  it("falls back to a localized message when the body has none", async () => {
    const mock = createFetchMock(() => jsonResponse({}, 403));
    const error = (await makeClient(mock).get("students").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("authorization");
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("calls onUnauthenticated for 401", async () => {
    const onUnauthenticated = vi.fn();
    const mock = createFetchMock(() => jsonResponse({ error: { message: "no" } }, 401));
    await makeClient(mock, { onUnauthenticated }).get("auth/me").catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
