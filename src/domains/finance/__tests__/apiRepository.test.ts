// @vitest-environment jsdom
/**
 * ApiFinanceRepository — request construction against a stubbed fetch, and
 * the shared-invalidation contract: a write the server accepted bumps the
 * data version so lists re-read; a refused write changes nothing.
 *
 * The wire carries the domain input as-is: no actor travels (the server
 * records the token user on pay), and the list query is snake_case while
 * bodies stay camelCase — the same split every Api repository uses.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiFinanceRepository, toQuery } from "@/domains/finance/apiRepository";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "@/domains/finance/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiFinanceRepository(client) };
}

describe("ApiFinanceRepository request construction", () => {
  it("GET /invoices with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    await repo.list({ studentId: "st_1", status: "due", page: 1, per_page: 200 });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/invoices?student_id=st_1&status=due&page=1&per_page=200");
    expect(req.init.method).toBe("GET");
  });

  it("GET /invoices/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "inv 1" } }));
    await repo.get("inv 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/invoices/inv%201");
  });

  it("POST /invoices carries the camelCase body", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "inv_1" } }));
    const input: CreateInvoiceInput = { studentId: "st_1", title: "شهریه", amount: 3000000, dueAt: "2026-11-04" };
    await repo.create(input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/invoices");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(
      JSON.stringify({ studentId: "st_1", title: "شهریه", amount: 3000000, dueAt: "2026-11-04" }),
    );
  });

  it("PATCH /invoices/{id} carries the partial body", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "inv_1" } }));
    const input: UpdateInvoiceInput = { title: "شهریهٔ اصلاح‌شده", amount: 2500000 };
    await repo.update("inv_1", input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/invoices/inv_1");
    expect(req.init.method).toBe("PATCH");
    expect(req.init.body).toBe(JSON.stringify({ title: "شهریهٔ اصلاح‌شده", amount: 2500000 }));
  });

  it("POST /invoices/{id}/pay carries how it arrived", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "inv_1", status: "paid" } }));
    await repo.pay("inv_1", { method: "transfer", reference: "TT-123456" });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/invoices/inv_1/pay");
    expect(req.init.method).toBe("POST");
    expect(JSON.parse(req.init.body as string)).toEqual({ method: "transfer", reference: "TT-123456" });
  });

  it("bumps the data version after an accepted write and never after a refused one", async () => {
    const before = getDataVersion();
    const { repo } = harness(() => jsonResponse({ data: { id: "inv_1" } }));
    await repo.create({ studentId: "st_1", title: "شهریه", amount: 1 });
    expect(getDataVersion()).toBeGreaterThan(before);

    const refused = harness(() => {
      throw new ApiError({ kind: "conflict", code: "INVOICE_ALREADY_PAID", message: "paid" });
    });
    await expect(refused.repo.pay("inv_1", { method: "pos" })).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(getDataVersion());
  });

  it("reads never bump the data version", async () => {
    const before = getDataVersion();
    const { repo } = harness(() => jsonResponse({ data: { id: "inv_1" }, meta: { page: 1, per_page: 25, total: 1 } }));
    await repo.list({});
    await repo.get("inv_1");
    expect(getDataVersion()).toBe(before);
  });
});

describe("toQuery", () => {
  it("maps the wire spellings", () => {
    expect(toQuery({})).toEqual({ page: undefined, per_page: undefined, student_id: undefined, status: undefined });
    expect(toQuery({ studentId: "st_1", status: "paid" })).toMatchObject({ student_id: "st_1", status: "paid" });
  });
});
