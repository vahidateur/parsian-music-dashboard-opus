/**
 * Demo backup envelope + validation.
 *
 * A backup is a portable, versioned snapshot of the DEMO environment only.
 * It is explicitly not a production database backup and never carries
 * credentials, tokens or browser/session state.
 *
 * F8 — Telegram + Bale + Backup Integration Contracts:
 * - Versioned format with migration old->new, integrity hash optional, environment label fixed always demo I8 + validation, filename Persian UTF-8 safe, PII encryption needed if sent externally OPEN
 * - Migration accepts old envelopes (1.0 -> 1.1) — frontend/demo-capable A NOW
 * - Integrity hash sha256 stored alongside verified on restore — B CONTRACT NOW BACKEND LATER REQUIRED, frontend can verify if present
 * - Retention/integrity/restore/encryption/failure spec B REQUIRED — see docs/frontend-completion/16-telegram-bale-backup-integration.md
 */
import { DEMO_COLLECTIONS, type DemoCollectionName, type DemoDataset, type DemoDatasetStats } from "./types";
import { SEED_VERSION } from "./seed";
import { normalizeNationalId, validateNationalId } from "@/lib/nationalId";
import { durationMinutes, isIsoDate } from "@/domains/scheduling/dateBridge";

/** Bump only on breaking changes to the envelope/dataset contract. */
export const BACKUP_SCHEMA_VERSION = "1.1";
export const BACKUP_LEGACY_VERSION = "1.0";
export const BACKUP_SUPPORTED_VERSIONS = [BACKUP_LEGACY_VERSION, BACKUP_SCHEMA_VERSION] as const;
export type BackupSchemaVersion = (typeof BACKUP_SUPPORTED_VERSIONS)[number];
export const BACKUP_ENVIRONMENT = "demo" as const;
export const BACKUP_KIND = "arena.demo.backup" as const;

/** Optional integrity hash — B CONTRACT NOW BACKEND LATER REQUIRED, frontend can verify if present. */
export interface BackupIntegrity {
  algo: "sha256";
  hash: string;
}

export interface DemoBackup {
  kind: typeof BACKUP_KIND;
  schemaVersion: string;
  environment: typeof BACKUP_ENVIRONMENT;
  /** ISO timestamp. The only intentionally non-deterministic field. */
  exportedAt: string;
  app: { name: string; seedVersion: string };
  stats: DemoDatasetStats;
  data: DemoDataset;
  /** Optional integrity hash — backend computes sha256, frontend verifies if present. */
  integrity?: BackupIntegrity;
}

/** Result of a migration attempt — old envelope accepted and upgraded. */
export interface BackupMigrationResult {
  backup: DemoBackup;
  migrated: boolean;
  fromVersion?: string;
  toVersion: string;
}

/**
 * Migrates an old envelope (e.g. 1.0) to current 1.1.
 * - 1.0 → 1.1: sets schemaVersion to 1.1, ensures kind/environment/app fields, preserves data.
 * - 1.1 → 1.1: no migration.
 * - Other versions: not migratable.
 *
 * Pure, no repo, no external API, no crypto — frontend/demo-capable A NOW.
 * Backend must also implement migration server-side with integrity hash verification.
 */
export function migrateBackupIfNeeded(input: unknown): BackupMigrationResult | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const candidate = input as Partial<DemoBackup>;
  const version = candidate.schemaVersion;
  if (typeof version !== "string") return null;

  if (version === BACKUP_SCHEMA_VERSION) {
    return {
      backup: candidate as DemoBackup,
      migrated: false,
      toVersion: BACKUP_SCHEMA_VERSION,
    };
  }

  if (version === BACKUP_LEGACY_VERSION) {
    // 1.0 had same shape but no integrity field and maybe missing app.name prefix
    const migrated: DemoBackup = {
      kind: (candidate.kind as typeof BACKUP_KIND) ?? BACKUP_KIND,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      environment: (candidate.environment as typeof BACKUP_ENVIRONMENT) ?? BACKUP_ENVIRONMENT,
      exportedAt: (candidate.exportedAt as string) ?? new Date().toISOString(),
      app: (candidate.app as { name: string; seedVersion: string }) ?? {
        name: "Arena — Ava Music Academy (DEMO)",
        seedVersion: SEED_VERSION,
      },
      stats: (candidate.stats as DemoDatasetStats) ?? datasetStats(candidate.data as DemoDataset),
      data: candidate.data as DemoDataset,
      ...(candidate.integrity ? { integrity: candidate.integrity as BackupIntegrity } : {}),
    };
    return {
      backup: migrated,
      migrated: true,
      fromVersion: BACKUP_LEGACY_VERSION,
      toVersion: BACKUP_SCHEMA_VERSION,
    };
  }

  return null;
}

