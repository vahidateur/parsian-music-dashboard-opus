/**
 * Student import: column definitions, validation and commit.
 *
 * `national_id` is the reason this file is careful. It is required, normalized
 * and checksum-validated, and must be unique both against existing records and
 * *within the uploaded file* — a spreadsheet that lists the same person twice
 * is a common real-world error and must be caught before anything is written.
 *
 * Validation never weakens to accommodate a bad spreadsheet: an invalid row is
 * reported with its row number and reason, and the user decides whether to fix
 * the file or import the remaining valid rows.
 */
import { instrumentLabel, type Instrument } from "@/data/academy";
import { studentStatusLabel, type Student, type StudentStatus } from "@/data/records";
import { nationalIdError, normalizeNationalId } from "@/lib/nationalId";
import { apiErrorFromThrown } from "@/api/errors";
import { getStudentRepository, getTeacherRepository } from "@/domains/registry";
import type { CreateStudentInput } from "@/domains/students/types";
import type { ColumnMapping, ImportField, ImportResult, RowIssue, ValidatedRow, ValidationReport } from "./types";
import { isFormulaLike } from "./spreadsheet";

export const STUDENT_FIELDS: ImportField[] = [
  { key: "name", label: "نام و نام خانوادگی", required: true, aliases: ["name", "نام", "نام و نام خانوادگی", "fullname", "full name"] },
  { key: "nationalId", label: "کد ملی", required: true, aliases: ["national_id", "nationalid", "کد ملی", "کدملی", "melli"], hint: "۱۰ رقم، با اعتبارسنجی" },
  { key: "instrument", label: "ساز", required: true, aliases: ["instrument", "ساز"] },
  { key: "teacher", label: "مدرس", required: false, aliases: ["teacher", "مدرس", "teacher_name"], hint: "نام یا شناسهٔ مدرس" },
  { key: "guardian", label: "ولی", required: false, aliases: ["guardian", "ولی", "سرپرست", "parent"] },
  { key: "phone", label: "تلفن", required: true, aliases: ["phone", "تلفن", "موبایل", "mobile"] },
  { key: "status", label: "وضعیت", required: false, aliases: ["status", "وضعیت"] },
  { key: "age", label: "سن", required: false, aliases: ["age", "سن"] },
  { key: "level", label: "سطح", required: false, aliases: ["level", "سطح"] },
  { key: "sessionsTotal", label: "کل جلسات", required: false, aliases: ["sessions", "sessions_total", "کل جلسات", "جلسات"] },
];

/** Reverse lookup so a file can use Persian labels for enum values. */
const INSTRUMENT_BY_LABEL = new Map<string, Instrument>(
  (Object.keys(instrumentLabel) as Instrument[]).flatMap((key) => [
    [key.toLowerCase(), key] as const,
    [instrumentLabel[key], key] as const,
  ]),
);

const STATUS_BY_LABEL = new Map<string, StudentStatus>(
  (Object.keys(studentStatusLabel) as StudentStatus[]).flatMap((key) => [
    [key.toLowerCase(), key] as const,
    [studentStatusLabel[key], key] as const,
  ]),
);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

