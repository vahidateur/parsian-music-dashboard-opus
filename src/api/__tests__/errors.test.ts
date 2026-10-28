import { describe, expect, it } from "vitest";
import { apiErrorFromResponse } from "../errors";

const STALE = "تصمیم مالک";
const body = (code: string, n: string) => ({
  error: {
    code,
    message: "این عملیات تا تصمیم مالک محصول مسدود است.",
    decision: n,
    detail: "x",
  },
});

describe("policy-restriction (OWNER_DECISION_REQUIRED_PB*) messaging", () => {
  it.each(["1", "2", "3"])("PB-%s: accurate text, diagnostics preserved", (n) => {
    const code = `OWNER_DECISION_REQUIRED_PB${n}`;
    const b = body(code, `PB-${n}`);
    const e = apiErrorFromResponse(403, b);
    expect(e.message).not.toContain(STALE);
    expect(e.message.length).toBeGreaterThan(10);
    expect(e.code).toBe(code);
    expect(e.kind).toBe("authorization");
    expect(e.status).toBe(403);
    expect(e.payload).toBe(b);
  });

  it("uses distinct wording per decision", () => {
    const m = ["1", "2", "3"].map((n) => apiErrorFromResponse(403, body(`OWNER_DECISION_REQUIRED_PB${n}`, n)).message);
    expect(new Set(m).size).toBe(3);
  });

  it("unknown PB numbers get the generic policy text, not the stale one", () => {
    const e = apiErrorFromResponse(403, body("OWNER_DECISION_REQUIRED_PB9", "PB-9"));
    expect(e.message).not.toContain(STALE);
    expect(e.code).toBe("OWNER_DECISION_REQUIRED_PB9");
  });

  it("leaves other coded errors untouched", () => {
    const e = apiErrorFromResponse(409, { error: { code: "SCHEDULE_VERSION_CONFLICT", message: "پیام سرور" } });
    expect(e.message).toBe("پیام سرور");
    expect(apiErrorFromResponse(403, {}).message).toBe("دسترسی لازم برای این عملیات را ندارید.");
  });
});