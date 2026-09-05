/**
 * Demo backup envelope + validation.
 *
 * A backup is a portable, versioned snapshot of the DEMO environment only.
 * It is explicitly not a production database backup and never carries
 * credentials, tokens or browser/session state.
 */
import { DEMO_COLLECTIONS, type DemoCollectionName, type DemoDataset, type DemoDatasetStats } from "./types";
import { SEED_VERSION } from "./seed";

/** Bump only on breaking changes to the envelope/dataset contract. */
export const BACKUP_SCHEMA_VERSION = "1.0";
export const BACKUP_ENVIRONMENT = "demo" as const;
export const BACKUP_KIND = "arena.demo.backup" as const;

export interface DemoBackup {
  kind: typeof BACKUP_KIND;
  schemaVersion: string;
  environment: typeof BACKUP_ENVIRONMENT;
  /** ISO timestamp. The only intentionally non-deterministic field. */
  exportedAt: string;
  app: { name: string; seedVersion: string };
  stats: DemoDatasetStats;
  data: DemoDataset;
}

/**
 * Keys that must never appear anywhere inside a backup payload.
 * Note: `sessionId` is deliberately absent — it is a legitimate *class session*
 * reference in this domain, not a browser session.
 */
export const FORBIDDEN_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "sessiontoken",
  "session_token",
  "cookie",
  "credentials",
  "authorization",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_KEYS.map((k) => k.toLowerCase()));

export function datasetStats(dataset: DemoDataset): DemoDatasetStats {
  const counts = {} as Record<DemoCollectionName, number>;
  let total = 0;
  for (const name of DEMO_COLLECTIONS) {
    const size = dataset[name]?.length ?? 0;
    counts[name] = size;
    total += size;
  }
  return { seedVersion: SEED_VERSION, counts, total };
}

export function createBackup(dataset: DemoDataset, exportedAt: Date = new Date()): DemoBackup {
  return {
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    environment: BACKUP_ENVIRONMENT,
    exportedAt: exportedAt.toISOString(),
    app: { name: "Arena — Ava Music Academy (DEMO)", seedVersion: SEED_VERSION },
    stats: datasetStats(dataset),
    data: dataset,
  };
}

export function backupFileName(date: Date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `arena-demo-backup-${stamp}.json`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ValidationCode =
  | "MALFORMED_JSON"
  | "NOT_AN_OBJECT"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "WRONG_ENVIRONMENT"
  | "MISSING_COLLECTION"
  | "INVALID_COLLECTION"
  | "MISSING_ID"
  | "DUPLICATE_ID"
  | "INVALID_REFERENCE"
  | "FORBIDDEN_FIELD";

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  path?: string;
}

export type ValidationResult =
  | { ok: true; backup: DemoBackup; warnings: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

function issue(code: ValidationCode, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

/** Parses raw JSON text into a validated backup. Never throws. */
export function parseBackup(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, issues: [issue("MALFORMED_JSON", "فایل پشتیبان یک JSON معتبر نیست.")] };
  }
  return validateBackup(parsed);
}

export function validateBackup(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [issue("NOT_AN_OBJECT", "ساختار فایل پشتیبان معتبر نیست.")] };
  }
  const candidate = input as Partial<DemoBackup>;

  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    issues.push(
      issue(
        "UNSUPPORTED_SCHEMA_VERSION",
        `نسخهٔ ساختار پشتیبان پشتیبانی نمی‌شود (انتظار ${BACKUP_SCHEMA_VERSION}، دریافت ${String(candidate.schemaVersion)}).`,
        "schemaVersion",
      ),
    );
  }
  if (candidate.environment !== BACKUP_ENVIRONMENT) {
    issues.push(issue("WRONG_ENVIRONMENT", "این فایل متعلق به محیط دمو نیست.", "environment"));
  }

  const data = candidate.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    issues.push(issue("NOT_AN_OBJECT", "بخش data در فایل پشتیبان وجود ندارد.", "data"));
    return { ok: false, issues };
  }

  issues.push(...validateDataset(data as DemoDataset));
  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, backup: candidate as DemoBackup, warnings: [] };
}

