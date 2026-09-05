import { describe, expect, it } from "vitest";
import {
  formatNationalId,
  isValidNationalId,
  nationalIdError,
  normalizeNationalId,
  validateNationalId,
} from "@/lib/nationalId";

/** Builds a checksum-correct code from 9 digits, so tests don't hardcode magic values. */
function withChecksum(prefix9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(prefix9[i]) * (10 - i);
  const r = sum % 11;
  return prefix9 + (r < 2 ? r : 11 - r);
}

const VALID = ["123456789", "007654321", "098765432", "456789012"].map(withChecksum);

describe("normalizeNationalId", () => {
  it("strips separators and whitespace", () => {
    expect(normalizeNationalId(" 123-456789-0 ")).toBe("1234567890");
  });

  it("converts Persian and Arabic-Indic digits", () => {
    expect(normalizeNationalId("۰۰۷۶۵۴۳۲۱۸")).toBe("0076543218");
    expect(normalizeNationalId("٠٠٧٦٥٤٣٢١٨")).toBe("0076543218");
  });

  it("restores leading zeros stripped by spreadsheets", () => {
    expect(normalizeNationalId("76543218")).toBe("0076543218");
    expect(normalizeNationalId("076543218")).toBe("0076543218");
  });

  it("does not fabricate an ID from a clearly truncated value", () => {
    // Padding "123" to 10 digits would invent a plausible ID from a typo.
    expect(normalizeNationalId("123")).toBe("123");
    expect(validateNationalId("123")).toBe("length");
  });

  it("is idempotent", () => {
    for (const v of VALID) expect(normalizeNationalId(normalizeNationalId(v))).toBe(v);
  });
});

describe("validateNationalId", () => {
  it("accepts checksum-correct codes", () => {
    for (const v of VALID) expect(validateNationalId(v), v).toBeNull();
  });

  it("accepts a valid code written with Persian digits", () => {
    expect(isValidNationalId("۰۰۷۶۵۴۳۲۱۸")).toBe(true);
  });

  it("reports missing input", () => {
    expect(validateNationalId("")).toBe("required");
    expect(validateNationalId("   ")).toBe("required");
  });

  it("reports wrong length", () => {
    expect(validateNationalId("12345")).toBe("length");
    expect(validateNationalId("12345678901")).toBe("length");
  });

  it("rejects single-repeated-digit codes that pass the arithmetic", () => {
    // 1111111111 satisfies the checksum but is never issued.
    expect(validateNationalId("1111111111")).toBe("repeated");
    expect(validateNationalId("0000000000")).toBe("repeated");
  });

  it("rejects a wrong check digit", () => {
    expect(validateNationalId("1234567890")).toBe("checksum");
  });

  it("rejects non-numeric junk", () => {
    expect(validateNationalId("abcdefghij")).toBe("required");
  });

  it("exposes a Persian message for every failure", () => {
    expect(nationalIdError("")).toBeTruthy();
    expect(nationalIdError("1234567890")).toBeTruthy();
    expect(nationalIdError(VALID[0])).toBeNull();
  });
});

describe("formatNationalId", () => {
  it("groups a full code for display", () => {
    expect(formatNationalId("1234567891")).toBe("123-456789-1");
  });

  it("leaves an incomplete value untouched", () => {
    expect(formatNationalId("123")).toBe("123");
  });
});
