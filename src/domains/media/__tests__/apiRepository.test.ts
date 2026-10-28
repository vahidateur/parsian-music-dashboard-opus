/**
 * ApiMediaRepository — request construction, binary transport and error
 * mapping against a stubbed fetch.
 *
 * WHAT THIS PROVES
 *  - an upload is a MULTIPART request (never a JSON envelope), carrying the
 *    file part and the metadata as ordinary fields, with the auth header the
 *    ApiClient adds;
 *  - the bytes endpoint returns a Blob, and a MISSING asset reads as
 *    `undefined` — the UI's "no image" state;
 *  - a REFUSED read (403) is NOT that state: it travels on as an ApiError, so
 *    an unauthorized read can never be rendered as an empty record;
 *  - a 409 on delete (the asset is still referenced) surfaces as an ApiError
 *    the release funnel reports rather than swallows.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { ApiMediaRepository, toQuery } from "@/domains/media/apiRepository";
import type { CreateMediaInput } from "@/domains/media/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiMediaRepository(client) };
}

const pngInput = (): CreateMediaInput => ({
  kind: "image",
  filename: "عکس هنرجو.png",
  mimeType: "image/png",
  bytes: new ArrayBuffer(8),
});

describe("ApiMediaRepository — upload", () => {
  it("uploads as multipart with the file part and the metadata fields", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "md_1" } }));

    const asset = await repo.create(pngInput());

    expect(asset.id).toBe("md_1");
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/media");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBeInstanceOf(FormData);

    const form = req.init.body as FormData;
    expect(form.get("kind")).toBe("image");
    const file = form.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("عکس هنرجو.png");
    expect((file as File).type).toBe("image/png");
    // The optional metadata is absent, not "null" — the server treats an
    // absent field as "not provided".
    expect(form.get("width")).toBeNull();
    expect(form.get("peaks")).toBeNull();
  });

  it("carries the optional metadata when given", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "md_1" } }));

    await repo.create({ ...pngInput(), width: 800, height: 600, peaks: [0.2, 0.8] });

    const form = requestOf(mock).init.body as FormData;
    expect(form.get("width")).toBe("800");
    expect(form.get("height")).toBe("600");
    expect(form.get("peaks")).toBe(JSON.stringify([0.2, 0.8]));
  });

  it("attaches the bearer token", async () => {
    const handler: FetchHandler = () => jsonResponse({ data: { id: "md_1" } });
    const mock = createFetchMock(handler);
    let token: string | undefined = "tok_1";
    const client = new ApiClient({
      baseUrl: "https://example.test/api/v1",
      fetchImpl: asFetch(mock),
      getToken: () => token,
    });
    await new ApiMediaRepository(client).create(pngInput());
    expect(requestOf(mock).headers.Authorization).toBe("Bearer tok_1");
  });

  it("surfaces the server's validation as ApiError with field errors", async () => {
    const { repo } = harness(
      () => jsonResponse({ error: { code: "MEDIA_INVALID", message: "قالب مجاز نیست.", fields: { mimeType: ["قالب مجاز نیست."] } } }, 422),
    );

    const error = (await repo.create(pngInput()).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("validation");
    expect(error.fields?.mimeType).toEqual(["قالب مجاز نیست."]);
  });
});

describe("ApiMediaRepository — reads", () => {
  it("GET /media with the mapped query", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));

    await repo.list({ kind: "image", search: "عکس", page: 2, per_page: 25 });

    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/media?kind=image&search=%D8%B9%DA%A9%D8%B3&page=2&per_page=25");
  });

  it("omits unset query params", () => {
    expect(toQuery({ search: "x" })).toMatchObject({ search: "x", kind: undefined, page: undefined });
  });

  it("GET /media/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "md 1" } }));

    const asset = await repo.get("md 1");

    expect(asset.id).toBe("md 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/media/md%201");
  });

  it("getBlob fetches the bytes endpoint and returns a Blob", async () => {
    const { mock, repo } = harness(
      () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } }),
    );

    const blob = await repo.getBlob("md_1");

    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(3);
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/media/md_1/bytes");
  });

  it("a MISSING asset reads as undefined (the UI's 'no image')", async () => {
    const { repo } = harness(
      () => jsonResponse({ error: { code: "MEDIA_NOT_FOUND", message: "فایل یافت نشد." } }, 404),
    );

    await expect(repo.getBlob("md_gone")).resolves.toBeUndefined();
  });

  it("a REFUSED read is an error, never a silent 'no image'", async () => {
    const { repo } = harness(
      () => jsonResponse({ error: { code: "FORBIDDEN", message: "دسترسی ندارید.", permission: "media.read" } }, 403),
    );

    const error = (await repo.getBlob("md_secret").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("authorization");
  });
});

describe("ApiMediaRepository — delete", () => {
  it("DELETE /media/{id}", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));

    await expect(repo.delete("md_1")).resolves.toBeUndefined();
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/media/md_1");
  });

  it("a still-referenced asset surfaces as a conflict (the release funnel reports it)", async () => {
    const { repo } = harness(
      () => jsonResponse({ error: { code: "MEDIA_IN_USE", message: "این فایل هنوز در یک رکورد استفاده شده است." } }, 409),
    );

    const error = (await repo.delete("md_1").catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("MEDIA_IN_USE");
  });
});
