import type { Page } from "@/api/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { buildDateIndex, detectConflicts } from "./conflicts";
import { compareIsoDate, isHhMm, isIsoDate, jalaliToIso, weekdayIndex } from "./dateBridge";
import {
  deterministicSessionId,
  exceedsSessionCap,
  planGeneration,
  type PlanContext,
  type RecurrenceSource,
} from "./generation";
import type { SchedulingRepository } from "./repository";
import {
  SESSION_ERRORS,
  type ConflictReport,
  type CreateSessionInput,
  type GenerateInput,
  type GenerationPlan,
  type GenerationResult,
  type RescheduleInput,
  type RosterEntry,
  type Session,
  type SessionCandidate,
  type SessionListParams,
  type UpdateSessionInput,
} from "./types";

/**
 * Demo implementation of the scheduling repository.
 *
 * All domain invariants live here, never in the UI. The pure engines from
 * Group A (`conflicts.ts`, `generation.ts`) decide *what* is true; this class
 * supplies them with store data and turns their verdicts into writes or
 * `ApiError`s.
 *
 * ATTENDANCE PROTECTION VIA A NARROW SEAM
 *
 * Sessions with attendance recorded must never be rewritten or deleted. This
 * domain does NOT read attendance storage: it consumes a single injected
 * predicate, `AttendancePresenceProvider`, which returns the ids of sessions
 * that have marks. The registry builds that provider from the attendance
 * repository, so the dependency stays one-directional and cycle-free.
 *
 * The default is `denyAllMutationsWhenUnknown` — fail SAFE. When presence
 * cannot be determined, every destructive operation is refused. An
 * over-cautious refusal is visible and recoverable; silently destroying an
 * attendance-bearing session is neither.
 *
 * PREVIEW IS WRITE-FREE
 *
 * `previewGeneration` calls the same pure planner as `generateSessions` and
 * touches no collection. `generateSessions` re-plans immediately before
 * writing rather than trusting a plan handed in by a caller, so a stale
 * preview can never apply an outdated decision.
 */
/**
 * Answers "does this session already have attendance recorded?".
 *
 * The ONLY coupling point between scheduling and attendance. Returning a set
 * rather than a per-id callback keeps generation O(1) per slot.
 *
 * `undefined` is meaningful: "cannot be determined", which callers must treat
 * as "assume attendance exists".
 */
export type AttendancePresenceProvider = () => ReadonlySet<string> | undefined;

/**
 * Fail-safe default. Returns `undefined`, so every destructive operation
 * refuses until a real provider is injected.
 */
export const denyAllMutationsWhenUnknown: AttendancePresenceProvider = () => undefined;

/**
 * Asserts "no session anywhere has attendance". Only true in a controlled
 * fixture — explicitly named so using it is a visible decision.
 */
export const noAttendanceRecorded: AttendancePresenceProvider = () => new Set<string>();