/** Structural + referential integrity checks over a dataset. */
export function validateDataset(dataset: DemoDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (typeof dataset.organization !== "object" || dataset.organization === null) {
    issues.push(issue("MISSING_COLLECTION", "تنظیمات آموزشگاه در داده وجود ندارد.", "organization"));
  }

  for (const name of DEMO_COLLECTIONS) {
    const value = dataset[name] as unknown;
    if (value === undefined) {
      issues.push(issue("MISSING_COLLECTION", `مجموعهٔ «${name}» وجود ندارد.`, name));
      continue;
    }
    if (!Array.isArray(value)) {
      issues.push(issue("INVALID_COLLECTION", `مجموعهٔ «${name}» باید آرایه باشد.`, name));
    }
  }
  if (issues.length > 0) return issues;

  // Ids: present and unique within each collection.
  const ids: Partial<Record<DemoCollectionName, Set<string>>> = {};
  for (const name of DEMO_COLLECTIONS) {
    const seen = new Set<string>();
    (dataset[name] as ReadonlyArray<{ id?: unknown }>).forEach((row, index) => {
      const id = row?.id;
      if (typeof id !== "string" || id.length === 0) {
        // `attendance` rosters are keyed by sessionId rather than id.
        if (name === "attendance") return;
        issues.push(issue("MISSING_ID", `رکورد بدون شناسه در «${name}».`, `${name}[${index}]`));
        return;
      }
      if (seen.has(id)) issues.push(issue("DUPLICATE_ID", `شناسهٔ تکراری «${id}» در «${name}».`, `${name}[${index}]`));
      seen.add(id);
    });
    ids[name] = seen;
  }

  const has = (name: DemoCollectionName, id: string) => ids[name]?.has(id) ?? false;
  const ref = (ok: boolean, path: string, message: string) => {
    if (!ok) issues.push(issue("INVALID_REFERENCE", message, path));
  };

  dataset.classes.forEach((cls, i) => {
    ref(has("teachers", cls.teacherId), `classes[${i}].teacherId`, `کلاس «${cls.id}» به مدرس ناموجود ارجاع دارد.`);
    ref(has("rooms", cls.roomId), `classes[${i}].roomId`, `کلاس «${cls.id}» به اتاق ناموجود ارجاع دارد.`);
  });

  dataset.enrollments.forEach((e, i) => {
    ref(has("students", e.studentId), `enrollments[${i}].studentId`, `ثبت‌نام «${e.id}» به هنرجوی ناموجود ارجاع دارد.`);
    ref(has("classes", e.classId), `enrollments[${i}].classId`, `ثبت‌نام «${e.id}» به کلاس ناموجود ارجاع دارد.`);
  });

  dataset.sessions.forEach((s, i) => {
    ref(has("classes", s.classId), `sessions[${i}].classId`, `جلسهٔ «${s.id}» به کلاس ناموجود ارجاع دارد.`);
    ref(has("teachers", s.teacherId), `sessions[${i}].teacherId`, `جلسهٔ «${s.id}» به مدرس ناموجود ارجاع دارد.`);
    ref(has("rooms", s.roomId), `sessions[${i}].roomId`, `جلسهٔ «${s.id}» به اتاق ناموجود ارجاع دارد.`);
  });

  const sessionIds = new Set(dataset.sessions.map((s) => s.id));
  dataset.attendance.forEach((roster, i) => {
    ref(sessionIds.has(roster.sessionId), `attendance[${i}].sessionId`, `حضور و غیاب به جلسهٔ ناموجود ارجاع دارد.`);
    roster.entries.forEach((entry, j) => {
      ref(
        has("students", entry.studentId),
        `attendance[${i}].entries[${j}].studentId`,
        `حضور و غیاب به هنرجوی ناموجود ارجاع دارد.`,
      );
    });
  });

  dataset.invoices.forEach((inv, i) => {
    ref(has("students", inv.studentId), `invoices[${i}].studentId`, `فاکتور «${inv.id}» به هنرجوی ناموجود ارجاع دارد.`);
  });
  dataset.payments.forEach((p, i) => {
    ref(has("students", p.studentId), `payments[${i}].studentId`, `پرداخت «${p.id}» به هنرجوی ناموجود ارجاع دارد.`);
  });
  dataset.users.forEach((u, i) => {
    ref(has("roles", u.roleId), `users[${i}].roleId`, `کاربر «${u.id}» به نقش ناموجود ارجاع دارد.`);
  });

  issues.push(...findForbiddenKeys(dataset));
  return issues;
}

/** Defensive scan: a backup must never carry credential-like fields. */
export function findForbiddenKeys(value: unknown, path = "data"): ValidationIssue[] {
  const found: ValidationIssue[] = [];
  const walk = (node: unknown, at: string, depth: number): void => {
    if (depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${at}[${i}]`, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
        found.push(issue("FORBIDDEN_FIELD", `فیلد حساس «${key}» مجاز نیست.`, `${at}.${key}`));
      }
      walk(child, `${at}.${key}`, depth + 1);
    }
  };
  walk(value, path, 0);
  return found;
}