/** Best-effort column mapping from the file's headers; the user can override. */
export function autoMapColumns(headers: string[], fields: ImportField[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(normalizeHeader);
  for (const field of fields) {
    const aliases = field.aliases.map(normalizeHeader);
    const index = normalized.findIndex((header) => aliases.includes(header));
    mapping[field.key] = index >= 0 ? index : null;
  }
  return mapping;
}

/** Persian/Arabic digits to ASCII, so "۲۰" parses as a number. */
function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export interface StudentImportContext {
  /** National IDs already stored, normalized. */
  existingNationalIds: Set<string>;
  /** Teacher id and lowercase name → teacher id. */
  teacherLookup: Map<string, string>;
  /** Fallback teacher when a row does not name one. */
  defaultTeacherId: string;
}

export async function loadStudentImportContext(): Promise<StudentImportContext> {
  const [students, teachers] = await Promise.all([
    getStudentRepository().list({ per_page: 1000 }),
    getTeacherRepository().list({ per_page: 500 }),
  ]);

  const teacherLookup = new Map<string, string>();
  for (const teacher of teachers.data) {
    teacherLookup.set(teacher.id.toLowerCase(), teacher.id);
    teacherLookup.set(teacher.name.trim().toLowerCase(), teacher.id);
  }

  return {
    existingNationalIds: new Set(students.data.map((s) => normalizeNationalId(s.nationalId))),
    teacherLookup,
    defaultTeacherId: teachers.data[0]?.id ?? "",
  };
}

/**
 * Validates every row of the file. Nothing is written here — the caller
 * inspects the report and decides whether to commit.
 */
export function validateStudentRows(
  rows: string[][],
  mapping: ColumnMapping,
  context: StudentImportContext,
): ValidationReport<CreateStudentInput> {
  const out: ValidatedRow<CreateStudentInput>[] = [];
  // Tracks IDs seen earlier in this same file, so in-file duplicates are caught.
  const seenInFile = new Map<string, number>();
  let duplicates = 0;

  const cellAt = (row: string[], key: string): string => {
    const index = mapping[key];
    if (index === null || index === undefined) return "";
    return (row[index] ?? "").trim();
  };

  rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const issues: RowIssue[] = [];
    const error = (field: string, message: string) => issues.push({ row: rowNumber, field, level: "error", message });
    const warn = (field: string, message: string) => issues.push({ row: rowNumber, field, level: "warning", message });

    // A cell that looks like a formula is never silently accepted as data.
    for (const field of STUDENT_FIELDS) {
      const raw = cellAt(row, field.key);
      if (raw && isFormulaLike(raw)) {
        error(field.key, "مقدار این سلول شبیه فرمول است و پذیرفته نمی‌شود.");
      }
    }

    const name = cellAt(row, "name");
    if (name.length < 2) error("name", "نام الزامی است.");

    /* ---- national_id: the hard invariant ---- */
    const rawNationalId = cellAt(row, "nationalId");
    let nationalId = "";
    if (!rawNationalId) {
      error("nationalId", "کد ملی الزامی است.");
    } else {
      nationalId = normalizeNationalId(rawNationalId);
      const idError = nationalIdError(nationalId);
      if (idError) {
        error("nationalId", idError);
      } else if (context.existingNationalIds.has(nationalId)) {
        duplicates += 1;
        error("nationalId", "این کد ملی از قبل در سامانه ثبت شده است.");
      } else if (seenInFile.has(nationalId)) {
        duplicates += 1;
        error("nationalId", `این کد ملی در سطر ${seenInFile.get(nationalId)} همین فایل تکرار شده است.`);
      } else {
        seenInFile.set(nationalId, rowNumber);
      }
    }

    /* ---- instrument ---- */
    const rawInstrument = cellAt(row, "instrument");
    const instrument = INSTRUMENT_BY_LABEL.get(rawInstrument.toLowerCase()) ?? INSTRUMENT_BY_LABEL.get(rawInstrument);
    if (!instrument) error("instrument", `ساز «${rawInstrument || "—"}» شناخته نشد.`);

    /* ---- teacher (optional, falls back with a warning) ---- */
    const rawTeacher = cellAt(row, "teacher");
    let teacherId = context.defaultTeacherId;
    if (rawTeacher) {
      const found = context.teacherLookup.get(rawTeacher.toLowerCase());
      if (found) teacherId = found;
      else error("teacher", `مدرس «${rawTeacher}» پیدا نشد.`);
    } else if (context.defaultTeacherId) {
      warn("teacher", "مدرس مشخص نشده؛ مدرس پیش‌فرض در نظر گرفته شد.");
    } else {
      error("teacher", "هیچ مدرسی در سامانه وجود ندارد؛ ابتدا یک مدرس ثبت کنید.");
    }

    /* ---- phone ---- */
    const phone = cellAt(row, "phone");
    if (!/^[0-9۰-۹\s+·-]{6,}$/.test(phone)) error("phone", "شمارهٔ تماس معتبر نیست.");

    /* ---- optional fields ---- */
    const rawStatus = cellAt(row, "status");
    let status: StudentStatus = "active";
    if (rawStatus) {
      const found = STATUS_BY_LABEL.get(rawStatus.toLowerCase()) ?? STATUS_BY_LABEL.get(rawStatus);
      if (found) status = found;
      else warn("status", `وضعیت «${rawStatus}» شناخته نشد؛ «فعال» در نظر گرفته شد.`);
    }

    const rawAge = toAsciiDigits(cellAt(row, "age"));
    let age = 18;
    if (rawAge) {
      const parsed = Number(rawAge);
      if (!Number.isInteger(parsed) || parsed < 3 || parsed > 99) warn("age", "سن نامعتبر بود و نادیده گرفته شد.");
      else age = parsed;
    }

    const rawSessions = toAsciiDigits(cellAt(row, "sessionsTotal"));
    let sessionsTotal = 12;
    if (rawSessions) {
      const parsed = Number(rawSessions);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) warn("sessionsTotal", "تعداد جلسات نامعتبر بود و مقدار پیش‌فرض اعمال شد.");
      else sessionsTotal = parsed;
    }

    const hasError = issues.some((issue) => issue.level === "error");
    if (hasError || !instrument) {
      out.push({ row: rowNumber, issues });
      return;
    }

    const value: CreateStudentInput = {
      nationalId,
      name,
      instrument,
      teacherId,
      status,
      phone,
      guardian: cellAt(row, "guardian") || undefined,
      age,
      level: cellAt(row, "level") || "سطح ۱ · پایه",
      levelStep: 1,
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal,
      attendance: 100,
      progress: 0,
      since: "امروز",
      lastSeen: "امروز",
      balance: 0,
    };
    out.push({ row: rowNumber, value, issues });
  });

  const valid = out.filter((r) => r.value !== undefined);
  const failed = out.filter((r) => r.value === undefined);
  const allIssues = out.flatMap((r) => r.issues);

  return {
    rows: out,
    valid,
    failed,
    warnings: allIssues.filter((i) => i.level === "warning"),
    errors: allIssues.filter((i) => i.level === "error"),
    duplicates,
    total: rows.length,
  };
}

