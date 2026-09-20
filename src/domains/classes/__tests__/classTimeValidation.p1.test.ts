import { describe, it, expect } from "vitest";
import { isHhMm } from "@/domains/scheduling/dateBridge";

/**
 * AUDIT-003 regression: Class time validation must reject invalid times outside 00:00–23:59.
 * Reuses existing helper isHhMm (00:00–23:59) instead of loose regex that allowed 99:99.
 */
describe("AUDIT-003 class time validation", () => {
  it("rejects 99:99", () => {
    expect(isHhMm("99:99")).toBe(false);
  });
  it("rejects 24:00 (outside 00-23)", () => {
    expect(isHhMm("24:00")).toBe(false);
  });
  it("rejects 12:60 (minute 60 invalid)", () => {
    expect(isHhMm("12:60")).toBe(false);
  });
  it("rejects 25:00 and 00:60", () => {
    expect(isHhMm("25:00")).toBe(false);
    expect(isHhMm("00:60")).toBe(false);
  });
  it("accepts valid times 00:00, 23:59, 12:30, 17:00, 08:15", () => {
    expect(isHhMm("00:00")).toBe(true);
    expect(isHhMm("23:59")).toBe(true);
    expect(isHhMm("12:30")).toBe(true);
    expect(isHhMm("17:00")).toBe(true);
    expect(isHhMm("08:15")).toBe(true);
  });
  it("rejects malformed without leading zero check for minutes but allows single hour? isHhMm requires 2-digit hour 00-23", () => {
    // isHhMm uses ([01]\d|2[0-3]):([0-5]\d) so 7:00 should be false, 07:00 true
    expect(isHhMm("7:00")).toBe(false);
    expect(isHhMm("07:00")).toBe(true);
  });
});
