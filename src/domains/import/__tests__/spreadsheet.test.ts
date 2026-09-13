/**
 * Spreadsheet layer: round-trips and the security controls of §15.
 * Untrusted-input handling is asserted, not assumed.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  SpreadsheetError,
  detectFormat,
  escapeForSpreadsheet,
  isFormulaLike,
  parseCsv,
  parseSpreadsheet,
  parseXlsx,
  safeFilename,
  toCsv,
  toXlsx,
} from "../spreadsheet";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("CSV parsing", () => {
  it("parses quoted fields containing separators and newlines", () => {
    const sheet = parseCsv('name,note\n"محمدی, سارا","خط اول\nخط دوم"\n');
    expect(sheet.headers).toEqual(["name", "note"]);
    expect(sheet.rows[0][0]).toBe("محمدی, سارا");
    expect(sheet.rows[0][1]).toBe("خط اول\nخط دوم");
  });

  it("unescapes doubled quotes", () => {
    const sheet = parseCsv('a\n"او گفت ""سلام"""\n');
    expect(sheet.rows[0][0]).toBe('او گفت "سلام"');
  });

  it("strips a UTF-8 BOM from the first header", () => {
    const sheet = parseCsv("\uFEFFname,age\nسارا,20");
    expect(sheet.headers[0]).toBe("name");
  });

  it("handles CRLF and a missing trailing newline", () => {
    const sheet = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(sheet.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("rejects an empty file", () => {
    expect(() => parseCsv("")).toThrow(SpreadsheetError);
  });
});

describe("formula injection", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "=cmd|'/c calc'!A1"])("flags %s as formula-like", (value) => {
    expect(isFormulaLike(value)).toBe(true);
  });

  it("leaves ordinary Persian text untouched", () => {
    expect(escapeForSpreadsheet("سارا محمدی")).toBe("سارا محمدی");
  });

  it("neutralizes a formula on CSV export", () => {
    const csv = toCsv(["name"], [["=HYPERLINK(\"http://evil\",\"click\")"]]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("neutralizes a formula on XLSX export", () => {
    const bytes = toXlsx(["name"], [["=1+1"]]);
    const parsed = parseXlsx(bytes);
    expect(parsed.rows[0][0]).toBe("'=1+1");
  });
});

describe("CSV export", () => {
  it("includes a BOM so Excel reads Persian correctly", () => {
    expect(toCsv(["نام"], [["سارا"]]).startsWith("\uFEFF")).toBe(true);
  });

  it("round-trips values containing commas and quotes", () => {
    const csv = toCsv(["a", "b"], [['x,y', 'he said "hi"']]);
    const back = parseCsv(csv);
    expect(back.rows[0]).toEqual(['x,y', 'he said "hi"']);
  });
});

describe("XLSX", () => {
  it("round-trips headers and rows", () => {
    const bytes = toXlsx(["نام", "کد ملی"], [["سارا محمدی", "2000535658"]]);
    const sheet = parseXlsx(bytes);
    expect(sheet.headers).toEqual(["نام", "کد ملی"]);
    expect(sheet.rows[0]).toEqual(["سارا محمدی", "2000535658"]);
  });

  it("preserves a leading zero in a national ID", () => {
    const sheet = parseXlsx(toXlsx(["id"], [["0076543218"]]));
    expect(sheet.rows[0][0]).toBe("0076543218");
  });

  it("rejects a file that is not a valid zip", () => {
    expect(() => parseXlsx(utf8("PK not really a zip"))).toThrow(SpreadsheetError);
  });
});

describe("format detection", () => {
  it("detects XLSX from the PK magic bytes, not the filename", () => {
    const bytes = toXlsx(["a"], [["b"]]);
    expect(detectFormat(bytes, "payload.csv")).toBe("xlsx");
  });

  it("treats text content as CSV even when named .xlsx", () => {
    expect(detectFormat(utf8("a,b\n1,2"), "sneaky.xlsx")).toBe("csv");
  });
});

describe("upload guards", () => {
  it("rejects an oversized file before parsing", () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.fill(65);
    expect(() => parseSpreadsheet(big, "big.csv")).toThrow(/مگابایت/);
  });

  it("rejects invalid UTF-8 rather than producing replacement characters", () => {
    // 0xFF is never valid in UTF-8.
    const invalid = new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0xff, 0xfe, 0x2c, 0x64]);
    expect(() => parseSpreadsheet(invalid, "bad.csv")).toThrow(/UTF-8/);
  });

  it("rejects an empty upload", () => {
    expect(() => parseSpreadsheet(new Uint8Array(), "empty.csv")).toThrow(SpreadsheetError);
  });
});

describe("safeFilename", () => {
  it("strips path traversal segments", () => {
    expect(safeFilename("../../etc/passwd")).toBe("....-..-etc-passwd".replace(/^\.+/, ""));
    expect(safeFilename("../../etc/passwd")).not.toContain("/");
  });

  it("falls back when the name is empty after cleaning", () => {
    expect(safeFilename("...", "export")).toBe("export");
  });
});
