// @vitest-environment jsdom
/**
 * ApiBrandingRepository — request construction against a stubbed fetch, and the
 * shared-invalidation contract: a write the server accepted bumps the data
 * version so every branding reader (sidebar, top bar, hero, panel) re-reads;
 * a refused write changes nothing.
 *
 * The version bump is what keeps the client composition honest. The demo
 * composition refreshes through the store subscription; the API composition
 * has no store, so without the bump a panel would keep showing the identity
 * from before the write. Every served domain follows this rule (§38 here).
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiBrandingRepository } from "@/domains/branding/apiRepository";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiBrandingRepository(client) };
}

describe("ApiBrandingRepository request construction", () => {
  it("GET /branding", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { academyName: "آکادمی" } }));
    const result = await repo.get();
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/branding");
    expect(requestOf(mock).init.method).toBe("GET");
    expect(result.academyName).toBe("آکادمی");
  });

  it("PATCH /branding with the patch body", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { academyName: "آکادمی نو" } }));
    const result = await repo.update({ academyName: "آکادمی نو" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/branding");
    expect(req.init.method).toBe("PATCH");
    expect(req.init.body).toBe(JSON.stringify({ academyName: "آکادمی نو" }));
    expect(result.academyName).toBe("آکادمی نو");
  });

  it("surfaces a forbidden write as an authorization ApiError", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "FORBIDDEN", message: "x", permission: "branding.write" } }, 403),
    );
    const error = (await repo.update({ academyName: "x" }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("authorization");
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("ApiBrandingRepository shared invalidation", () => {
  it("bumps the data version after a write the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { academyName: "آکادمی نو" } }));
    const before = getDataVersion();
    await repo.update({ academyName: "آکادمی نو" });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("a refused write bumps nothing", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "BRANDING_INVALID", message: "x", fields: { academyName: ["x"] } } }, 422),
    );
    const before = getDataVersion();
    await expect(repo.update({ academyName: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(before);
  });

  it("a read never bumps", async () => {
    const { repo } = harness(() => jsonResponse({ data: { academyName: "آکادمی" } }));
    const before = getDataVersion();
    await repo.get();
    expect(getDataVersion()).toBe(before);
  });
});