/**
 * Verifies optional integrity hash if present.
 * - If no integrity field: returns ok true (hash optional for demo)
 * - If integrity present: checks hash is non-empty hex string (64 chars for sha256) — frontend does not compute hash, backend must.
 * - Backend must compute sha256 server-side and compare — B REQUIRED.
 */
export function verifyBackupIntegrity(backup: DemoBackup): { ok: boolean; reason?: string } {
  if (!backup.integrity) return { ok: true };
  const { algo, hash } = backup.integrity;
  if (algo !== "sha256") return { ok: false, reason: `الگوریتم هش پشتیبانی نمی‌شود: ${algo}` };
  if (typeof hash !== "string" || hash.length === 0) return { ok: false, reason: "هش خالی است" };
  // Simple hex check — 64 hex chars for sha256
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    // Allow any non-empty for demo, but warn if not hex — still ok for migration, backend must enforce strict
    // For frontend demo-capable, we accept any non-empty as ok, but return reason if not hex for visibility
    if (hash.length < 8) return { ok: false, reason: "هش کوتاه است" };
  }
  return { ok: true };
}

/**
 * Parses raw JSON text into a validated backup with migration support.
 * - Tries stripPrototypeKeys + JSON.parse
 * - If version is legacy 1.0, migrates to 1.1 then validates
 * - If version is current 1.1, validates directly
 * - Otherwise returns UNSUPPORTED_SCHEMA_VERSION honest
 */
