// @vitest-environment jsdom
/**
 * ApiGalleryRepository — request construction against a stubbed fetch, and the
 * shared-invalidation contract: a write the server accepted bumps the data
 * version so the album column and the image grid re-read; a refused write
 * changes nothing.
 *
 * The version bump is what keeps the client composition honest. The demo
 * composition refreshes through the store subscription; the API composition
 * has no store, so without the bump a panel would keep showing the list from
 * before the write. Instruments (§33), learning (§34) and rooms (§35)
 * established this rule; gallery (§36) follows it.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiGalleryRepository, toAlbumQuery, toImageQuery } from "@/domains/gallery/apiRepository";
import type { CreateAlbumInput, CreateGalleryImageInput } from "@/domains/gallery/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiGalleryRepository(client) };
}

describe("ApiGalleryRepository request construction", () => {
  it("GET /gallery/albums with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 100, total: 0 } }));
    await repo.listAlbums({ search: "بهار", page: 1, per_page: 100 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/gallery/albums?search=%D8%A8%D9%87%D8%A7%D8%B1&page=1&per_page=100");
    expect(req.init.method).toBe("GET");
  });

  it("GET /gallery/albums/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gl 1" } }));
    await repo.getAlbum("gl 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/gallery/albums/gl%201");
  });

  it("POST /gallery/albums", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gl_1" } }));
    await repo.createAlbum({ title: "کنسرت بهار", description: "" } as unknown as CreateAlbumInput);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/gallery/albums");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ title: "کنسرت بهار", description: "" }));
  });

  it("PATCH /gallery/albums/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gl_1", title: "تازه" } }));
    const result = await repo.updateAlbum("gl_1", { title: "تازه" });
    expect(requestOf(mock).init.method).toBe("PATCH");
    expect(result.title).toBe("تازه");
  });

  it("DELETE /gallery/albums/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.deleteAlbum("gl 1")).resolves.toBeUndefined();
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/gallery/albums/gl%201");
  });

  it("GET /gallery/images with the album filter", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    await repo.listImages({ albumId: "gl_1", page: 1, per_page: 200 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/gallery/images?album_id=gl_1&page=1&per_page=200");
    expect(req.init.method).toBe("GET");
  });

  it("POST /gallery/images", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gi_1" } }));
    const input = { albumId: "gl_1", mediaId: "md_1", caption: "قاب", alt: "متن جایگزین" } as unknown as CreateGalleryImageInput;
    await repo.addImage(input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/gallery/images");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify(input));
  });

  it("PATCH /gallery/images/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gi_1", caption: "تازه" } }));
    const result = await repo.updateImage("gi_1", { caption: "تازه" });
    expect(requestOf(mock).init.method).toBe("PATCH");
    expect(result.caption).toBe("تازه");
  });

  it("DELETE /gallery/images/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.removeImage("gi_1")).resolves.toBeUndefined();
    expect(requestOf(mock).init.method).toBe("DELETE");
  });

  it("POST /gallery/images/{id}/reorder carries the position", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "gi_1", sortOrder: 2 } }));
    const result = await repo.reorderImage("gi_1", 2);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/gallery/images/gi_1/reorder");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ order: 2 }));
    expect(result.sortOrder).toBe(2);
  });

  it("surfaces an unknown album as not_found", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "ALBUM_NOT_FOUND", message: "آلبوم یافت نشد." } }, 404),
    );
    const error = (await repo.getAlbum("gl_missing").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("ALBUM_NOT_FOUND");
  });

  it("omits unset query params", () => {
    expect(toAlbumQuery({ search: "x" })).toMatchObject({ search: "x" });
    expect(toImageQuery({ albumId: "gl_1" })).toMatchObject({ album_id: "gl_1" });
  });
});

describe("ApiGalleryRepository shared invalidation", () => {
  it("bumps the data version after a write the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "gl_9" } }));
    const before = getDataVersion();
    await repo.createAlbum({ title: "آلبوم ۹", description: "" } as unknown as CreateAlbumInput);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps after an image reorder the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "gi_1", sortOrder: 0 } }));
    const before = getDataVersion();
    await repo.reorderImage("gi_1", 0);
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps nothing when the server refused the write", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "GALLERY_ALBUM_INVALID", message: "نامعتبر است." } }, 422),
    );
    const before = getDataVersion();
    await expect(
      repo.createAlbum({ title: "x", description: "" } as unknown as CreateAlbumInput),
    ).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(before);
  });
});
