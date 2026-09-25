/**
 * Reusable export column definitions — single owner per entity, no duplicate column lists.
 *
 * Each definition declares explicit columns (no Object.entries leak) with Persian headers
 * and accessor functions. Sensitive fields (password, token, secret) are never included.
 * This pattern is reusable by Students/Teachers/future reports via ExportDefinition.
 */

import { instrumentName } from "@/domains/instruments/catalog";
import type { Student } from "@/domains/students/types";
import type { Teacher } from "@/domains/teachers/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Enrollment } from "@/domains/enrollments/types";
import type { LibraryItem } from "@/domains/library/types";
import type { GalleryImage } from "@/domains/gallery/types";
import type { Session } from "@/domains/scheduling/types";
import type { AttendanceRecord } from "@/domains/attendance/types";
import type { SessionCompensation } from "@/domains/compensation/types";
import type { Page } from "@/api/types";

export interface ExportColumn<T> {
  key: string;
  header: string; // Persian
  accessor: (row: T) => string;
}

export interface ExportDefinition<T, P = Record<string, unknown>> {
  entity: string;
  label: string; // Persian
  columns: ExportColumn<T>[];
  fetch: (params: P & { per_page: number }) => Promise<Page<T>>;
}

/* ---------------- Students ---------------- */

export const studentColumns: ExportColumn<Student>[] = [
  { key: "name", header: "نام", accessor: (s) => s.name },
  { key: "nationalId", header: "کد ملی", accessor: (s) => s.nationalId },
  { key: "instrument", header: "ساز", accessor: (s) => instrumentName(s.instrument) },
  { key: "level", header: "سطح", accessor: (s) => s.level },
  { key: "status", header: "وضعیت", accessor: (s) => s.status },
  { key: "phone", header: "تلفن", accessor: (s) => s.phone },
  { key: "teacherId", header: "مدرس", accessor: (s) => s.teacherId },
  { key: "sessionsUsed", header: "جلسات استفاده شده", accessor: (s) => String(s.sessionsUsed) },
  { key: "sessionsTotal", header: "کل جلسات", accessor: (s) => String(s.sessionsTotal) },
  { key: "attendance", header: "حضور %", accessor: (s) => String(s.attendance) },
  { key: "balance", header: "مانده حساب", accessor: (s) => String(s.balance) },
  { key: "since", header: "از تاریخ", accessor: (s) => s.since },
];

/* ---------------- Teachers ---------------- */

export const teacherColumns: ExportColumn<Teacher>[] = [
  { key: "name", header: "نام", accessor: (t) => t.name },
  { key: "instrument", header: "ساز", accessor: (t) => instrumentName(t.instrument) },
  { key: "title", header: "عنوان", accessor: (t) => t.title },
  { key: "phone", header: "تلفن", accessor: (t) => t.phone },
  { key: "status", header: "وضعیت", accessor: (t) => t.status },
  { key: "contractHours", header: "ساعت قرارداد", accessor: (t) => String(t.contractHours) },
  { key: "weeklyHours", header: "ساعت هفتگی", accessor: (t) => String(t.weeklyHours) },
  { key: "students", header: "هنرجویان", accessor: (t) => String(t.students) },
];

/* ---------------- Classes ---------------- */

export const classColumns: ExportColumn<AcademyClass>[] = [
  { key: "title", header: "عنوان", accessor: (c) => c.title },
  { key: "instrument", header: "ساز", accessor: (c) => instrumentName(c.instrument) },
  { key: "kind", header: "نوع", accessor: (c) => (c.kind === "group" ? "گروهی" : "انفرادی") },
  { key: "level", header: "سطح", accessor: (c) => c.level },
  { key: "teacherId", header: "مدرس", accessor: (c) => c.teacherId },
  { key: "roomId", header: "اتاق", accessor: (c) => c.roomId },
  { key: "time", header: "ساعت", accessor: (c) => c.time },
  { key: "duration", header: "مدت", accessor: (c) => String(c.duration) },
  { key: "enrolled", header: "ثبت‌نام", accessor: (c) => String(c.enrolled) },
  { key: "capacity", header: "ظرفیت", accessor: (c) => String(c.capacity) },
  { key: "waitlist", header: "لیست انتظار", accessor: (c) => String(c.waitlist) },
  { key: "tuition", header: "شهریه", accessor: (c) => String(c.tuition) },
  { key: "status", header: "وضعیت", accessor: (c) => (c.status === "archived" ? "بایگانی" : "فعال") },
];

/* ---------------- Enrollments ---------------- */

export interface EnrollmentRow {
  enrollment: Enrollment;
  studentName: string;
  className: string;
}

