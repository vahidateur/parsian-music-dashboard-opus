/**
 * Export service — turns current domain state into a downloaded file.
 *
 * Exports read from the repositories, so a file always reflects what the user
 * currently sees, never a fixture. Nothing is uploaded anywhere: the blob is
 * built in the browser and handed to the user (§15).
 *
 * Sensitive-field policy: exports carry only the columns each entity's export
 * builder declares. Credentials, tokens and password hashes are never part of
 * a domain record in the first place, and the builders below are explicit
 * column lists rather than `Object.entries(record)`, so a field added later
 * cannot leak into a file by accident.
 */
import { instrumentLabel } from "@/data/academy";
import {
  getClassRepository,
  getEnrollmentRepository,
  getStudentRepository,
  getTeacherRepository,
} from "@/domains/registry";
import { safeFilename, toCsv, toXlsx } from "@/domains/import/spreadsheet";
import { studentExportRows } from "@/domains/import/studentImport";

export type ExportFormat = "csv" | "xlsx";
export type ExportEntity = "students" | "teachers" | "classes" | "enrollments";

export interface ExportTable {
  headers: string[];
  rows: string[][];
}

export const EXPORT_LABELS: Record<ExportEntity, string> = {
  students: "هنرجویان",
  teachers: "مدرسین",
  classes: "کلاس‌ها",
  enrollments: "ثبت‌نام‌ها",
};

/** Reads the current state of one entity and shapes it into a table. */
export async function buildExportTable(entity: ExportEntity): Promise<ExportTable> {
  const all = { per_page: 1000 };

  switch (entity) {
    case "students": {
      const page = await getStudentRepository().list(all);
      return studentExportRows(page.data);
    }
    case "teachers": {
      const page = await getTeacherRepository().list(all);
      return {
        headers: ["نام", "ساز", "عنوان", "تلفن", "وضعیت", "ساعت قرارداد", "ساعت هفتگی", "هنرجویان"],
        rows: page.data.map((t) => [
          t.name,
          instrumentLabel[t.instrument],
          t.title,
          t.phone,
          t.status,
          String(t.contractHours),
          String(t.weeklyHours),
          String(t.students),
        ]),
      };
    }
    case "classes": {
      const page = await getClassRepository().list({ ...all, includeArchived: true });
      return {
        headers: ["عنوان", "ساز", "نوع", "سطح", "مدرس", "اتاق", "ساعت", "مدت", "ثبت‌نام", "ظرفیت", "لیست انتظار", "شهریه", "وضعیت"],
        rows: page.data.map((c) => [
          c.title,
          instrumentLabel[c.instrument],
          c.kind === "group" ? "گروهی" : "انفرادی",
          c.level,
          c.teacherId,
          c.roomId,
          c.time,
          String(c.duration),
          String(c.enrolled),
          String(c.capacity),
          String(c.waitlist),
          String(c.tuition),
          c.status === "archived" ? "بایگانی" : "فعال",
        ]),
      };
    }
    case "enrollments": {
      const [enrollments, students, classes] = await Promise.all([
        getEnrollmentRepository().list(all),
        getStudentRepository().list(all),
        getClassRepository().list({ ...all, includeArchived: true }),
      ]);
      const studentName = new Map(students.data.map((s) => [s.id, s.name]));
      const className = new Map(classes.data.map((c) => [c.id, c.title]));
      return {
        headers: ["هنرجو", "کلاس", "وضعیت", "تاریخ شروع", "تاریخ پایان", "طرح شهریه", "مبلغ"],
        rows: enrollments.data.map((e) => [
          studentName.get(e.studentId) ?? e.studentId,
          className.get(e.classId) ?? e.classId,
          e.status,
          e.startDate,
          e.endDate ?? "",
          e.pricingPlan.label,
          String(e.pricingPlan.amount),
        ]),
      };
    }
  }
}

/** Serializes a table to bytes in the requested format. */
export function serializeTable(table: ExportTable, format: ExportFormat, title: string): Blob {
  if (format === "xlsx") {
    const bytes = toXlsx(table.headers, table.rows, title);
    // Copy into a fresh ArrayBuffer so the Blob owns its memory.
    return new Blob([bytes.slice()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  return new Blob([toCsv(table.headers, table.rows)], { type: "text/csv;charset=utf-8" });
}

/**
 * Triggers a browser download.
 *
 * Split out so the pure parts above stay testable in a non-DOM environment.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads current state, serializes it and downloads it. */
export async function exportEntity(entity: ExportEntity, format: ExportFormat): Promise<number> {
  const table = await buildExportTable(entity);
  const label = EXPORT_LABELS[entity];
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(serializeTable(table, format, label), `${label}-${stamp}.${format}`);
  return table.rows.length;
}

/** Exposed for the import screen's "download template" and error report. */
export function downloadTable(table: ExportTable, filename: string, format: ExportFormat, title: string): void {
  downloadBlob(serializeTable(table, format, title), filename);
}