export class DemoSchedulingRepository implements SchedulingRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly attendancePresence: AttendancePresenceProvider = denyAllMutationsWhenUnknown,
  ) {}

  /* ---------------- sessions ---------------- */

  async list(params: SessionListParams = {}): Promise<Page<Session>> {
    let rows = this.store.scheduledSessions.all();

    if (params.classId) rows = rows.filter((s) => s.classId === params.classId);
    if (params.teacherId) rows = rows.filter((s) => s.teacherId === params.teacherId);
    if (params.roomId) rows = rows.filter((s) => s.roomId === params.roomId);
    if (params.status) rows = rows.filter((s) => s.status === params.status);
    if (params.activeOnly) rows = rows.filter((s) => s.status !== "cancelled");
    if (params.from) rows = rows.filter((s) => s.date >= params.from!);
    if (params.to) rows = rows.filter((s) => s.date <= params.to!);

    // Chronological: a calendar reads forwards, unlike the newest-first lists
    // used elsewhere in the product.
    const sorted = [...rows].sort(
      (a, b) => compareIsoDate(a.date, b.date) || a.startTime.localeCompare(b.startTime),
    );
    return paginate(sorted, params);
  }

  async get(id: string): Promise<Session> {
    const session = this.store.scheduledSessions.find(id);
    if (!session) throw notFound(SESSION_ERRORS.NOT_FOUND, "جلسه یافت نشد.");
    return session;
  }

  async create(input: CreateSessionInput): Promise<Session> {
    this.assertShape(input);
    const klass = this.requireClass(input.classId);

    const report = this.reportFor(
      {
        classId: input.classId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        teacherId: input.teacherId,
        roomId: input.roomId,
      },
      klass,
    );
    this.assertAcceptable(report, input.acknowledgeWarnings);

    const stamp = new Date().toISOString();
    return this.store.scheduledSessions.create({
      classId: input.classId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      teacherId: input.teacherId,
      roomId: input.roomId,
      status: input.status ?? "scheduled",
      // A hand-created session is always an override: generation must never
      // reclaim or overwrite it.
      origin: "manual",
      notes: input.notes,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  async update(id: string, input: UpdateSessionInput): Promise<Session> {
    const existing = await this.get(id);

    if (this.hasAttendance(id)) {
      throw conflict(
        SESSION_ERRORS.HAS_ATTENDANCE,
        "برای این جلسه حضور و غیاب ثبت شده است و قابل ویرایش نیست.",
      );
    }

    const next = {
      classId: existing.classId,
      date: input.date ?? existing.date,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      teacherId: input.teacherId ?? existing.teacherId,
      roomId: input.roomId ?? existing.roomId,
    };
    this.assertShape(next);

    const klass = this.requireClass(existing.classId);
    const report = this.reportFor({ ...next, id }, klass);
    this.assertAcceptable(report, input.acknowledgeWarnings);

    const updated = this.store.scheduledSessions.update(id, {
      ...next,
      notes: input.notes ?? existing.notes,
      // Editing by hand pins the session against future generation.
      origin: "manual",
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw notFound(SESSION_ERRORS.NOT_FOUND, "جلسه یافت نشد.");
    return updated;
  }

  async cancelSession(id: string, reason: string): Promise<Session> {
    const existing = await this.get(id);

    if (existing.status === "cancelled") {
      throw conflict(SESSION_ERRORS.ALREADY_CANCELLED, "این جلسه پیش‌تر لغو شده است.");
    }
    // A cancellation without a reason is unauditable: nobody can later explain
    // why a student's lesson disappeared.
    if (reason.trim().length === 0) {
      throw validationError(SESSION_ERRORS.CANCEL_REASON_REQUIRED, "دلیل لغو الزامی است.", {
        reason: ["دلیل لغو را وارد کنید."],
      });
    }

    const updated = this.store.scheduledSessions.update(id, {
      status: "cancelled",
      cancelReason: reason.trim(),
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw notFound(SESSION_ERRORS.NOT_FOUND, "جلسه یافت نشد.");
    return updated;
  }

  async rescheduleSession(id: string, input: RescheduleInput): Promise<Session> {
    const existing = await this.get(id);

    if (existing.status === "cancelled") {
      throw conflict(SESSION_ERRORS.ALREADY_CANCELLED, "جلسهٔ لغوشده را نمی‌توان جابه‌جا کرد.");
    }
    if (this.hasAttendance(id)) {
      throw conflict(
        SESSION_ERRORS.HAS_ATTENDANCE,
        "برای این جلسه حضور و غیاب ثبت شده است و جابه‌جا نمی‌شود.",
      );
    }
    if (input.reason.trim().length === 0) {
      throw validationError(SESSION_ERRORS.CANCEL_REASON_REQUIRED, "دلیل جابه‌جایی الزامی است.", {
        reason: ["دلیل جابه‌جایی را وارد کنید."],
      });
    }

    const next = {
      classId: existing.classId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      teacherId: input.teacherId ?? existing.teacherId,
      roomId: input.roomId ?? existing.roomId,
    };
    this.assertShape(next);

    const klass = this.requireClass(existing.classId);
    // The original still occupies its slot during the check, so exclude it:
    // a session never blocks its own replacement.
    const report = this.reportFor({ ...next, id }, klass);
    this.assertAcceptable(report, input.acknowledgeWarnings);

    const stamp = new Date().toISOString();

    /*
     * Two writes, deliberately in this order. Creating the replacement first
     * means a failure leaves the original untouched and schedulable, rather
     * than cancelling a lesson and losing its replacement.
     */
    const replacement = this.store.scheduledSessions.create({
      ...next,
      status: "scheduled",
      origin: "manual",
      notes: existing.notes,
      rescheduledFromId: existing.id,
      createdAt: stamp,
      updatedAt: stamp,
    });

    this.store.scheduledSessions.update(existing.id, {
      status: "cancelled",
      cancelReason: input.reason.trim(),
      rescheduledToId: replacement.id,
      updatedAt: stamp,
    });

    return replacement;
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    if (this.hasAttendance(id)) {
      throw conflict(
        SESSION_ERRORS.HAS_ATTENDANCE,
        "برای این جلسه حضور و غیاب ثبت شده است و حذف نمی‌شود. به‌جای حذف آن را لغو کنید.",
      );
    }
    this.store.scheduledSessions.remove(id);
  }

  /* ---------------- generation ---------------- */

  /** Computes the plan. **Performs no writes.** */
  async previewGeneration(input: GenerateInput): Promise<GenerationPlan> {
    return this.buildPlan(input);
  }

  async generateSessions(input: GenerateInput): Promise<GenerationResult> {
    // Re-plan rather than trusting a plan supplied by the caller: a preview
    // taken minutes ago may have been invalidated by another change.
    const plan = this.buildPlan(input);

    if (!plan.conflicts.ok) {
      throw conflict(SESSION_ERRORS.CONFLICT, "تولید جلسات به دلیل تعارض انجام نشد.", {
        conflicts: plan.conflicts.hard.map((c) => c.message),
      });
    }
    if (exceedsSessionCap(plan)) {
      throw validationError(
        SESSION_ERRORS.GENERATION_WINDOW_INVALID,
        "تعداد جلسات این بازه بیش از حد مجاز است.",
        { to: ["بازهٔ کوچک‌تری انتخاب کنید."] },
      );
    }

    const stamp = new Date().toISOString();
    const created: Session[] = [];
    const updated: Session[] = [];

    for (const slot of plan.creates) {
      created.push(
        this.store.scheduledSessions.create({
          id: slot.id,
          classId: slot.classId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teacherId: slot.teacherId,
          roomId: slot.roomId,
          status: "scheduled",
          origin: "generated",
          createdAt: stamp,
          updatedAt: stamp,
        }),
      );
    }

    // Updates are applied ONLY on explicit confirmation. Regeneration must
    // never rewrite an existing session as a side effect.
    if (input.confirmUpdates) {
      for (const change of plan.updates) {
        const row = this.store.scheduledSessions.update(change.sessionId, {
          ...change.next,
          updatedAt: stamp,
        });
        if (row) updated.push(row);
      }
    }

    return {
      plan,
      created,
      updated,
      noop: created.length === 0 && updated.length === 0,
    };
  }

  /* ---------------- derived ---------------- */

  async checkConflicts(candidate: SessionCandidate): Promise<ConflictReport> {
    const klass = this.store.classes.find(candidate.classId);
    return this.reportFor(candidate, klass);
  }

  /**
   * Students expected at a session.
   *
   * Derived from active Enrollment scoped to the session's DATE, so a student
   * who enrolled after the session does not appear on it and one who withdrew
   * afterwards still does. `Enrollment.startDate` is a Jalali display string
   * (a protected domain, deliberately not migrated), so it is read through
   * `jalaliToIso`. An unparseable date excludes the student — failing closed,
   * because silently adding someone to a roster is the worse error.
   */
  async sessionRoster(sessionId: string): Promise<RosterEntry[]> {
    const session = await this.get(sessionId);

    const students = new Map(this.store.students.all().map((s) => [s.id, s]));
    const out: RosterEntry[] = [];

    for (const enrollment of this.store.enrollments.all()) {
      if (enrollment.classId !== session.classId) continue;
      if (enrollment.status !== "active") continue;

      const start = jalaliToIso(enrollment.startDate);
      if (start === null || start > session.date) continue;

      if (enrollment.endDate) {
        const end = jalaliToIso(enrollment.endDate);
        if (end !== null && end < session.date) continue;
      }

      const student = students.get(enrollment.studentId);
      if (!student) continue;

      out.push({
        studentId: student.id,
        studentName: student.name,
        photoMediaId: student.photoMediaId,
      });
    }

    return out.sort((a, b) => a.studentName.localeCompare(b.studentName, "fa"));
  }

  /* ---------------- internals ---------------- */

  /** Structural validation, before any rule that needs other sessions. */
  private assertShape(input: {
    date: string;
    startTime: string;
    endTime: string;
    teacherId: string;
    roomId: string;
  }): void {
    const fields: Record<string, string[]> = {};

    if (!isIsoDate(input.date)) fields.date = ["تاریخ معتبر نیست."];
    if (!isHhMm(input.startTime)) fields.startTime = ["زمان شروع معتبر نیست."];
    if (!isHhMm(input.endTime)) fields.endTime = ["زمان پایان معتبر نیست."];
    if (!input.teacherId) fields.teacherId = ["مدرس الزامی است."];
    else if (!this.store.teachers.find(input.teacherId)) fields.teacherId = ["مدرس یافت نشد."];
    if (!input.roomId) fields.roomId = ["اتاق الزامی است."];
    else if (!this.store.rooms.find(input.roomId)) fields.roomId = ["اتاق یافت نشد."];

    if (Object.keys(fields).length > 0) {
      throw validationError(SESSION_ERRORS.INVALID, "اطلاعات جلسه معتبر نیست.", fields);
    }
  }

  private requireClass(classId: string) {
    const klass = this.store.classes.find(classId);
    if (!klass) {
      throw validationError(SESSION_ERRORS.CLASS_NOT_FOUND, "کلاس یافت نشد.", {
        classId: ["کلاس یافت نشد."],
      });
    }
    return klass;
  }

  /** Runs the pure conflict engine with everything the rules can use. */
  private reportFor(
    candidate: SessionCandidate,
    klass: { id: string; status?: "active" | "archived"; days?: readonly number[] } | undefined,
  ): ConflictReport {
    const room = this.store.rooms.find(candidate.roomId);
    const teacher = this.store.teachers.find(candidate.teacherId);

    return detectConflicts(candidate, {
      index: buildDateIndex(this.store.scheduledSessions.all()),
      classInfo: klass ? { id: klass.id, status: klass.status, days: klass.days } : undefined,
      // `undefined` means "not checked"; only an explicit false warns.
      // The two domains express availability differently: Room has a boolean
      // `active`, Teacher uses a status union whose `inactive` member gates
      // new assignment.
      roomActive: room ? room.active !== false : undefined,
      teacherActive: teacher ? teacher.status !== "inactive" : undefined,
      studentsByClassId: this.studentsByClassId(),
      weekday: weekdayIndex(candidate.date) ?? undefined,
    });
  }

  /** Hard conflicts always refuse; warnings refuse only without consent. */
  private assertAcceptable(report: ConflictReport, acknowledgeWarnings?: boolean): void {
    if (!report.ok) {
      throw conflict(SESSION_ERRORS.CONFLICT, report.hard[0]?.message ?? "تعارض زمان‌بندی.", {
        conflicts: report.hard.map((c) => c.message),
      });
    }
    if (report.warnings.length > 0 && !acknowledgeWarnings) {
      throw conflict(
        SESSION_ERRORS.WARNINGS_UNACKNOWLEDGED,
        report.warnings[0].message,
        { warnings: report.warnings.map((w) => w.message) },
      );
    }
  }

  private buildPlan(input: GenerateInput): GenerationPlan {
    const klass = this.requireClass(input.classId);

    const recurrence: RecurrenceSource = {
      id: klass.id,
      status: klass.status,
      days: klass.days,
      time: klass.time,
      duration: klass.duration,
      teacherId: klass.teacherId,
      roomId: klass.roomId,
    };

    const all = this.store.scheduledSessions.all();
    const existing = all.filter((s) => s.classId === input.classId);
    const ctx: PlanContext = {
      existing,
      sessionIdsWithAttendance: this.protectedSessionIds(existing),
      today: this.today(),
      conflict: {
        otherSessions: all.filter((s) => s.classId !== input.classId),
        studentsByClassId: this.studentsByClassId(),
      },
    };

    return planGeneration(input, recurrence, ctx);
  }

  /**
   * Today's calendar date.
   *
   * Uses the real date rather than the demo clock: `academyNow()` freezes the
   * time of day but keeps the real date, so there is no frozen "today" to
   * read. Generation only compares dates, and a session in the past must stay
   * in the past regardless of the clock abstraction.
   */
  private today(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** Delegates entirely to the injected provider; never reads storage. */
  private sessionIdsWithAttendance(): ReadonlySet<string> | undefined {
    return this.attendancePresence();
  }

  /** **Fails safe.** An unknown answer protects rather than permits. */
  private hasAttendance(sessionId: string): boolean {
    const known = this.sessionIdsWithAttendance();
    if (known === undefined) return true;
    return known.has(sessionId);
  }

  /**
   * The set generation passes to the pure planner. When presence is unknown,
   * EVERY existing session is reported protected — the conservative reading.
   */
  private protectedSessionIds(candidates: readonly Session[]): ReadonlySet<string> {
    const known = this.sessionIdsWithAttendance();
    if (known !== undefined) return known;
    return new Set(candidates.map((session) => session.id));
  }

  /** Active enrollment ids per class, for the student-overlap warning. */
  private studentsByClassId(): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const enrollment of this.store.enrollments.all()) {
      if (enrollment.status !== "active") continue;
      const bucket = map.get(enrollment.classId);
      if (bucket) bucket.push(enrollment.studentId);
      else map.set(enrollment.classId, [enrollment.studentId]);
    }
    return map;
  }
}

/** Re-exported so callers can build ids without importing the engine. */
export { deterministicSessionId };
