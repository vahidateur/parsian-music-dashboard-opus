import type { Page } from "@/api/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { resolveSessionRoster } from "./roster";
import type { AttendanceRepository } from "./repository";
import {
  ATTENDANCE_ERRORS,
  ATTENDANCE_STATUSES,
  type AttendanceCorrection,
  type AttendanceListParams,
  type AttendanceRecord,
  type AttendanceStatus,
  type BulkRecordInput,
  type CorrectionInput,
  type CorrectionListParams,
  type RecordAttendanceInput,
  type RosterAttendance,
  type SessionAttendance,
} from "./types";

/**
 * Demo implementation of the attendance repository.
 *
 * INVARIANTS OWNED HERE, NEVER IN THE UI
 *
 *   - one mark per (sessionId, studentId); changing it goes through `correct`;
 *   - a student must be on the DERIVED roster for that session's date;
 *   - a cancelled session accepts no marks;
 *   - `bulkRecord` validates everything before writing anything;
 *   - a correction requires a non-empty reason and appends immutable history;
 *   - corrections are never edited or deleted — there is no verb for it;
 *   - an unmarked student has NO row, never a placeholder.
 *
 * `recordedByUserId` IS PROVENANCE
 *
 * It records who claims to have taken the register. It is not consulted for
 * any permission decision here, and the server must not trust it either: a
 * client can send any id. Authorization is a backend concern (§31).
 */