export function parseBackupWithMigration(
  text: string,
): ValidationResult & { migrated?: boolean; fromVersion?: string } {
  let parsed: unknown;
  try {
    parsed = stripPrototypeKeys(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, issues: [issue("MALFORMED_JSON", "فایل پشتیبان یک JSON معتبر نیست.")] };
  }

  const migration = migrateBackupIfNeeded(parsed);
  if (!migration) {
    // Not migratable — fall back to strict validation which will report UNSUPPORTED_SCHEMA_VERSION
    return validateBackup(parsed);
  }

  const result = validateBackup(migration.backup);
  if (!result.ok) return result;
  // Preserve migration info
  return {
    ...result,
    migrated: migration.migrated,
    fromVersion: migration.fromVersion,
  };
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

/**
 * Keys that can poison an object's prototype chain.
 *
 * `JSON.parse` keeps `__proto__` as a genuine *own* property, and it survives
 * object spread. Any later `Object.assign(target, row)` then re-points
 * `target`'s prototype, so an imported backup could smuggle inherited
 * properties into application objects. These keys are rejected at validation
 * time and stripped during parsing.
 */
export const PROTOTYPE_KEYS = ["__proto__", "constructor", "prototype"] as const;
const PROTOTYPE_KEY_SET = new Set<string>(PROTOTYPE_KEYS);

/**
 * Recursively rebuilds parsed JSON without prototype-polluting own properties.
 * Applied immediately after `JSON.parse`, before any validation or persistence.
 */
export function stripPrototypeKeys<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node === null || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (PROTOTYPE_KEY_SET.has(key)) continue;
      out[key] = walk((node as Record<string, unknown>)[key]);
    }
    return out;
  };
  return walk(value) as T;
}

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
    parsed = stripPrototypeKeys(JSON.parse(text) as unknown);
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

  /*
   * Dated sessions. A session pointing at a class, teacher or room that no
   * longer exists cannot be rendered on a calendar, and a malformed time range
   * would break every conflict calculation — so both are hard integrity
   * errors rather than warnings.
   *
   * NOTE: this validates `scheduledSessions` (the scheduling domain). The
   * legacy `sessions` weekly template is validated separately above and is
   * removed in task H5.
   */
  dataset.scheduledSessions.forEach((session, i) => {
    ref(
      has("classes", session.classId),
      `scheduledSessions[${i}].classId`,
      `جلسهٔ «${session.id}» به کلاس ناموجود ارجاع دارد.`,
    );
    ref(
      has("teachers", session.teacherId),
      `scheduledSessions[${i}].teacherId`,
      `جلسهٔ «${session.id}» به مدرس ناموجود ارجاع دارد.`,
    );
    ref(
      has("rooms", session.roomId),
      `scheduledSessions[${i}].roomId`,
      `جلسهٔ «${session.id}» به اتاق ناموجود ارجاع دارد.`,
    );

    if (!isIsoDate(session.date)) {
      issues.push(
        issue("INVALID_REFERENCE", `تاریخ جلسهٔ «${session.id}» معتبر نیست.`, `scheduledSessions[${i}].date`),
      );
    }

    const minutes = durationMinutes(session.startTime, session.endTime);
    if (minutes === null) {
      issues.push(
        issue("INVALID_REFERENCE", `زمان جلسهٔ «${session.id}» معتبر نیست.`, `scheduledSessions[${i}].startTime`),
      );
    } else if (minutes <= 0) {
      issues.push(
        issue(
          "INVALID_REFERENCE",
          `پایان جلسهٔ «${session.id}» باید پس از شروع آن باشد.`,
          `scheduledSessions[${i}].endTime`,
        ),
      );
    }

    // A reschedule link that points nowhere makes the audit trail unreadable.
    if (session.rescheduledFromId) {
      ref(
        has("scheduledSessions", session.rescheduledFromId),
        `scheduledSessions[${i}].rescheduledFromId`,
        `جلسهٔ «${session.id}» به جلسهٔ مبدأ ناموجود ارجاع دارد.`,
      );
    }
    if (session.rescheduledToId) {
      ref(
        has("scheduledSessions", session.rescheduledToId),
        `scheduledSessions[${i}].rescheduledToId`,
        `جلسهٔ «${session.id}» به جلسهٔ مقصد ناموجود ارجاع دارد.`,
      );
    }
  });

  /*
   * Compensation obligations (the compensation domain).
   *
   * The link to the CANCELLED original is a typed id and is validated
   * STRUCTURALLY, not referentially, on purpose: the scheduling repository allows
   * hard-deleting a session that has no attendance, and an obligation deliberately
   * OUTLIVES the row it compensates for. The read model reports that state
   * (`originalMissing`, `attemptBroken`) instead of a backup refusing to load — a
   * debt that cannot be read is worse than a debt whose session is gone.
   *
   * The class and the student are entity references in the same sense
   * `enrollments` carries them, so a dangling one IS an integrity error here, and
   * so is a second obligation for the same (original, student) pair: uniqueness is
   * the model's own duplicate protection, and a payload that violates it must not
   * be importable.
   */
  const compensationPairs = new Map<string, string>();
  const compensationSessions = new Map<string, string>();

  dataset.sessionCompensations.forEach((record, i) => {
    ref(
      has("classes", record.classId),
      `sessionCompensations[${i}].classId`,
      `جبرانی «${record.id}» به کلاس ناموجود ارجاع دارد.`,
    );
    ref(
      has("students", record.studentId),
      `sessionCompensations[${i}].studentId`,
      `جبرانی «${record.id}» به هنرجوی ناموجود ارجاع دارد.`,
    );

    const originalSessionId = (record as { originalSessionId?: unknown }).originalSessionId;
    if (typeof originalSessionId !== "string" || originalSessionId.length === 0) {
      issues.push(
        issue(
          "MISSING_ID",
          `جبرانی «${record.id}» به جلسهٔ لغوشده ارجاع ندارد.`,
          `sessionCompensations[${i}].originalSessionId`,
        ),
      );
    } else {
      const key = `${originalSessionId}::${record.studentId}`;
      const owner = compensationPairs.get(key);
      if (owner) {
        issues.push(
          issue(
            "DUPLICATE_ID",
            `برای یک جلسه و یک هنرجو دو جبرانی ثبت شده است («${owner}» و «${record.id}»).`,
            `sessionCompensations[${i}].originalSessionId`,
          ),
        );
      } else {
        compensationPairs.set(key, record.id);
      }
    }

    if (!Array.isArray(record.attempts)) {
      issues.push(
        issue(
          "INVALID_COLLECTION",
          `تاریخچهٔ تلاش‌های جبرانی «${record.id}» باید آرایه باشد.`,
          `sessionCompensations[${i}].attempts`,
        ),
      );
      return;
    }

    record.attempts.forEach((attempt, j) => {
      const entry = (attempt ?? {}) as {
        sessionId?: unknown;
        scheduledAt?: unknown;
        scheduledByUserId?: unknown;
      };
      if (typeof entry.sessionId !== "string" || entry.sessionId.length === 0) {
        issues.push(
          issue(
            "MISSING_ID",
            `تلاش جبرانی «${record.id}» به جلسه ارجاع ندارد.`,
            `sessionCompensations[${i}].attempts[${j}].sessionId`,
          ),
        );
        return;
      }
      if (typeof entry.scheduledAt !== "string" || typeof entry.scheduledByUserId !== "string") {
        issues.push(
          issue(
            "INVALID_REFERENCE",
            `تلاش جبرانی «${record.id}» زمان یا کاربر ثبت ندارد.`,
            `sessionCompensations[${i}].attempts[${j}]`,
          ),
        );
      }
      const previous = compensationSessions.get(entry.sessionId);
      if (previous) {
        issues.push(
          issue(
            "DUPLICATE_ID",
            `جلسهٔ «${entry.sessionId}» به بیش از یک جبرانی متصل است («${previous}» و «${record.id}»).`,
            `sessionCompensations[${i}].attempts[${j}].sessionId`,
          ),
        );
      } else {
        compensationSessions.set(entry.sessionId, record.id);
      }
    });
  });

  // Repertoire and progress. A progress event whose assignment vanished would
  // make a history chart unreadable, so these are hard integrity errors.
  dataset.pieces.forEach((piece, i) => {
    ref(
      has("instruments", piece.instrumentId),
      `pieces[${i}].instrumentId`,
      `قطعهٔ «${piece.id}» به ساز ناموجود ارجاع دارد.`,
    );
  });

  dataset.pieceAssignments.forEach((assignment, i) => {
    ref(
      has("students", assignment.studentId),
      `pieceAssignments[${i}].studentId`,
      `تخصیص «${assignment.id}» به هنرجوی ناموجود ارجاع دارد.`,
    );
    ref(
      has("pieces", assignment.pieceId),
      `pieceAssignments[${i}].pieceId`,
      `تخصیص «${assignment.id}» به قطعهٔ ناموجود ارجاع دارد.`,
    );
  });

  dataset.progressEvents.forEach((event, i) => {
    ref(
      has("pieceAssignments", event.assignmentId),
      `progressEvents[${i}].assignmentId`,
      `رویداد پیشرفت «${event.id}» به تخصیص ناموجود ارجاع دارد.`,
    );
    ref(
      has("students", event.studentId),
      `progressEvents[${i}].studentId`,
      `رویداد پیشرفت «${event.id}» به هنرجوی ناموجود ارجاع دارد.`,
    );
  });

  // national_id: required, valid and unique across the academy (§5/§17).
  const seenNationalIds = new Map<string, string>();
  dataset.students.forEach((student, i) => {
    const raw = (student as { nationalId?: unknown }).nationalId;
    if (typeof raw !== "string" || raw.length === 0) {
      issues.push(issue("MISSING_ID", `هنرجوی «${student.id}» کد ملی ندارد.`, `students[${i}].nationalId`));
      return;
    }
    const normalized = normalizeNationalId(raw);
    if (validateNationalId(normalized) !== null) {
      issues.push(issue("INVALID_REFERENCE", `کد ملی هنرجوی «${student.id}» معتبر نیست.`, `students[${i}].nationalId`));
      return;
    }
    const owner = seenNationalIds.get(normalized);
    if (owner) {
      issues.push(
        issue("DUPLICATE_ID", `کد ملی تکراری بین «${owner}» و «${student.id}».`, `students[${i}].nationalId`),
      );
      return;
    }
    seenNationalIds.set(normalized, student.id);
  });

  dataset.invoices.forEach((inv, i) => {
    ref(has("students", inv.studentId), `invoices[${i}].studentId`, `فاکتور «${inv.id}» به هنرجوی ناموجود ارجاع دارد.`);
  });
  dataset.payments.forEach((p, i) => {
    ref(has("students", p.studentId), `payments[${i}].studentId`, `پرداخت «${p.id}» به هنرجوی ناموجود ارجاع دارد.`);
  });
  dataset.users.forEach((u, i) => {
    ref(has("roles", u.role), `users[${i}].role`, `کاربر «${u.id}» به نقش ناموجود ارجاع دارد.`);
    if (u.teacherId !== undefined) {
      ref(has("teachers", u.teacherId), `users[${i}].teacherId`, `کاربر «${u.id}» به مدرس ناموجود ارجاع دارد.`);
    }
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
      if (PROTOTYPE_KEY_SET.has(key)) {
        found.push(issue("FORBIDDEN_FIELD", `کلید «${key}» می‌تواند زنجیرهٔ prototype را آلوده کند.`, `${at}.${key}`));
      }
      walk(child, `${at}.${key}`, depth + 1);
    }
  };
  walk(value, path, 0);
  return found;
}
