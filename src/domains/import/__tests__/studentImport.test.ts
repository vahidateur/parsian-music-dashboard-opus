/**
 * Student import: mapping, validation and commit semantics.
 *
 * Runs against the real demo repository so the duplicate check is tested
 * against actual stored data rather than a stub.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { demoStore } from "@/services/demoStore";
import { resetRegistry, getStudentRepository } from "@/domains/registry";
import { parseCsv, toXlsx, parseXlsx } from "../spreadsheet";
import {
  STUDENT_FIELDS,
  autoMapColumns,
  commitStudentImport,
  errorReportRows,
  loadStudentImportContext,
  validateStudentRows,
} from "../studentImport";

const HEADERS = ["name", "national_id", "instrument", "phone"];

function csv(rows: string[][]): { headers: string[]; rows: string[][] } {
  const text = [HEADERS.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return parseCsv(text);
}

async function validate(rows: string[][]) {
  const sheet = csv(rows);
  const mapping = autoMapColumns(sheet.headers, STUDENT_FIELDS);
  const context = await loadStudentImportContext();
  return validateStudentRows(sheet.rows, mapping, context);
}

beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

describe("column auto-mapping", () => {
  it("recognises both English and Persian headers", () => {
    const mapping = autoMapColumns(["نام", "کد ملی", "ساز", "تلفن"], STUDENT_FIELDS);
    expect(mapping.name).toBe(0);
    expect(mapping.nationalId).toBe(1);
    expect(mapping.instrument).toBe(2);
    expect(mapping.phone).toBe(3);
  });

  it("leaves unmatched fields unmapped rather than guessing", () => {
    const mapping = autoMapColumns(["a", "b"], STUDENT_FIELDS);
    expect(mapping.name).toBeNull();
  });
});

describe("row validation", () => {
  it("accepts a well-formed row", async () => {
    const report = await validate([["سارا تستی", "2000535658", "پیانو", "09120000000"]]);
    expect(report.valid).toHaveLength(1);
    expect(report.errors).toHaveLength(0);
    expect(report.valid[0].value?.nationalId).toBe("2000535658");
  });

  it("rejects a missing national ID", async () => {
    const report = await validate([["بدون کد", "", "پیانو", "09120000000"]]);
    expect(report.failed).toHaveLength(1);
    expect(report.errors[0].field).toBe("nationalId");
  });

  it("rejects a checksum-invalid national ID", async () => {
    const report = await validate([["کد غلط", "1234567890", "پیانو", "09120000000"]]);
    expect(report.failed).toHaveLength(1);
  });

  it("detects a duplicate against existing stored data", async () => {
    const existing = (await getStudentRepository().list({ per_page: 1 })).data[0];
    const report = await validate([["تکراری", existing.nationalId, "پیانو", "09120000000"]]);
    expect(report.duplicates).toBe(1);
    expect(report.failed).toHaveLength(1);
  });

  it("detects a duplicate inside the uploaded file and names the earlier row", async () => {
    const report = await validate([
      ["اول", "2000535658", "پیانو", "09120000000"],
      ["دوم", "2000535658", "گیتار", "09120000001"],
    ]);
    expect(report.valid).toHaveLength(1);
    expect(report.failed).toHaveLength(1);
    expect(report.errors[0].message).toContain("سطر 1");
  });

  it("normalizes Persian digits in the national ID", async () => {
    const report = await validate([["فارسی", "۲۰۰۰۵۳۵۶۵۸", "پیانو", "09120000000"]]);
    expect(report.valid[0].value?.nationalId).toBe("2000535658");
  });

  it("rejects an unknown instrument", async () => {
    const report = await validate([["ساز ناشناخته", "2000535658", "ساکسیفون", "09120000000"]]);
    expect(report.failed).toHaveLength(1);
    expect(report.errors.some((e) => e.field === "instrument")).toBe(true);
  });

  it("rejects a cell that looks like a formula", async () => {
    const report = await validate([["=1+1", "2000535658", "پیانو", "09120000000"]]);
    expect(report.failed).toHaveLength(1);
    expect(report.errors.some((e) => e.message.includes("فرمول"))).toBe(true);
  });

  it("warns but does not fail when the teacher column is absent", async () => {
    const report = await validate([["بدون مدرس", "2000535658", "پیانو", "09120000000"]]);
    expect(report.valid).toHaveLength(1);
    expect(report.warnings.some((w) => w.field === "teacher")).toBe(true);
  });
});

describe("commit semantics", () => {
  it("atomic mode writes nothing when any row is invalid", async () => {
    const before = (await getStudentRepository().list({ per_page: 500 })).meta.total;
    const report = await validate([
      ["معتبر", "2000535658", "پیانو", "09120000000"],
      ["نامعتبر", "1234567890", "پیانو", "09120000001"],
    ]);

    const result = await commitStudentImport(report, { atomic: true });
    expect(result.aborted).toBe(true);
    expect(result.imported).toBe(0);

    const after = (await getStudentRepository().list({ per_page: 500 })).meta.total;
    expect(after).toBe(before);
  });

  it("non-atomic mode imports the valid rows only", async () => {
    const before = (await getStudentRepository().list({ per_page: 500 })).meta.total;
    const report = await validate([
      ["معتبر", "2000535658", "پیانو", "09120000000"],
      ["نامعتبر", "1234567890", "پیانو", "09120000001"],
    ]);

    const result = await commitStudentImport(report, { atomic: false });
    expect(result.aborted).toBe(false);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);

    const after = (await getStudentRepository().list({ per_page: 500 })).meta.total;
    expect(after).toBe(before + 1);
  });

  it("persists an imported student that is then readable through the repository", async () => {
    const report = await validate([["هنرجوی وارداتی", "2000535658", "گیتار", "09120000000"]]);
    await commitStudentImport(report, { atomic: true });

    const page = await getStudentRepository().list({ per_page: 500 });
    const found = page.data.find((s) => s.name === "هنرجوی وارداتی");
    expect(found).toBeDefined();
    expect(found?.instrument).toBe("guitar");
  });
});

describe("error report", () => {
  it("produces downloadable rows with row numbers and reasons", async () => {
    const report = await validate([["x", "1234567890", "پیانو", "09120000000"]]);
    const table = errorReportRows(report.errors);
    expect(table.headers).toContain("سطر");
    expect(table.rows[0][0]).toBe("1");
  });
});

describe("XLSX import path", () => {
  it("validates rows that arrived from an Excel file", async () => {
    const bytes = toXlsx(HEADERS, [["اکسلی", "2000535658", "پیانو", "09120000000"]]);
    const sheet = parseXlsx(bytes);
    const mapping = autoMapColumns(sheet.headers, STUDENT_FIELDS);
    const context = await loadStudentImportContext();
    const report = validateStudentRows(sheet.rows, mapping, context);

    expect(report.valid).toHaveLength(1);
    expect(report.valid[0].value?.name).toBe("اکسلی");
  });
});