export const enrollmentColumns: ExportColumn<EnrollmentRow>[] = [
  { key: "student", header: "هنرجو", accessor: (r) => r.studentName },
  { key: "class", header: "کلاس", accessor: (r) => r.className },
  { key: "status", header: "وضعیت", accessor: (r) => r.enrollment.status },
  { key: "startDate", header: "تاریخ شروع", accessor: (r) => r.enrollment.startDate },
  { key: "endDate", header: "تاریخ پایان", accessor: (r) => r.enrollment.endDate ?? "" },
  { key: "pricingPlan", header: "طرح شهریه", accessor: (r) => r.enrollment.pricingPlan.label },
  { key: "amount", header: "مبلغ", accessor: (r) => String(r.enrollment.pricingPlan.amount) },
];

/* ---------------- Library ---------------- */

export const libraryColumns: ExportColumn<LibraryItem>[] = [
  { key: "title", header: "عنوان", accessor: (l) => l.title },
  { key: "composer", header: "آهنگساز", accessor: (l) => (l as any).composer ?? "" },
  { key: "kind", header: "نوع", accessor: (l) => (l as any).kind ?? "" },
  { key: "instrument", header: "ساز", accessor: (l) => (l as any).instrument ? instrumentName((l as any).instrument) : "" },
  { key: "level", header: "سطح", accessor: (l) => (l as any).level ?? "" },
  { key: "size", header: "حجم", accessor: (l) => String((l as any).size ?? "") },
  { key: "duration", header: "مدت", accessor: (l) => String((l as any).duration ?? "") },
  { key: "pages", header: "صفحات", accessor: (l) => String((l as any).pages ?? "") },
  { key: "addedAt", header: "تاریخ افزودن", accessor: (l) => (l as any).createdAt ?? (l as any).addedAt ?? "" },
  { key: "uses", header: "استفاده", accessor: (l) => String((l as any).uses ?? "") },
];

/* ---------------- Gallery ---------------- */

export const galleryColumns: ExportColumn<GalleryImage>[] = [
  { key: "albumId", header: "آلبوم", accessor: (g) => g.albumId },
  { key: "title", header: "عنوان", accessor: (g) => (g as any).title ?? (g as any).caption ?? "" },
  { key: "alt", header: "متن جایگزین", accessor: (g) => g.alt ?? "" },
  { key: "sortOrder", header: "ترتیب", accessor: (g) => String(g.sortOrder ?? "") },
  { key: "createdAt", header: "تاریخ ایجاد", accessor: (g) => g.createdAt ?? "" },
];

/* ---------------- Scheduling ---------------- */

export const schedulingColumns: ExportColumn<Session>[] = [
  { key: "date", header: "تاریخ", accessor: (s) => (s as any).date ?? (s as any).scheduledAt ?? "" },
  { key: "time", header: "ساعت", accessor: (s) => (s as any).time ?? "" },
  { key: "classId", header: "کلاس", accessor: (s) => (s as any).classId ?? "" },
  { key: "roomId", header: "اتاق", accessor: (s) => (s as any).roomId ?? "" },
  { key: "teacherId", header: "مدرس", accessor: (s) => (s as any).teacherId ?? "" },
  { key: "status", header: "وضعیت", accessor: (s) => (s as any).status ?? "" },
];

/* ---------------- Attendance ---------------- */

export const attendanceColumns: ExportColumn<AttendanceRecord>[] = [
  { key: "sessionId", header: "جلسه", accessor: (a) => a.sessionId },
  { key: "studentId", header: "هنرجو", accessor: (a) => a.studentId },
  { key: "status", header: "وضعیت", accessor: (a) => a.status },
  { key: "recordedAt", header: "تاریخ ثبت", accessor: (a) => a.recordedAt ?? "" },
  { key: "recorderId", header: "ثبت‌کننده", accessor: (a) => (a as any).recorderId ?? "" },
];

/* ---------------- Compensation ---------------- */

export const compensationColumns: ExportColumn<SessionCompensation>[] = [
  { key: "originalSessionId", header: "جلسه اصلی", accessor: (c) => (c as any).originalSessionId ?? c.id },
  { key: "studentId", header: "هنرجو", accessor: (c) => (c as any).studentId ?? "" },
  { key: "status", header: "وضعیت", accessor: (c) => c.status },
  { key: "attemptCount", header: "تلاش", accessor: (c) => String((c as any).attemptCount ?? "") },
  { key: "createdAt", header: "تاریخ ایجاد", accessor: (c) => (c as any).createdAt ?? "" },
];

/* ---------------- Dashboard tabular summary ---------------- */

export interface DashboardMetricRow {
  metric: string;
  value: string;
  derivation: string;
}

export const dashboardColumns: ExportColumn<DashboardMetricRow>[] = [
  { key: "metric", header: "شاخص", accessor: (r) => r.metric },
  { key: "value", header: "مقدار", accessor: (r) => r.value },
  { key: "derivation", header: "منبع محاسبه", accessor: (r) => r.derivation },
];
