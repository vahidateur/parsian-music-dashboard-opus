// @vitest-environment jsdom
/**
 * ApiCompensationRepository — request construction against a stubbed fetch,
 * and the shared-invalidation contract: a write the server accepted bumps the
 * data version so the ledger re-reads; a refused write changes nothing.
 *
 * The actor travels in the domain input (the demo contract names it), but the
 * wire carries no `actor`, `userId` or `permissions`: a client-supplied actor
 * would be an unverified claim, and the server records the authenticated user
 * instead — the same rule as chat's `from`.
 */
import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiError } from "@/api/errors";
import { getDataVersion } from "@/domains/shared/dataVersion";
import { ApiCompensationRepository, toQuery } from "@/domains/compensation/apiRepository";
import type {
  CompensationActor,
  RegisterCompensationInput,
  ScheduleCompensationInput,
} from "@/domains/compensation/types";
import { asFetch, createFetchMock, jsonResponse, requestOf, type FetchHandler } from "@/test/fetchMock";

function harness(handler: FetchHandler) {
  const mock = createFetchMock(handler);
  const client = new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) });
  return { mock, repo: new ApiCompensationRepository(client) };
}

const actor: CompensationActor = { userId: "u_manager", permissions: ["schedule.write"] };

describe("ApiCompensationRepository request construction", () => {
  it("GET /compensations with mapped query params", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    await repo.list({ studentId: "st_1", status: "scheduled", openOnly: true, page: 1, per_page: 200 });
    const req = requestOf(mock);
    expect(req.url).toBe(
      "https://example.test/api/v1/compensations?student_id=st_1&status=scheduled&open_only=1&page=1&per_page=200",
    );
    expect(req.init.method).toBe("GET");
  });

  it("GET /compensations/{id} and encodes ids", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "cp 1" } }));
    await repo.get("cp 1");
    expect(requestOf(mock).url).toBe("https://example.test/api/v1/compensations/cp%201");
  });

  it("POST /compensations strips the actor: the server records the token user", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "cp_1" } }));
    const input: RegisterCompensationInput = { originalSessionId: "se_1", studentId: "st_1", reason: "جبرانی", actor };
    await repo.register(input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/compensations");
    expect(req.init.method).toBe("POST");
    expect(req.init.body).toBe(JSON.stringify({ originalSessionId: "se_1", studentId: "st_1", reason: "جبرانی" }));
    expect(req.init.body).not.toContain("actor");
    expect(req.init.body).not.toContain("u_manager");
  });

  it("POST /compensations/{id}/schedule strips the actor", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "cp_1", status: "scheduled" } }));
    const input: ScheduleCompensationInput = { date: "2026-02-01", startTime: "14:00", endTime: "15:00", actor };
    const result = await repo.schedule("cp_1", input);
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/compensations/cp_1/schedule");
    expect(req.init.method).toBe("POST");
    expect(JSON.parse(req.init.body as string)).toEqual({ date: "2026-02-01", startTime: "14:00", endTime: "15:00" });
    expect(result.status).toBe("scheduled");
  });

  it("POST /compensations/{id}/complete strips the actor", async () => {
    const { mock, repo } = harness(() => jsonResponse({ data: { id: "cp_1", status: "completed" } }));
    await repo.complete("cp_1", { actor });
    const req = requestOf(mock);
    expect(req.url).toBe("https://example.test/api/v1/compensations/cp_1/complete");
    expect(req.init.body).toBe(JSON.stringify({}));
  });

  it("surfaces a settled obligation as a conflict", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "COMPENSATION_ALREADY_SETTLED", message: "انجام شده است." } }, 409),
    );
    const error = (await repo.schedule("cp_1", { date: "2026-02-01", startTime: "14:00", endTime: "15:00", actor }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.code).toBe("COMPENSATION_ALREADY_SETTLED");
  });

  it("omits unset query params", () => {
    expect(toQuery({})).toMatchObject({ original_session_id: undefined, status: undefined, open_only: undefined });
  });
});

describe("ApiCompensationRepository shared invalidation", () => {
  it("bumps the data version after a write the server accepted", async () => {
    const { repo } = harness(() => jsonResponse({ data: { id: "cp_9" } }));
    const before = getDataVersion();
    await repo.register({ originalSessionId: "se_1", studentId: "st_1", reason: "x", actor });
    expect(getDataVersion()).toBeGreaterThan(before);
  });

  it("bumps nothing when the server refused the write", async () => {
    const { repo } = harness(() =>
      jsonResponse({ error: { code: "COMPENSATION_ALREADY_OPEN", message: "باز است." } }, 409),
    );
    const before = getDataVersion();
    await expect(
      repo.register({ originalSessionId: "se_1", studentId: "st_1", reason: "x", actor }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(getDataVersion()).toBe(before);
  });
});
