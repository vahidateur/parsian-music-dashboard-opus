import type { Page } from "@/api/types";
import { can } from "@/domains/auth/permissions";
import { conflict, forbidden, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import type { AttendanceRecord } from "@/domains/attendance/types";
import type { AttendanceRepository } from "@/domains/attendance/repository";
import { SESSION_ERRORS } from "@/domains/scheduling/types";
import type { SchedulingRepository } from "@/domains/scheduling/repository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import {
  attemptIsLive,
  attemptLineageOf,
  compensationStatusOf,
  currentAttemptOf,
  isCompensableClass,
  isCompensableOriginal,
  resolveAffectedStudent,
  type AttemptLineage,
} from "./derive";
import type { CompensationRepository } from "./repository";
import {
  COMPENSATION_ERRORS,
  type CompensationActor,
  type CompensationListParams,
  type CompensationStatus,
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
 * ONE LIVE ATTEMPT, AND ONE WRITER AT A TIME
 *
 * `schedule` and `complete` are the only two verbs that can change whether an
 * obligation stands booked, and everything each of them does after authorization
 * runs inside ONE serialized section per obligation (`serializeBooking`). The
 * section covers the terminal check, the liveness check, the session write and
 * the ledger append, so two callers cannot both observe "nothing live yet" and
 * each create a session. The loser is refused — `ALREADY_SCHEDULED` while a live
 * make-up exists, `ALREADY_SETTLED` once the obligation is terminal — and
 * creates nothing.
 *
 * That is also what makes a booking racing a discharge deterministic: either the
 * discharge runs after the append and therefore SEES the live attempt, or the
 * booking runs after the discharge and is refused as terminal. In neither order
 * does a discharged obligation acquire an attempt afterwards, and in neither
 * order is a session left in the calendar with no attempt pointing at it.
 *
 * THE MAKE-UP IS A LINEAGE, NOT A ROW
 *
 * An attempt records a booking act: the ledger line names the session the
 * booking CREATED (the entry). Scheduling moves a session by cancelling that row
 * and creating a linked replacement, and a move is not a cancellation — so every
 * derived answer here is computed on the EFFECTIVE session, resolved by
 * `lineageOf` from the entry through scheduling's own `rescheduledToId` links
 * (with the reverse `rescheduledFromId` relation as the fallback when a
 * moved-from row was deleted). `schedule`, `complete`, the list filters and the
 * read model all go through that one resolution, so no two rules can disagree
 * about which session the make-up is on. Nothing here ever re-points a ledger
 * line, and nothing here ever writes a session.
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

/**
 * One promise chain per (store, obligation) — the whole of the serialization.
 *
 * NOT A GLOBAL LOCK. Two obligations never wait for each other, nothing is
 * blocked, and no entry exists until a write names that obligation; an entry is
 * removed as soon as its chain settles. Keyed by the STORE rather than by this
 * object so that two adapters over the same data serialize too — the
 * composition the tests use, and what a second screen in the same page is.
 *
 * WHY A PRIMITIVE HAD TO BE ADDED AT ALL: the repository has no mutex, queue or
 * transaction to reuse (nothing in this codebase does), and the alternative —
 * re-checking state after each `await` — cannot make "nothing is live yet, so
 * create a session" atomic. Between the check and the ledger append there is a
 * session write, so two callers can both be inside that window; the chain is the
 * smallest mechanism that closes it without touching the scheduling contract.
 *
 * ACROSS BROWSERS IT CANNOT HELP, and it is not asked to: two browsers do not
 * share this event loop. The server owns that guarantee (see `repository.ts`).
 */
const BOOKING_SECTIONS = new WeakMap<DemoStore, Map<string, Promise<void>>>();

function bookingSectionFor(store: DemoStore): Map<string, Promise<void>> {
  const existing = BOOKING_SECTIONS.get(store);
  if (existing) return existing;
  const created = new Map<string, Promise<void>>();
  BOOKING_SECTIONS.set(store, created);
  return created;
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

      /*
       * The lineage is resolved ONCE per record and every filter below reads that
       * same answer. The reverse lookup matches ANY session the booking has stood
       * on — the entry the ledger recorded and every replacement a reschedule
       * created — so a screen looking at the session currently on the calendar
       * finds the obligation, and so does a screen looking at the booking's
       * original row.
       */
      const derived = this.derive(record);
      if (
        params.compensationSessionId &&
        !(derived.lineage?.chain.includes(params.compensationSessionId) ?? false)
      ) {
        return false;
      }
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

    /*
     * EVERYTHING AFTER AUTHORIZATION RUNS IN THE BOOKING SECTION. The record is
     * re-read here rather than before the section because a record read outside it
     * can be invalidated by whoever held the section first: the store returns a
     * fresh, detached row per read, so a stale copy is not merely inconvenient —
     * it would be the stale state the whole section exists to prevent acting on.
     */
    const updated = await this.serializeBooking(id, async () => {
      const record = this.requireRecord(id);
      if (record.completedAt !== undefined) {
        throw conflict(COMPENSATION_ERRORS.ALREADY_SETTLED, "این جبرانی انجام‌شده ثبت شده است.");
      }

      /*
       * AT MOST ONE LIVE MAKE-UP. A live make-up already fulfils this obligation,
       * so a second booking is refused outright: this domain never supersedes,
       * never re-points and never auto-cancels a session an operator booked and a
       * family may already have been told about. MOVING a make-up is a
       * correction, and the verb that owns corrections is the scheduling domain's
       * own `rescheduleSession` — which is why the check below reads the
       * EFFECTIVE session: a moved make-up is still this obligation's make-up, so
       * moving it can never open a window in which a second one is booked.
       *
       * "Live" is the derived domain's own predicate, the same one
       * `compensationStatusOf` uses, so the refusal and the derived status can
       * never disagree. Only a cancelled or unresolvable END of the chain is not
       * live: the obligation is then back to `required` and a new booking is
       * exactly what the owner's rule asks for.
       */
      const lineage = this.lineageOf(record);
      if (attemptIsLive(record, this.effectiveSessionState(lineage))) {
        throw conflict(
          COMPENSATION_ERRORS.ALREADY_SCHEDULED,
          "برای این جبرانی یک جلسهٔ جبرانی فعال ثبت شده است؛ برای تغییر آن، همان جلسه را جابه‌جا کنید.",
        );
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
       * The defaults are the ORIGINAL's own values, and they are only defaults:
       * the caller may move the make-up to another room, teacher, day or time.
       * When the original row is gone and the caller supplied neither, there is no
       * default to fall back on — the scheduling domain's own shape validation is
       * what says so, with its own sentence and its own field, rather than a
       * message invented here.
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
       * The model-level defence runs BEFORE the session write, so a refusal can
       * never leave a session in the calendar that no attempt points at. See
       * `assertNoSessionClaimedTwice` for why the check takes this form: the id of
       * the session about to be written does not exist yet — the scheduling domain
       * mints it inside `create()`, and `CreateSessionInput` deliberately has no
       * `id` — so what is asserted here is the ledger property the check exists
       * for, on the one state in which the assertion cannot itself be the reason
       * a stray session exists.
       */
      this.assertNoSessionClaimedTwice();

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
       * The append needs no re-read of the ledger even though `create()` is a
       * suspension point: `record.attempts` was read inside this section, and
       * every writer of this record's ledger (`schedule`, `complete`) runs in the
       * same section, so nothing can have appended between the read and here.
       *
       * What is NOT atomic is the pair of writes: if the store lost the record
       * between them, the update would report NOT_FOUND and the freshly created
       * session would remain unreferenced. Cancelling it as a "rollback" would
       * misreport an operation that never happened, and this domain may not write
       * cancellation at all (A3) — cross-aggregate transactionality is the
       * server's, and it is recorded in `repository.ts`.
       */
      const stamp = new Date().toISOString();
      const appended = this.store.sessionCompensations.update(record.id, {
        attempts: [
          ...record.attempts,
          { sessionId: session.id, scheduledAt: stamp, scheduledByUserId: actorUserId },
        ],
        updatedAt: stamp,
      });
      if (!appended) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "جبرانی یافت نشد.");
      return appended;
    });

    return this.readModel(updated);
  }

  async complete(id: string, input: CompleteCompensationInput): Promise<SessionCompensation> {
    const actorUserId = this.requireScheduleWrite(input.actor);

    /*
     * THE SAME SECTION AS `schedule`. This is not symmetry for its own sake: a
     * discharge that read the record while a booking was between its check and
     * its ledger append would discharge an obligation and then watch an attempt
     * appear on it — a terminal record that goes on gaining bookings. Sharing the
     * section makes the two verbs strictly ordered, so each one observes the
     * other's committed state.
     */
    const updated = await this.serializeBooking(id, () => {
      const record = this.requireRecord(id);
      if (record.completedAt !== undefined) {
        throw conflict(COMPENSATION_ERRORS.ALREADY_SETTLED, "این جبرانی پیش‌تر انجام‌شده ثبت شده است.");
      }

      /*
       * Completion requires a LIVE make-up: something was actually booked, and
       * that booking still stands — which for a moved booking means the session it
       * was moved TO. A cancelled or unresolvable END of the chain derives back to
       * `required`, so there is nothing to discharge — and the actor must re-book
       * first, which is what keeps the decision attached to a real session. The
       * predicate is the derived domain's own and the lineage is the same one the
       * read model uses, so this check, the refusal in `schedule` and the derived
       * status cannot disagree.
       *
       * Attendance is deliberately NOT required: this is a recorded decision, and
       * requiring a register would make a discharged obligation depend on a
       * different domain's data. The two can disagree, and the read model shows it.
       */
      const lineage = this.lineageOf(record);
      if (!attemptIsLive(record, this.effectiveSessionState(lineage))) {
        throw conflict(
          COMPENSATION_ERRORS.NOT_SCHEDULED,
          "جبرانی فعالی برای این مورد ثبت نشده است.",
        );
      }

      const stamp = new Date().toISOString();
      const discharged = this.store.sessionCompensations.update(record.id, {
        completedAt: stamp,
        completedByUserId: actorUserId,
        updatedAt: stamp,
      });
      if (!discharged) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "جبرانی یافت نشد.");
      return discharged;
    });

    return this.readModel(updated);
  }

  /* ---------------- internals ---------------- */

  private requireRecord(id: string): SessionCompensationRecord {
    const record = this.store.sessionCompensations.find(id);
    if (!record) throw notFound(COMPENSATION_ERRORS.NOT_FOUND, "مورد جبرانی یافت نشد.");
    return record;
  }

  /**
   * The per-obligation critical section, shared by `schedule` and `complete`.
   *
   * The task handed to it runs after every task already queued for the SAME
   * obligation in the SAME store, and nothing else — two obligations never wait
   * for each other. The tail stored in the map never rejects, so a refused
   * booking neither leaks an unhandled rejection nor hands a rejection to the
   * next holder, and the entry is dropped as soon as it settles (the map is
   * therefore bounded by the writes in flight, not by the dataset).
   *
   * THE ONE RULE FOR CALLERS: a task must not await another section of the same
   * obligation. Nothing here does — `deps.scheduling.create()` and the attendance
   * read inside `readModel` are outside this domain's sections — and `readModel`
   * is deliberately awaited AFTER the section, so no read of another domain is
   * ever made to wait for a lock.
   */
  private serializeBooking<T>(id: string, task: () => T | Promise<T>): Promise<T> {
    const sections = bookingSectionFor(this.store);
    const previous = sections.get(id) ?? Promise.resolve();
    // `then(task, task)` runs the task whether the previous holder resolved or
    // refused: one refused booking must not cancel the queue behind it.
    const result = previous.then(task, task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    sections.set(id, tail);
    void tail.then(() => {
      if (sections.get(id) === tail) sections.delete(id);
    });
    return result;
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

  /**
   * The model-level defence for "no session is ever the make-up of two
   * obligations", checked BEFORE the session write.
   *
   * A session is claimed by an obligation if it appears ANYWHERE in the lineage
   * of one of its attempts — not only as the ledger's entry. Otherwise a move
   * would hide a collision: obligation 1 books A, moves it to B, and obligation 2
   * would be free to claim B, which is one make-up credited to two debts.
   *
   * It cannot be expressed on the session this call is about to create — the id
   * does not exist until `create()` returns, and pre-generating one here would
   * move session identity into this domain. So what is asserted is the property
   * the code exists for, on the data that is knowable first: every session may be
   * claimed by at most one obligation. An ambiguous ledger is refused, and it is
   * refused before anything is written, which is the one ordering in which this
   * refusal cannot itself leave a stray session in the calendar.
   *
   * Unreachable in a healthy dataset: ids are minted by the store, and the
   * dataset validator already refuses a doubly claimed session on import
   * (`backup.ts`). It is enforced anyway, because the invariant is a property of
   * the model rather than an assumption about its writers. The ledger is small by
   * construction — one line per booking — so the scan is bounded by the data this
   * check is protecting, and the whole pass reads the session collection once.
   *
   * The specific "was THIS new session already claimed?" case needs no check and
   * gets none: the section guarantees the obligation has no live make-up when
   * this method runs, and the append follows the create immediately.
   */
  private assertNoSessionClaimedTwice(): void {
    const sessions = this.store.scheduledSessions.all();
    const byId = new Map(sessions.map((session) => [session.id, session]));

    const claimed = new Set<string>();
    for (const record of this.store.sessionCompensations.all()) {
      for (const attempt of record.attempts) {
        const lineage = attemptLineageOf(
          attempt.sessionId,
          (sessionId) => byId.get(sessionId),
          (sessionId) => sessions.find((session) => session.rescheduledFromId === sessionId),
        );
        for (const sessionId of lineage.chain) {
          if (claimed.has(sessionId)) {
            throw conflict(
              COMPENSATION_ERRORS.SESSION_ALREADY_LINKED,
              "یک جلسه به دو جبرانی متصل شده است؛ پیش از ثبت جلسهٔ جبرانی تازه، دادهٔ جبرانی باید اصلاح شود.",
            );
          }
          claimed.add(sessionId);
        }
      }
    }
  }

  /** The affected student's mark on the original, or `undefined` for no mark. */
  private async findMark(sessionId: string, studentId: string): Promise<AttendanceRecord | undefined> {
    const page = await this.deps.attendance.list({ sessionId, studentId });
    return page.data[0];
  }

  /**
   * The derived half of the read model, plus the lineage it was derived from.
   *
   * IT RESOLVES THE LINEAGE ONCE, and every caller gets its derived answers and
   * the resolved chain from the same walk: `list`, `readModel`, `schedule` and
   * `complete` therefore cannot disagree about which session the make-up is on,
   * or about whether it is live. Synchronous, because it answers from the store;
   * the attendance evidence is the one part that needs a repository call, and the
   * `await` on it is the whole reason `readModel` is async.
   */
  private derive(record: SessionCompensationRecord): {
    status: CompensationStatus;
    attemptBroken: boolean;
    lineage: AttemptLineage | undefined;
  } {
    const lineage = this.lineageOf(record);
    return { ...compensationStatusOf(record, this.effectiveSessionState(lineage)), lineage };
  }

  /**
   * The make-up this obligation stands on NOW, resolved through Scheduling's own
   * reschedule links.
   *
   * `undefined` means the obligation was never booked (no attempt at all). A
   * returned lineage whose `resolvable` is false means the booking's session
   * history could not be walked to a real row — a deleted chain, a cycle, an
   * absurd length — and the derived rules then see `missing`, which is the
   * fail-visible answer: `attemptBroken`, `needsAttention` and `required`, rather
   * than a guess about a make-up nobody can point at.
   *
   * A FORWARD LINK IS AUTHORITATIVE; the reverse `rescheduledFromId` scan is the
   * fallback for a moved-from row that no longer exists. That scan is the only
   * expensive step here and it is reached only when a row cannot stand as the
   * make-up — a deleted or plainly cancelled one — never on the happy path. A
   * server indexes `rescheduledFromId` instead; the demo dataset is small.
   */
  private lineageOf(record: SessionCompensationRecord): AttemptLineage | undefined {
    const attempt = currentAttemptOf(record);
    if (!attempt) return undefined;
    return attemptLineageOf(
      attempt.sessionId,
      (sessionId) => this.store.scheduledSessions.find(sessionId),
      (sessionId) =>
        this.store.scheduledSessions.all().find((session) => session.rescheduledFromId === sessionId),
    );
  }

  /** The effective session in the shape the pure derived rules take. */
  private effectiveSessionState(
    lineage: AttemptLineage | undefined,
  ): { status: AttemptLineage["effectiveStatus"] } | undefined {
    return lineage ? { status: lineage.effectiveStatus } : undefined;
  }

  private async readModel(record: SessionCompensationRecord): Promise<SessionCompensation> {
    const { status, attemptBroken, lineage } = this.derive(record);
    const mark = await this.findMark(record.originalSessionId, record.studentId);

    return {
      ...record,
      status,
      ...(lineage
        ? {
            currentAttempt: {
              sessionId: lineage.effectiveSessionId,
              sessionStatus: lineage.effectiveStatus,
              bookedSessionId: lineage.entrySessionId,
              rescheduleCount: lineage.moves,
            },
          }
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
