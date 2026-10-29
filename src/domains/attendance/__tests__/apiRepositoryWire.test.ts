import { describe, expect, it } from "vitest";
import { ApiClient } from "@/api/client";
import { ApiAttendanceRepository, toQuery } from "@/domains/attendance/apiRepository";
import { asFetch, createFetchMock, jsonResponse, requestOf } from "@/test/fetchMock";

/**
 * The attendance list bounds are SESSION DATES on the server
 * (`date_format:Y-m-d`, ListAttendanceRequest). The Attendance view hands the
 * repository ISO instants; a full timestamp on the wire is a 422, which the
 * view then reads as an empty week. The wire adapter must send the day.
 */
describe("attendance list — wire query", () => {
  it("sends since/until as Y-m-d, keeping the whole last day inclusive", () => {
    const query = toQuery({ since: "2026-10-24T00:00:00.000Z", until: "2026-10-30T23:59:59.999Z" });
    expect(query.since).toBe("2026-10-24");
    expect(query.until).toBe("2026-10-30");
  });

  it("leaves absent bounds absent", () => {
    const query = toQuery({ status: "absent" });
    expect(query.since).toBeUndefined();
    expect(query.until).toBeUndefined();
    expect(query.status).toBe("absent");
  });

  it("puts a date-only bound on the request URL, never a timestamp", async () => {
    const mock = createFetchMock(() => jsonResponse({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    const repository = new ApiAttendanceRepository(new ApiClient({ baseUrl: "https://example.test/api/v1", fetchImpl: asFetch(mock) }));
    await repository.list({ since: "2026-10-24T00:00:00.000Z", until: "2026-10-30T23:59:59.999Z", per_page: 200 });
    const url = new URL(requestOf(mock).url);
    expect(url.searchParams.get("since")).toBe("2026-10-24");
    expect(url.searchParams.get("until")).toBe("2026-10-30");
    expect(requestOf(mock).url).not.toContain("T00%3A00");
  });
});
