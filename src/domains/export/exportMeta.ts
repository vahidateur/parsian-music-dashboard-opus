/**
 * The export catalogue's synchronous half.
 *
 * WHY THIS FILE EXISTS
 *
 * `EntityExportButton` renders before anything is exported: it needs the
 * entity's label and the permission that gates it, on the first frame, in the
 * entry chunk. `exportService` is the opposite kind of module — it reaches the
 * repositories, the spreadsheet encoder and every column definition, and none
 * of that is needed until the visitor actually asks for a file.
 *
 * Keeping both halves in one module made the button's static import drag the
 * whole pipeline into the entry chunk. The catalogue therefore lives here, and
 * `exportService` re-exports it, so the two halves can be imported separately
 * without changing any public name: `EntityExportButton` takes the labels and
 * permissions from here, and fetches the service itself only when a download is
 * requested.
 *
 * Nothing here reads a repository or touches the DOM. It is a table of strings
 * and types, and it must stay that way — anything with weight belongs in
 * `exportService`.
 */
import type { Permission } from "@/domains/auth/permissions";

export type ExportFormat = "csv" | "xlsx";
export type ExportEntity =
  | "students"
  | "teachers"
  | "classes"
  | "enrollments"
  | "library"
  | "gallery"
  | "scheduling"
  | "attendance"
  | "compensation"
  | "dashboard";

export const EXPORT_LABELS: Record<ExportEntity, string> = {
  students: "هنرجویان",
  teachers: "مدرسین",
  classes: "کلاس‌ها",
  enrollments: "ثبت‌نام‌ها",
  library: "کتابخانه",
  gallery: "گالری",
  scheduling: "برنامه‌ریزی",
  attendance: "حضور",
  compensation: "جبرانی",
  dashboard: "داشبورد",
};

/** Permission required to export each entity — frontend guard (M2 rule: no control if forbidden). */
export const EXPORT_PERMISSIONS: Record<ExportEntity, Permission> = {
  students: "students.read",
  teachers: "teachers.read",
  classes: "classes.read",
  enrollments: "classes.read",
  library: "library.read",
  gallery: "library.read",
  scheduling: "schedule.read",
  attendance: "attendance.read",
  compensation: "schedule.read",
  dashboard: "students.read",
};
