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
import {
  getAttendanceRepository,
  getClassRepository,
  getCompensationRepository,
  getEnrollmentRepository,
  getGalleryRepository,
  getLibraryRepository,
  getRoomRepository,
  getSchedulingRepository,
  getStudentRepository,
  getTeacherRepository,
} from "@/domains/registry";
import { safeFilename, toCsv, toXlsx } from "@/domains/import/spreadsheet";
import {
  attendanceColumns,
  classColumns,
  compensationColumns,
  dashboardColumns,
  galleryColumns,
  libraryColumns,
  schedulingColumns,
  studentColumns,
  teacherColumns,
  type ExportColumn,
} from "./definitions";
import { deriveOccupancy, deriveReceivables, deriveSignals, dashboardCounts } from "@/domains/shared/dashboardInsights";
import { EXPORT_LABELS, type ExportEntity, type ExportFormat } from "./exportMeta";

/*
  The catalogue (labels, permission gates, the two union types) lives in
  `exportMeta` so a surface that only needs the label does not pull the readers
  and the spreadsheet encoder with it — see that module's header. It is
  re-exported here unchanged, so every existing importer of `exportService`
  keeps the same names.
*/
export type { ExportEntity, ExportFormat } from "./exportMeta";
export { EXPORT_LABELS, EXPORT_PERMISSIONS } from "./exportMeta";

export interface ExportTable {
  headers: string[];
  rows: string[][];
  /** Total available rows in the repository (for truncation disclosure I16). */
  total?: number;
}

function tableFromColumns<T>(columns: ExportColumn<T>[], rows: T[], total?: number): ExportTable {
  return {
    headers: columns.map((c) => c.header),
    rows: rows.map((row) => columns.map((col) => col.accessor(row))),
    total: total ?? rows.length,
  };
}

