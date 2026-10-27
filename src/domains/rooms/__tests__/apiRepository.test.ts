// @vitest-environment jsdom
/**
 * ApiRoomRepository — request construction against a stubbed fetch, and the
 * shared-invalidation contract: a write the server accepted bumps the data
 * version so every list hook re-reads; a refused write changes nothing.
 *
 * The version bump is what keeps the client composition honest. The demo
 * composition refreshes through the store subscription; the API composition
 * has no store, so without the bump a panel would keep showing the list from
 * before the write. Instruments (§33) and learning (§34) established this
 * rule; rooms follows it.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiRoomRepository, toQuery } from "@/domains/rooms/apiRepository";
import type { CreateRoomInput } from "@/domains/rooms/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiRoomRepository(client) };
}

describe("ApiRoomRepository request construction", () => {
  it("GET /rooms with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ search: "تمرین", assignableOnly: true, minCapacity: 4, page: 1, per_page: 25 });
    const req = requestOf(mock);
    expect(req.url).toBe(
      "https://example.test/api/v1/rooms?page=1&per_page=25&search=%D8%AA%D9%85%D8%B1%DB%8C%D9%86&assignable=1&min_capacity=4",
    );
    expect(req.init.method).toBe("GET");
  });

  it("GET /rooms/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "r 1" } }));
    await repo.get("r 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/rooms/r%201");
  });

  it("POST /rooms", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "r_1" } }));
    await repo.create({ name: "اتاق ۵", kind: "تمرین", capacity: 6 } as unknown as CreateRoomInput);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/rooms");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ name: "اتاق ۵", kind: "تمرین", capacity: 6 }));
  });

  it("PATCH /rooms/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "r_1", capacity: 8 } }));
    const result = await repo.update("r_1", { capacity: 8 });
    expect(requestOf(mock).init.method).toBe("PATCH");
    expect(result.capacity).toBe(8);
  });

  it("POST /rooms/{id}/deactivate", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "r_1", active: false } }));
    const result = await repo.deactivate("r_1");
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/rooms/r_1/deactivate");
    expect(req.init.method).toBe("POST");
    expect(result.active).toBe(false);
  });

  it("DELETE /rooms/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.delete("r 1")).resolves.toBeUndefined();
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/rooms/r%201");
  });

  it("surfaces a referenced-room refusal as a conflict", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "ROOM_IN_USE", message: "در کلاس استفاده شده است." } }, 409),
    );
    const error = (await repo.delete("r_1").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("ROOM_IN_USE");
  });

  it("omits unset query params", () => {
    expect(toQuery({ search: "x" })).toMatchObject({ search: "x", assignable: undefined, min_capacity: undefined });
  });
});

describe("ApiRoomRepository shared invalidation", () => {
  it("bumps the data version after a write the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "r_9" } }));
    const before = getDataVersion();
    await repo.create({ name: "اتاق ۹", kind: "تمرین", capacity: 4 } as unknown as CreateRoomInput);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps nothing when the server refused the write", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "ROOM_NAME_TAKEN", message: "تکراری است." } }, 409),
    );
    const before = getDataVersion();
    await expect(
      repo.create({ name: "اتاق ۱", kind: "x", capacity: 4 } as unknown as CreateRoomInput),
    ).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(before);
  });
});
