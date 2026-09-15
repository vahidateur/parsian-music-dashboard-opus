import type { Page } from "@/api/types";
import { can } from "@/domains/auth/permissions";
import { conflict, forbidden, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import type { AttendanceRecord } from "@/domains/attendance/types";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import { SESSION_ERRORS } from "@/domains/scheduling/types";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import {
  attemptStateOf,
  compensationStatusOf,
  currentAttemptOf,
  isCompensableClass,
  isCompensableOriginal,
  resolveAffectedStudent,
} from "./derive";
import type { CompensationRepository } from "./repository";
import {
  COMPENSATION_ERRORS,
  type CompensationActor,
  type CompensationListParams,
  type CompleteCompensationInput,
  type RegisterCompensationInput,
  type ScheduleCompensationInput,
  type SessionCompensation,
  type SessionCompensationRecord,
} from "./types";

/**
 * Demo implementation of the compensation repository.
 *
 * WHERE THE DOMAIN'S INVARIANTS LIVE: HERE, NEVER IN A VIEW
 *
 * Every refusal in `types.ts → COMPENSATION_ERRORS` is decided in this file, and
 * every sentence the operator will read is written here too.
 *
 * THE THREE WRITES ARE PROTECTED OPERATIONS
 *
 * `register`, `schedule` and `complete` each refuse an actor that does not hold
 * `schedule.write` (`COMPENSATION_FORBIDDEN`), through the existing role matrix
 * and `can()` — no second permission was invented. The check sits at the single
 * point every write passes through, so no caller can reach a write without
 * naming an actor that holds it. That is real enforcement of the RBAC this
 * product already has, and it is exactly as strong as the rest of that RBAC and
 * no stronger: the permissions arrive with the call, because the browser is
 * where they are known, and a browser can be tampered with. **The server must
 * re-derive the actor and its permissions from the token and refuse
 * independently** — the domain API implementation may not trust a payload that
 * names its own permissions. Documented in `README.md` and in `types.ts`.
 *
 * COMPOSITION, NOT DUPLICATION
 *
 * Two dependencies are injected and nothing else is re-implemented:
 *
 *   - `scheduling` — `create()` books the make-up, so the shape rules, the
 *     duration bounds, the hard/warning conflict engine and `origin: "manual"`
 *     are the scheduling domain's own answer; `sessionRoster()` is the
 *     authoritative "who was expected at this session", so the affected student
 *     is derived from Enrollment and never from a class's denormalized
 *     `studentIds` or from an attendance mark;
 *   - `attendance` — the ONLY thing that answers "does the affected student
 *     already have a mark on the cancelled original", which registration asks the
 *     operator about instead of assuming.
 *
 * READING THE DEMO STORE DIRECTLY, FOR SESSIONS ONLY
 *
 * Like the attendance domain's demo adapter, this one resolves session rows
 * straight from the store. That is deliberate: the read path must be able to say
 * `missing` (the scheduling repository's `get()` throws, and "this attempt's
 * session was deleted" is a fact the obligation has to be able to REPORT rather
 * than convert into an error). Nothing here writes a session — `create()` is the
 * only session write, and it goes through the injected repository.
 *
 * A FAILED ATTENDANCE READ IS A FAILED READ, NOT AN EMPTY ONE
 *
 * `originalStudentAttendance` is derived on every read. If the attendance adapter
 * cannot answer, this repository does not swallow it and does not render "no
 * mark" — the read fails and the caller reports it (DECISIONS D12). The same
 * applies to `register`: an unreadable attendance answer never silently becomes
 * consent to skip the question.
 */
export interface CompensationDeps {
  scheduling: SchedulingRepository;
  attendance: AttendanceRepository;
}

export class DemoCompensationRepository implements CompensationRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly deps: CompensationDeps,
  ) {}

  /* ---------------- reads ---------------- */

  async list(params: CompensationListParams = {}): Promise<Page<SessionCompensation>> {
    const all = this.store.sessionCompensations.all();

    const matches = all.filter((record) => {
      if (params.originalSessionId && record.originalSessionId !== params.originalSessionId) return false;
      if (params.studentId && record.studentId !== params.studentId) return false;
      if (params.classId && record.classId !== params.classId) return false;
      if (params.compensationSessionId && currentAttemptOf(record)?.sessionId !== params.compensationSessionId) {
        return false;
      }

      const derived = this.derive(record);
      if (params.status && derived.status !== params.status) return false;
      if (params.openOnly && derived.status === "completed") return false;
      if (params.needsAttention && !derived.attemptBroken) return false;
      return true;
    });

    // Newest requirement first: an obligation is an event, and the newest one is
    // the one somebody is working on.
    const sorted = [...matches].sort(
      (a, b) => b.requiredAt.localeCompare(a.requiredAt) || a.id.localeCompare(b.id),
    );

    const page = paginate(sorted, params);
    return { ...page, data: await Promise.all(page.data.map((record) => this.readModel(record))) };
  }

  async get(id: string): Promise<SessionCompensation> {
    return this.readModel(this.requireRecord(id));
  }

  /* ---------------- the obligation ---------------- */

  async register(input: RegisterCompensationInput): Promise<SessionCompensation> {
    const actorUserId = this.requireScheduleWrite(input.actor);

    if (input.reason.trim().length === 0) {
      throw validationError(COMPENSATION_ERRORS.REASON_REQUIRED, "دلیل نیاز به جبرانی الزامی است.", {
        reason: ["دلیل را وارد کنید."],
      });
    }

    const original = this.store.scheduledSessions.find(input.originalSessionId);
    if (!original) {
      throw notFound(COMPENSATION_ERRORS.ORIGINAL_NOT_FOUND, "جلسهٔ لغوشده یافت نشد.");
    }

    const klass = this.store.classes.find(original.classId);
    if (!klass) {
      throw validationError(COMPENSATION_ERRORS.CLASS_NOT_FOUND, "کلاس جلسه یافت نشد.", {
        originalSessionId: ["کلاس این جلسه یافت نشد."],
      });
    }

    /*
     * Eligibility, in the order the operator would ask it: is this a cancelled
     * one-to-one session at all? `kind` is the authority — a group class with a
     * single enrolled student is still a group class and is refused here.
     */
    if (original.status !== "cancelled") {
      throw conflict(
        COMPENSATION_ERRORS.ORIGINAL_NOT_CANCELLED,
        "جبرانی فقط برای جلسهٔ لغوشده ثبت می‌شود.",
      );
    }
    if (!isCompensableOriginal(original, klass)) {
      throw conflict(
        COMPENSATION_ERRORS.CLASS_NOT_PRIVATE,
        "جبرانی فقط برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.",
      );
    }

    /*
     * Duplicate protection FIRST, before the roster read: the answer does not
     * depend on it, and a second attempt should not pay for it. At most one
     * obligation exists per (original, student) for the pair's lifetime, so this
     * is never an upsert.
     */
    this.assertPairFree(input.originalSessionId, input.studentId);

    /*
     * The affected student, from the scheduling domain's derived roster scoped to
     * the original's date. Exactly one student, and it must be the named one:
     * zero means nobody was expected, more than one means this is not a
     * one-to-one lesson whatever the class field says, and a different one means
     * the caller is about to freeze the wrong person.
     */
    const roster = await this.deps.scheduling.sessionRoster(original.id);
    const affected = resolveAffectedStudent(roster, input.studentId);
    if (!affected.ok) {
      throw conflict(affected.code, AFFECTED_STUDENT_MESSAGES[affected.code]);
    }

    /*
     * Attendance evidence. A mark on a CANCELLED session is possible (cancelling
     * is not blocked by attendance — existing behaviour, unchanged), and it means
     * the lesson partly happened. It is neither ignored nor treated as proof that
     * compensation is owed: the operator decides, explicitly, and the decision is
     * recorded. The mark itself is never copied into this record.
     */
    const mark = await this.findMark(original.id, affected.studentId);
    if (mark && input.acknowledgedOriginalAttendance !== true) {
      throw conflict(
        COMPENSATION_ERRORS.ORIGINAL_ATTENDANCE_UNACKNOWLEDGED,
        "برای این هنرجو در جلسهٔ لغوشده حضور و غیاب ثبت شده است؛ ثبت جبرانی را تأیید کنید.",
      );
    }

    /*
     * The pair is re-checked HERE, after both awaits and immediately before the
     * write, because the two reads above are suspension points: a second
     * registration for the same pair can complete while this one is waiting for
     * the roster or the attendance answer. Nothing is awaited between this check
     * and `create()` — the store write is synchronous — so within this adapter the
     * check-to-write sequence cannot be interleaved, which is what makes the
     * lifetime-uniqueness rule an invariant rather than a hope.
     *
     * A server must hold the same guarantee across processes, as a unique
     * constraint or a transaction; a client-side re-check cannot, because two
     * browsers do not share this event loop. See `repository.ts`.
     */
    this.assertPairFree(input.originalSessionId, input.studentId);

    const stamp = new Date().toISOString();
    const created = this.store.sessionCompensations.create({
      originalSessionId: original.id,
      classId: original.classId,
      studentId: affected.studentId,
      reason: input.reason.trim(),
      requiredAt: stamp,
      requiredByUserId: actorUserId,
      attempts: [],
      ...(mark ? { originalAttendanceAcknowledgedAt: stamp } : {}),
      createdAt: stamp,
      updatedAt: stamp,
    });

    return this.readModel(created);
  }

  async schedule(id: string, input: ScheduleCompensationInput): Promise<SessionCompensation> {
    const actorUserId = this.requireScheduleWrite(input.actor);

    const record = this.requireRecord(id);
    if (record.completedAt !== undefined) {
      throw conflict(COMPENSATION_ERRORS.ALREADY_SETTLED, "این جبرانی انجام‌شده ثبت شده است.");
    }

    /*
     * The class is re-checked at booking time: a class can be archived, and its
     * `kind` is editable, so the eligibility that held at registration is not
     * assumed to still hold when the session is written.
     */
    const klass = this.store.classes.find(record.classId);
    if (!klass) {
      throw validationError(COMPENSATION_ERRORS.CLASS_NOT_FOUND, "کلاس جبرانی یافت نشد.", {
        originalSessionId: ["کلاس این جبرانی یافت نشد."],
      });
    }
    if (!isCompensableClass(klass)) {
      throw conflict(
        COMPENSATION_ERRORS.CLASS_NOT_PRIVATE,
        "جبرانی فقط برای کلاس‌های خصوصی (یک‌به‌یک) ثبت می‌شود.",
      );
    }

    /*
     * The defaults are the ORIGINAL's own values, and they are only defaults: the
     * caller may move the make-up to another room, teacher, day or time. When the
     * original row is gone and the caller supplied neither, there is no default to
     * fall back on — the scheduling domain's own shape validation is what says so,
     * with its own sentence and its own field, rather than a message invented here.
     */
    const original = this.store.scheduledSessions.find(record.originalSessionId);
    const teacherId = input.teacherId ?? original?.teacherId;
    const roomId = input.roomId ?? original?.roomId;
    if (!teacherId || !roomId) {
      const fields: Record<string, string[]> = {};
      if (!teacherId) fields.teacherId = ["مدرس الزامی است."];
      if (!roomId) fields.roomId = ["اتاق الزامی است."];
      throw validationError(SESSION_ERRORS.INVALID, "اطلاعات جلسه معتبر نیست.", fields);
    }

    /*
     * ONE session write, through the verb that owns session creation. Everything
     * that makes a session legal — the shape, the 15–480 minute bounds, the room
     * and teacher clash check, the off-schedule warning that a make-up day
     * legitimately triggers, and `origin: "manual"` so generation never reclaims
     * it — is decided by the scheduling repository, not here.
     */
    const session = await this.deps.scheduling.create({
      classId: record.classId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      teacherId,
      roomId,
      ...(input.acknowledgeWarnings !== undefined
        ? { acknowledgeWarnings: input.acknowledgeWarnings }
        : {}),
    });

    /*
     * Model-level defence, unreachable while attempts are created by `create()`
     * (ids come from the store, so a fresh one cannot already be linked). It is
     * enforced anyway because the invariant it protects is a property of the
     * model: no session may ever be the attempt of two obligations.
     */
    this.assertNotLinkedElsewhere(session.id);

    const stamp = new Date().toISOString();
    const updated = this.store.sessionCompensations.update(record.id, {
      attempts: [
        ...record.attempts,
        { sessionId: session.id, scheduledAt: stamp, scheduledByUserId: actorUserId },
      ],
      updatedAt: stamp,
    });
    if (!updated) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "جبرانی یافت نشد.");

    return this.readModel(updated);
  }

  async complete(id: string, input: CompleteCompensationInput): Promise<SessionCompensation> {
    const actorUserId = this.requireScheduleWrite(input.actor);

    const record = this.requireRecord(id);
    if (record.completedAt !== undefined) {
      throw conflict(COMPENSATION_ERRORS.ALREADY_SETTLED, "این جبرانی پیش‌تر انجام‌شده ثبت شده است.");
    }

    /*
     * Completion requires a LIVE attempt: something was actually booked, and that
     * booking still stands. A cancelled or deleted attempt derives back to
     * `required`, so there is nothing to discharge — and the actor must re-book
     * first, which is what keeps the decision attached to a real session.
     *
     * Attendance is deliberately NOT required: this is a recorded decision, and
     * requiring a register would make a discharged obligation depend on a
     * different domain's data. The two can disagree, and the read model shows it.
     */
    const current = currentAttemptOf(record);
    const attemptSession = current ? this.store.scheduledSessions.find(current.sessionId) : undefined;
    if (!current || attemptSession === undefined || attemptSession.status === "cancelled") {
      throw conflict(
        COMPENSATION_ERRORS.NOT_SCHEDULED,
        "جبرانی فعالی برای این مورد ثبت نشده است.",
      );
    }

    const stamp = new Date().toISOString();
    const updated = this.store.sessionCompensations.update(record.id, {
      completedAt: stamp,
      completedByUserId: actorUserId,
      updatedAt: stamp,
    });
    if (!updated) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "جبرانی یافت نشد.");

    return this.readModel(updated);
  }

  /* ---------------- internals ---------------- */

  private requireRecord(id: string): SessionCompensationRecord {
    const record = this.store.sessionCompensations.find(id);
    if (!record) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "مورد جبرانی یافت نشد.");
    return record;
  }

  /**
   * The gate on all three writes, and the one place the actor is read.
   *
   * Two separate refusals, in this order:
   *
   *   1. an unnamed actor is a malformed request (`ACTOR_REQUIRED`) — the same
   *      code and sentence this domain already answered with, so nothing that
   *      used to be a validation failure has become an authorization failure;
   *   2. a named actor without `schedule.write` is a refused operation
   *      (`COMPENSATION_FORBIDDEN`, `authorization`/403) — the permission the
   *      scheduling domain already owns, checked with the existing `can()`.
   *
   * Both refusals happen before any read, so an unauthorized caller learns
   * nothing about the record it named: there is no ordering in which a refusal
   * leaks whether an obligation exists.
   *
   * Returns the validated user id, which the caller records as provenance.
   * Provenance is NEVER the authorization decision — this method is.
   */
  private requireScheduleWrite(actor: CompensationActor | undefined): string {
    const userId = typeof actor?.userId === "string" ? actor.userId : "";
    if (userId.trim().length === 0) {
      throw validationError(COMPENSATION_ERRORS.ACTOR_REQUIRED, "کاربر انجام‌دهنده مشخص نیست.", {
        actor: ["کاربر مشخص نیست."],
      });
    }
    if (!can({ permissions: actor?.permissions ?? [] }, "schedule.write")) {
      throw forbidden(
        COMPENSATION_ERRORS.FORBIDDEN,
        "برای ثبت یا مدیریت جبرانی، دسترسی زمان‌بندی لازم است.",
      );
    }
    return userId;
  }

  /**
   * The lifetime-uniqueness rule for one `(originalSessionId, studentId)` pair.
   *
   * Called twice by `register`: once as the first check (the answer does not
   * depend on the reads that follow, and a duplicate should not pay for them) and
   * once immediately before the write, because those reads are suspension points.
   * Both calls throw the same two codes, so callers see one behaviour.
   */
  private assertPairFree(originalSessionId: string, studentId: string): void {
    const existing = this.store.sessionCompensations
      .all()
      .find((record) => record.originalSessionId === originalSessionId && record.studentId === studentId);
    if (!existing) return;
    throw conflict(
      existing.completedAt === undefined
        ? COMPENSATION_ERRORS.ALREADY_OPEN
        : COMPENSATION_ERRORS.ALREADY_SETTLED,
      existing.completedAt === undefined
        ? "برای این جلسه و هنرجو از قبل یک جبرانی باز ثبت شده است."
        : "جبرانی این جلسه پیش‌تر انجام‌شده ثبت شده است.",
    );
  }

  private assertNotLinkedElsewhere(sessionId: string): void {
    const linked = this.store.sessionCompensations
      .all()
      .some((record) => record.attempts.some((attempt) => attempt.sessionId === sessionId));
    if (linked) {
      throw conflict(
        COMPENSATION_ERRORS.SESSION_ALREADY_LINKED,
        "این جلسه پیش‌تر به یک جبرانی دیگر متصل شده است.",
      );
    }
  }

  /** The affected student's mark on the original, or `undefined` for no mark. */
  private async findMark(sessionId: string, studentId: string): Promise<AttendanceRecord | undefined> {
    const page = await this.deps.attendance.list({ sessionId, studentId });
    return page.data[0];
  }

  /**
   * The derived half of the read model: everything that follows from the recorded
   * facts and the CURRENT state of the sessions they point at. Synchronous,
   * because it answers from the store; the attendance evidence is the one part
   * that needs a repository call, and the `await` on it is the whole reason
   * `readModel` is async.
   */
  private derive(record: SessionCompensationRecord) {
    const current = currentAttemptOf(record);
    const attemptSession = current ? this.store.scheduledSessions.find(current.sessionId) : undefined;
    return compensationStatusOf(record, attemptSession);
  }

  private async readModel(record: SessionCompensationRecord): Promise<SessionCompensation> {
    const current = currentAttemptOf(record);
    const attemptSession = current ? this.store.scheduledSessions.find(current.sessionId) : undefined;
    const { status, attemptBroken } = compensationStatusOf(record, attemptSession);
    const mark = await this.findMark(record.originalSessionId, record.studentId);

    return {
      ...record,
      status,
      ...(current
        ? { currentAttempt: { sessionId: current.sessionId, sessionStatus: attemptStateOf(attemptSession) } }
        : {}),
      attemptBroken,
      originalMissing: this.store.scheduledSessions.find(record.originalSessionId) === undefined,
      ...(mark ? { originalStudentAttendance: mark.status } : {}),
    };
  }
}

/** The operator-facing sentence for each way the student could not be frozen. */
const AFFECTED_STUDENT_MESSAGES: Record<string, string> = {
  [COMPENSATION_ERRORS.NO_AFFECTED_STUDENT]:
    "برای این جلسه هنرجویی در فهرست ثبت‌نام فعال نیست؛ جبرانی ثبت نمی‌شود.",
  [COMPENSATION_ERRORS.ROSTER_AMBIGUOUS]:
    "این جلسه بیش از یک هنرجو دارد؛ جبرانی فقط برای کلاس خصوصی ثبت می‌شود.",
  [COMPENSATION_ERRORS.STUDENT_MISMATCH]:
    "هنرجوی انتخاب‌شده همان هنرجوی این جلسه نیست.",
};