export class DemoAttendanceRepository implements AttendanceRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  /* ---------------- records ---------------- */

  async list(params: AttendanceListParams = {}): Promise<Page<AttendanceRecord>> {
    let rows = this.store.attendanceRecords.all();

    if (params.sessionId) rows = rows.filter((r) => r.sessionId === params.sessionId);
    if (params.studentId) rows = rows.filter((r) => r.studentId === params.studentId);
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    if (params.since) rows = rows.filter((r) => r.recordedAt >= params.since!);
    if (params.until) rows = rows.filter((r) => r.recordedAt <= params.until!);

    // Newest first: the register just taken is the one being looked at.
    const sorted = [...rows].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    return paginate(sorted, params);
  }

  async get(id: string): Promise<AttendanceRecord> {
    const record = this.store.attendanceRecords.find(id);
    if (!record) throw notFound(ATTENDANCE_ERRORS.NOT_FOUND, "رکورد حضور و غیاب یافت نشد.");
    return record;
  }

  async record(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    const { session, roster } = this.requireOpenSession(input.sessionId);
    this.assertRecorder(input.recordedByUserId);
    this.assertStatus(input.status);

    if (!roster.has(input.studentId)) {
      throw validationError(
        ATTENDANCE_ERRORS.STUDENT_NOT_ON_ROSTER,
        "این هنرجو در فهرست حاضران این جلسه نیست.",
        { studentId: ["خارج از فهرست جلسه"] },
      );
    }

    if (this.findMark(session.id, input.studentId)) {
      throw conflict(
        ATTENDANCE_ERRORS.DUPLICATE,
        "برای این هنرجو در این جلسه حضور و غیاب ثبت شده است. برای تغییر، از اصلاح استفاده کنید.",
      );
    }

    const stamp = input.recordedAt ?? new Date().toISOString();
    return this.store.attendanceRecords.create({
      sessionId: session.id,
      studentId: input.studentId,
      status: input.status,
      recordedAt: stamp,
      recordedByUserId: input.recordedByUserId,
      note: input.note,
      updatedAt: stamp,
    });
  }

  /**
   * Saves a whole register atomically.
   *
   * Every entry is validated first; only then is anything written. A partial
   * save would leave a teacher unable to tell which half of the register
   * persisted — worse than a clean refusal.
   */
  async bulkRecord(input: BulkRecordInput): Promise<AttendanceRecord[]> {
    const { session, roster } = this.requireOpenSession(input.sessionId);
    this.assertRecorder(input.recordedByUserId);

    const fields: Record<string, string[]> = {};
    const seen = new Set<string>();

    for (const entry of input.entries) {
      if (!roster.has(entry.studentId)) {
        fields[entry.studentId] = ["خارج از فهرست جلسه"];
        continue;
      }
      if (seen.has(entry.studentId)) {
        fields[entry.studentId] = ["ورودی تکراری در همین درخواست"];
        continue;
      }
      if (!ATTENDANCE_STATUSES.includes(entry.status)) {
        fields[entry.studentId] = ["وضعیت نامعتبر"];
        continue;
      }
      if (this.findMark(session.id, entry.studentId)) {
        fields[entry.studentId] = ["قبلاً ثبت شده است"];
        continue;
      }
      seen.add(entry.studentId);
    }

    if (Object.keys(fields).length > 0) {
      // Nothing has been written at this point, by construction.
      throw validationError(ATTENDANCE_ERRORS.INVALID, "ثبت گروهی انجام نشد؛ هیچ رکوردی ذخیره نشد.", fields);
    }

    const stamp = input.recordedAt ?? new Date().toISOString();
    return input.entries.map((entry) =>
      this.store.attendanceRecords.create({
        sessionId: session.id,
        studentId: entry.studentId,
        status: entry.status,
        recordedAt: stamp,
        recordedByUserId: input.recordedByUserId,
        note: entry.note,
        updatedAt: stamp,
      }),
    );
  }

  /**
   * Changes a mark and appends an immutable correction.
   *
   * The record stays mutable for fast reads; the correction is the evidence.
   * There is deliberately no path that changes a mark without one.
   */
  async correct(id: string, input: CorrectionInput): Promise<AttendanceRecord> {
    const existing = await this.get(id);
    this.assertStatus(input.status);
    this.assertRecorder(input.changedByUserId);

    if (input.reason.trim().length === 0) {
      throw validationError(ATTENDANCE_ERRORS.REASON_REQUIRED, "دلیل اصلاح الزامی است.", {
        reason: ["دلیل اصلاح را وارد کنید."],
      });
    }

    const stamp = new Date().toISOString();

    // Append the evidence FIRST. If the update then failed, the trail would
    // show an attempted change rather than silently losing it.
    this.store.attendanceCorrections.create({
      attendanceRecordId: existing.id,
      sessionId: existing.sessionId,
      studentId: existing.studentId,
      previousStatus: existing.status,
      newStatus: input.status,
      reason: input.reason.trim(),
      changedByUserId: input.changedByUserId,
      changedAt: stamp,
    });

    const updated = this.store.attendanceRecords.update(existing.id, {
      status: input.status,
      note: input.note ?? existing.note,
      updatedAt: stamp,
    });
    if (!updated) throw notFound(ATTENDANCE_ERRORS.NOT_FOUND, "رکورد حضور و غیاب یافت نشد.");
    return updated;
  }

  /* ---------------- audit trail ---------------- */

  async listCorrections(params: CorrectionListParams = {}): Promise<Page<AttendanceCorrection>> {
    let rows = this.store.attendanceCorrections.all();

    if (params.attendanceRecordId) {
      rows = rows.filter((c) => c.attendanceRecordId === params.attendanceRecordId);
    }
    if (params.sessionId) rows = rows.filter((c) => c.sessionId === params.sessionId);
    if (params.studentId) rows = rows.filter((c) => c.studentId === params.studentId);

    const sorted = [...rows].sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
    return paginate(sorted, params);
  }

  /* ---------------- derived ---------------- */

  async sessionAttendance(sessionId: string): Promise<SessionAttendance> {
    const session = this.store.scheduledSessions.find(sessionId);
    if (!session) {
      throw notFound(ATTENDANCE_ERRORS.SESSION_NOT_FOUND, "جلسه یافت نشد.");
    }

    const roster = this.rosterFor(session.classId, session.date);

    // One index build, then constant-time joins — not a scan per student.
    const marks = new Map<string, AttendanceRecord>();
    for (const record of this.store.attendanceRecords.all()) {
      if (record.sessionId === sessionId) marks.set(record.studentId, record);
    }

    const rows: RosterAttendance[] = roster.map((student) => {
      const record = marks.get(student.studentId);
      // Undefined, never a placeholder: "not taken" and "absent" are different
      // facts and a disputed absence turns on exactly that distinction.
      return record ? { student, record } : { student };
    });

    return {
      sessionId,
      roster: rows,
      recorded: rows.filter((row) => row.record !== undefined).length,
      expected: rows.length,
      locked: session.status === "cancelled",
    };
  }

  /**
   * The narrow boundary the scheduling domain consumes.
   *
   * Returns ids only, so scheduling learns nothing about attendance internals
   * and the dependency stays one-directional.
   */
  async sessionIdsWithAttendance(): Promise<ReadonlySet<string>> {
    return this.sessionIdsWithAttendanceSync();
  }

  /**
   * Synchronous form, for the `AttendancePresenceProvider` seam.
   *
   * Scheduling needs the answer during a synchronous plan computation, so an
   * async-only boundary would force the whole planner to become async for no
   * benefit in the demo adapter.
   */
  sessionIdsWithAttendanceSync(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const record of this.store.attendanceRecords.all()) ids.add(record.sessionId);
    return ids;
  }

  /* ---------------- internals ---------------- */

  /** Loads a session and its roster, refusing cancelled ones. */
  private requireOpenSession(sessionId: string) {
    const session = this.store.scheduledSessions.find(sessionId);
    if (!session) {
      throw notFound(ATTENDANCE_ERRORS.SESSION_NOT_FOUND, "جلسه یافت نشد.");
    }
    if (session.status === "cancelled") {
      throw conflict(
        ATTENDANCE_ERRORS.SESSION_CANCELLED,
        "این جلسه لغو شده است و حضور و غیاب نمی‌پذیرد.",
      );
    }

    const roster = new Set(this.rosterFor(session.classId, session.date).map((e) => e.studentId));
    return { session, roster };
  }

  private rosterFor(classId: string, date: string) {
    return resolveSessionRoster({
      classId,
      date,
      enrollments: this.store.enrollments.all(),
      students: this.store.students.all(),
    });
  }

  private findMark(sessionId: string, studentId: string): AttendanceRecord | undefined {
    return this.store.attendanceRecords
      .all()
      .find((r) => r.sessionId === sessionId && r.studentId === studentId);
  }

  private assertStatus(status: AttendanceStatus): void {
    if (!ATTENDANCE_STATUSES.includes(status)) {
      throw validationError(ATTENDANCE_ERRORS.INVALID, "وضعیت حضور و غیاب معتبر نیست.", {
        status: ["وضعیت نامعتبر"],
      });
    }
  }

  /**
   * Provenance must be present.
   *
   * An anonymous mark cannot be questioned later. This is a data-quality
   * requirement, NOT an authorization check — the id is not verified here and
   * must not be trusted by the server either.
   */
  private assertRecorder(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      throw validationError(ATTENDANCE_ERRORS.RECORDER_REQUIRED, "ثبت‌کنندهٔ حضور و غیاب مشخص نیست.", {
        recordedByUserId: ["الزامی است"],
      });
    }
  }
}
