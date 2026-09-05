/**
 * Exports must reflect current domain state, not fixtures, and must survive a
 * round-trip through Excel-compatible encodings.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { demoStore } from "@/services/demoStore";
import { getStudentRepository, resetRegistry } from "@/domains/registry";
import { parseCsv, parseXlsx } from "@/domains/import/spreadsheet";
import { buildExportTable, serializeTable } from "../exportService";

beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

/**
 * Reads a blob as text. `ignoreBOM: true` keeps the BOM as a character so the
 * test can assert it is present — the default decoder silently strips it.
 */
async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(new Uint8Array(await blob.arrayBuffer()));
}

describe("export reflects live state", () => {
  it("includes a student created after startup", async () => {
    await getStudentRepository().create({
      nationalId: "2000535658",
      name: "هنرجوی خروجی",
      instrument: "violin",
      teacherId: "t3",
      level: "سطح ۲",
      levelStep: 2,
      status: "active",
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal: 12,
      attendance: 100,
      progress: 0,
      since: "امروز",
      age: 25,
      phone: "۰۹۱۲۰۰۰۲۲۲۲",
      lastSeen: "امروز",
      balance: 0,
    });

    const table = await buildExportTable("students");
    expect(table.rows.some((row) => row[0] === "هنرجوی خروجی")).toBe(true);
  });

  it("drops a student that was removed", async () => {
    const first = (await getStudentRepository().list({ per_page: 1 })).data[0];
    await getStudentRepository().delete(first.id);

    const table = await buildExportTable("students");
    expect(table.rows.some((row) => row[0] === first.name)).toBe(false);
  });

  it("exports every supported entity with a header row", async () => {
    for (const entity of ["students", "teachers", "classes", "enrollments"] as const) {
      const table = await buildExportTable(entity);
      expect(table.headers.length).toBeGreaterThan(0);
    }
  });
});

describe("encoding", () => {
  it("writes a BOM and round-trips Persian text through CSV", async () => {
    const table = await buildExportTable("students");
    const text = await blobText(serializeTable(table, "csv", "هنرجویان"));

    expect(text.charCodeAt(0)).toBe(0xfeff);
    const back = parseCsv(text);
    expect(back.headers).toEqual(table.headers);
    expect(back.rows).toHaveLength(table.rows.length);
  });

  it("round-trips through XLSX without losing national IDs", async () => {
    const table = await buildExportTable("students");
    const blob = serializeTable(table, "xlsx", "هنرجویان");
    const back = parseXlsx(new Uint8Array(await blob.arrayBuffer()));

    expect(back.headers).toEqual(table.headers);
    // Column 1 is the national ID; it must survive as an exact 10-digit string.
    expect(back.rows[0][1]).toBe(table.rows[0][1]);
    expect(back.rows[0][1]).toMatch(/^\d{10}$/);
  });
});

describe("sensitive data", () => {
  it("never exports a password, token or secret column", async () => {
    for (const entity of ["students", "teachers", "classes", "enrollments"] as const) {
      const table = await buildExportTable(entity);
      const joined = table.headers.join(" ").toLowerCase();
      expect(joined).not.toMatch(/password|token|secret|رمز|گذرواژه/);
    }
  });
});