/**
 * Writes the valid rows.
 *
 * `atomic` mode refuses to write anything when the file contains any invalid
 * row — the default, because a partial import of a payroll-adjacent list is
 * usually worse than no import. When the user explicitly opts out, valid rows
 * are imported and failures are reported per row.
 *
 * BACKEND REQUIRED: the demo commits row by row, so a mid-way repository
 * failure can leave earlier rows written. Real atomicity needs a server-side
 * database transaction; this is stated rather than papered over.
 */
export async function commitStudentImport(
  report: ValidationReport<CreateStudentInput>,
  options: { atomic: boolean },
): Promise<ImportResult> {
  if (options.atomic && report.failed.length > 0) {
    return {
      imported: 0,
      failed: report.failed.length,
      skipped: report.valid.length,
      errors: report.errors,
      warnings: report.warnings,
      aborted: true,
      message: `به دلیل ${report.failed.length} سطر نامعتبر هیچ رکوردی وارد نشد. فایل را اصلاح کنید یا حالت «ورود سطرهای معتبر» را انتخاب کنید.`,
    };
  }

  const repository = getStudentRepository();
  const errors: RowIssue[] = [...report.errors];
  let imported = 0;

  for (const row of report.valid) {
    if (!row.value) continue;
    try {
      await repository.create(row.value);
      imported += 1;
    } catch (cause) {
      // A rejection here is a real failure and is reported as one.
      errors.push({ row: row.row, field: "nationalId", level: "error", message: apiErrorFromThrown(cause).message });
    }
  }

  const failed = report.failed.length + (report.valid.length - imported);
  return {
    imported,
    failed,
    skipped: 0,
    errors,
    warnings: report.warnings,
    aborted: false,
    message:
      failed === 0
        ? `${imported} هنرجو با موفقیت وارد شد.`
        : `${imported} هنرجو وارد شد و ${failed} سطر ناموفق بود.`,
  };
}

/** Builds a downloadable error report as CSV rows. */
export function errorReportRows(issues: RowIssue[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["سطر", "ستون", "نوع", "پیام"],
    rows: issues.map((issue) => [
      String(issue.row),
      issue.field,
      issue.level === "error" ? "خطا" : "هشدار",
      issue.message,
    ]),
  };
}

/** A template users can fill in, so column names always match. */
export function studentTemplate(): { headers: string[]; rows: string[][] } {
  return {
    headers: STUDENT_FIELDS.map((f) => f.label),
    rows: [["سارا محمدی", "2000535658", "پیانو", "", "", "09120000000", "فعال", "20", "سطح ۱", "12"]],
  };
}

/** Columns produced by a student export, and the row builder. */
export function studentExportRows(students: Student[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["نام", "کد ملی", "ساز", "مدرس", "ولی", "تلفن", "وضعیت", "سن", "سطح", "جلسات انجام‌شده", "کل جلسات", "مانده حساب"],
    rows: students.map((s) => [
      s.name,
      s.nationalId,
      instrumentLabel[s.instrument],
      s.teacherId,
      s.guardian ?? "",
      s.phone,
      studentStatusLabel[s.status],
      String(s.age),
      s.level,
      String(s.sessionsUsed),
      String(s.sessionsTotal),
      String(s.balance),
    ]),
  };
}