/** Reads the current state of one entity and shapes it into a table. Supports filter reuse from list views. */
export async function buildExportTable(entity: ExportEntity, filters: Record<string, unknown> = {}): Promise<ExportTable> {
  const all = { per_page: 1000, ...filters };

  switch (entity) {
    case "students": {
      const page = await getStudentRepository().list(all as any);
      // Use reusable column defs — single owner, no duplicate list
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(studentColumns, page.data as any, total);
    }
    case "teachers": {
      const page = await getTeacherRepository().list(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(teacherColumns, page.data as any, total);
    }
    case "classes": {
      const page = await getClassRepository().list({ ...all, includeArchived: true } as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(classColumns, page.data as any, total);
    }
    case "enrollments": {
      const [enrollments, students, classes] = await Promise.all([
        getEnrollmentRepository().list(all as any),
        getStudentRepository().list({ per_page: 1000 } as any),
        getClassRepository().list({ per_page: 1000, includeArchived: true } as any),
      ]);
      const studentName = new Map(students.data.map((s: any) => [s.id, s.name]));
      const className = new Map(classes.data.map((c: any) => [c.id, c.title]));
      const rows = enrollments.data.map((e: any) => ({
        enrollment: e,
        studentName: studentName.get(e.studentId) ?? e.studentId,
        className: className.get(e.classId) ?? e.classId,
      }));
      const total = (enrollments as any).total ?? enrollments.data.length;
      return {
        headers: ["هنرجو", "کلاس", "وضعیت", "تاریخ شروع", "تاریخ پایان", "طرح شهریه", "مبلغ"],
        rows: rows.map((r) => [
          r.studentName,
          r.className,
          r.enrollment.status,
          r.enrollment.startDate,
          r.enrollment.endDate ?? "",
          r.enrollment.pricingPlan.label,
          String(r.enrollment.pricingPlan.amount),
        ]),
        total,
      };
    }
    case "library": {
      const page = await getLibraryRepository().list(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(libraryColumns, page.data as any, total);
    }
    case "gallery": {
      const page = await getGalleryRepository().listImages(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(galleryColumns, page.data as any, total);
    }
    case "scheduling": {
      const page = await getSchedulingRepository().list(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(schedulingColumns, page.data as any, total);
    }
    case "attendance": {
      const page = await getAttendanceRepository().list(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(attendanceColumns, page.data as any, total);
    }
    case "compensation": {
      const page = await getCompensationRepository().list(all as any);
      const total = (page as any).total ?? page.data.length;
      return tableFromColumns(compensationColumns, page.data as any, total);
    }
    case "dashboard": {
      // Dashboard tabular summary reuse canonical calc — no duplicate engine, respects date-range filters
      const from = (filters as any).from as string | undefined;
      const to = (filters as any).to as string | undefined;
      const todayIso = (to as string) ?? new Date().toISOString().slice(0, 10);
      const [studentsPage, classesPage, roomsPage, teachersPage, sessionsPage] = await Promise.all([
        getStudentRepository().list({ per_page: 1000 } as any),
        getClassRepository().list({ per_page: 1000, includeArchived: true } as any),
        getRoomRepository().list({ per_page: 1000 } as any),
        getTeacherRepository().list({ per_page: 1000 } as any),
        getSchedulingRepository().list({ per_page: 500, ...(from ? { from } : {}), ...(to ? { to } : {}) } as any),
      ]);
      const students = studentsPage.data as any[];
      const classes = classesPage.data as any[];
      const rooms = roomsPage.data as any[];
      const teachers = teachersPage.data as any[];
      const sessions = sessionsPage.data as any[];

      const metrics = null; // hero metrics require bounded window, keep null for export to avoid fabricated

      // Reuse canonical derivations — single source for visualization and export
      const signals = deriveSignals({ metrics, students, classes, rooms, teachers: teachers.map((t: any) => ({ id: t.id, name: t.name })), sessions, todayIso, nowMinutes: 0 } as any);
      const occupancy = deriveOccupancy(classes, rooms);
      const receivables = deriveReceivables(students);
      const counts = dashboardCounts({ students, classes, rooms, teachers: teachers.length, sessions });

      const rows: { metric: string; value: string; derivation: string }[] = [
        { metric: "تعداد هنرجویان", value: String(counts.students), derivation: "students.length" },
        { metric: "تعداد کلاس‌ها", value: String(counts.classes), derivation: "classes.length (includeArchived)" },
        { metric: "تعداد اتاق‌ها", value: String(counts.rooms), derivation: "rooms.length" },
        { metric: "تعداد مدرسین", value: String(counts.teachers), derivation: "teachers.length" },
        { metric: "جلسات در بازه", value: String(sessions.length), derivation: `sessions from ${from ?? "13w"} to ${to ?? todayIso}` },
        { metric: "جلسات ۷ روز گذشته", value: signals.find((s) => s.id === "sessions")?.value ?? "—", derivation: "weeklyCounts(sessions, date, todayIso)" },
        { metric: "لغوهای ۳۰ روز گذشته", value: signals.find((s) => s.id === "cancellations")?.value ?? "—", derivation: "weeklyCounts cancelled" },
        { metric: "هنرجویان نیازمند توجه", value: signals.find((s) => s.id === "at-risk")?.value ?? "—", derivation: "students.filter status at-risk" },
        { metric: "نرخ حضور ثبت‌شده", value: signals.find((s) => s.id === "attendance")?.value ?? "—", derivation: "meanOf attendance where sessionsTotal>0" },
        { metric: "اشغال ظرفیت کل", value: occupancy.overallPct !== null ? `${occupancy.overallPct}%` : "—", derivation: "takenSeats/totalSeats" },
        { metric: "صندلی آزاد", value: String(occupancy.seatsFree), derivation: "classes.filter enrolled<capacity" },
        { metric: "مانده حساب کل", value: String(receivables.total), derivation: "sum balance>0" },
        { metric: "هنرجویان بدهکار", value: String(receivables.owing), derivation: "students.filter balance>0" },
      ];

      return tableFromColumns(dashboardColumns, rows as any, rows.length);
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

export interface ExportResult {
  count: number;
  total: number;
  truncated: boolean;
}

/** Reads current state, serializes it and downloads it. Supports filter reuse. */
export async function exportEntity(
  entity: ExportEntity,
  format: ExportFormat,
  filters: Record<string, unknown> = {},
): Promise<ExportResult> {
  const table = await buildExportTable(entity, filters);
  const label = EXPORT_LABELS[entity];
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(serializeTable(table, format, label), `${label}-${stamp}.${format}`);
  const total = table.total ?? table.rows.length;
  return { count: table.rows.length, total, truncated: total > table.rows.length };
}

/** Back-compat for older callers that expected number — returns count only. */
export async function exportEntityCount(entity: ExportEntity, format: ExportFormat): Promise<number> {
  const result = await exportEntity(entity, format);
  return result.count;
}

/** Exposed for the import screen's "download template" and error report. */
export function downloadTable(table: ExportTable, filename: string, format: ExportFormat, title: string): void {
  downloadBlob(serializeTable(table, format, title), filename);
}
