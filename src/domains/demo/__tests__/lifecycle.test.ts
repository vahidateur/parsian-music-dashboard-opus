/**
 * §17 data lifecycle: CRUD, import, backup, restore, reset and clear must all
 * agree on one dataset, and repositories must reflect the state afterwards.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { demoStore } from "@/services/demoStore";
import { demoDataManager } from "@/domains/demo/demoDataManager";
import { getClassRepository, getStudentRepository, resetRegistry } from "@/domains/registry";
import { parseCsv } from "@/domains/import/spreadsheet";
import {
  STUDENT_FIELDS,
  autoMapColumns,
  commitStudentImport,
  loadStudentImportContext,
  validateStudentRows,
} from "@/domains/import/studentImport";

const confirmed = { confirm: true } as const;

beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

async function importOneStudent(name: string, nationalId: string) {
  const sheet = parseCsv(`name,national_id,instrument,phone\n${name},${nationalId},پیانو,09120000000`);
  const mapping = autoMapColumns(sheet.headers, STUDENT_FIELDS);
  const context = await loadStudentImportContext();
  const report = validateStudentRows(sheet.rows, mapping, context);
  return commitStudentImport(report, { atomic: true });
}

describe("demo data lifecycle", () => {
  it("a backup taken after a create restores that record", async () => {
    await getStudentRepository().create({
      nationalId: "2000535658",
      name: "هنرجوی پشتیبان",
      instrument: "piano",
      teacherId: "t1",
      level: "سطح ۱",
      levelStep: 1,
      status: "active",
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal: 12,
      attendance: 100,
      progress: 0,
      since: "امروز",
      age: 20,
      phone: "۰۹۱۲۰۰۰۰۰۰۰",
      lastSeen: "امروز",
      balance: 0,
    });

    const backup = demoDataManager.exportBackupJson();

    // Destroy the state, then bring it back.
    demoDataManager.resetToSeed(confirmed);
    let page = await getStudentRepository().list({ per_page: 500 });
    expect(page.data.some((s) => s.name === "هنرجوی پشتیبان")).toBe(false);

    const restored = demoDataManager.restoreBackup(backup, confirmed);
    expect(restored.ok).toBe(true);

    page = await getStudentRepository().list({ per_page: 500 });
    expect(page.data.some((s) => s.name === "هنرجوی پشتیبان")).toBe(true);
  });

  it("a backup includes imported records", async () => {
    const result = await importOneStudent("وارداتی", "2000535658");
    expect(result.imported).toBe(1);

    const backup = demoDataManager.exportBackupJson();
    expect(backup).toContain("وارداتی");
  });

  it("reset returns the repositories to the canonical seed", async () => {
    await importOneStudent("موقتی", "2000535658");
    const withImport = (await getStudentRepository().list({ per_page: 500 })).meta.total;

    demoDataManager.resetToSeed(confirmed);
    const afterReset = (await getStudentRepository().list({ per_page: 500 })).meta.total;

    expect(afterReset).toBe(withImport - 1);
    const page = await getStudentRepository().list({ per_page: 500 });
    expect(page.data.some((s) => s.name === "موقتی")).toBe(false);
  });

  it("clear leaves a defined empty state that repositories handle", async () => {
    demoDataManager.clear(confirmed);

    const students = await getStudentRepository().list({ per_page: 500 });
    const classes = await getClassRepository().list({ per_page: 500 });
    expect(students.meta.total).toBe(0);
    expect(classes.meta.total).toBe(0);
  });

  it("rejects a restore whose students violate the national-ID invariant", () => {
    const backup = JSON.parse(demoDataManager.exportBackupJson()) as {
      data: { students: { nationalId: string }[] };
    };
    backup.data.students[0].nationalId = "1234567890"; // checksum-invalid

    const result = demoDataManager.restoreBackup(JSON.stringify(backup), confirmed);
    expect(result.ok).toBe(false);
  });

  it("rejects a restore containing duplicate national IDs", () => {
    const backup = JSON.parse(demoDataManager.exportBackupJson()) as {
      data: { students: { nationalId: string }[] };
    };
    backup.data.students[1].nationalId = backup.data.students[0].nationalId;

    const result = demoDataManager.restoreBackup(JSON.stringify(backup), confirmed);
    expect(result.ok).toBe(false);
  });

  it("seeded classes agree with seeded enrollments", async () => {
    // The projection invariant must hold from the very first read, before any
    // write "corrects" it.
    const classes = await getClassRepository().list({ per_page: 500, includeArchived: true });
    for (const cls of classes.data) {
      expect(cls.enrolled).toBe(cls.studentIds.length);
      expect(cls.enrolled).toBeLessThanOrEqual(cls.capacity);
    }
  });
});
