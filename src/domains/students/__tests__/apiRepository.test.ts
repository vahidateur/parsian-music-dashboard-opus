import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { ApiStudentRepository, toQuery } from "@/domains/students/apiRepository";
import type { CreateStudentInput } from "@/domains/students/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiStudentRepository(client) };
}

describe("ApiStudentRepository request construction", () => {
  it("GET /students with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 25, total: 0 } }));
    await repo.list({ search: "ali", status: "active", teacherId: "t1", page: 1, per_page: 25 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/students?search=ali&status=active&teacher_id=t1&page=1&per_page=25");
    expect(req.init.method).toBe("GET");
  });

  it("GET /students/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "stu_1" } }));
    await repo.get("stu_1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/students/stu_1");
  });

  it("POST /students", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "stu_9" } }));
    await repo.create({ name: "علی" } as unknown as CreateStudentInput);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/students");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ name: "علی" }));
  });

  it("PATCH /students/{id}", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "stu_1", status: "paused" } }));
    const result = await repo.update("stu_1", { status: "paused" });
    const req = requestOf(mock);
    expect(req.init.method).toBe("PATCH");
    expect(req.init.body).toBe(JSON.stringify({ status: "paused" }));
    expect(result.status).toBe("paused");
  });

  it("DELETE /students/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => new Response(null, { status: 204 }));
    await expect(repo.delete("stu 1")).resolves.toBeUndefined();
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/students/stu%201");
    expect(req.init.method).toBe("DELETE");
  });

  it("surfaces backend errors as ApiError", async () => {
    const { repo } = harness(() => jsonResponse({ error: { code: "STUDENT_NOT_FOUND", message: "not found" } }, 404));
    const error = (await repo.get("stu_x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("STUDENT_NOT_FOUND");
  });

  it("omits unset query params", () => {
    expect(toQuery({ search: "x" })).toMatchObject({ search: "x", status: undefined, teacher_id: undefined });
  });
});
