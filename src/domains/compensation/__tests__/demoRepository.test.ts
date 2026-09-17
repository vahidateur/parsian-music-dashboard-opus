/**
 * Compensation repository — the domain's invariants, end to end on the demo store.
 *
 * What is pinned here is what the owner's rules actually decide:
 *
 *   - a cancellation registers NOTHING (there is no code path that could);
 *   - only a cancelled PRIVATE session is eligible, and the affected student comes
 *     from the scheduling domain's derived roster;
 *   - the make-up is an ordinary session, created by the scheduling repository's
 *     own `create()` — same conflict engine, same shape rules, `origin: "manual"`;
 *   - the attempt ledger only grows, and cancelling an attempt returns the
 *     obligation to `required` without a write;
 *   - a discharged obligation is terminal.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { permissionsForRole } from "@/domains/auth/permissions";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { DemoClassRepository } from "@/domains/classes/demoRepository";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { SESSION_ERRORS } from "@/domains/scheduling/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import { COMPENSATION_ERRORS,
  type CompensationActor,
} from "../types";

/** A seeded PRIVATE class with exactly one enrolled student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** The seeded CANCELLED session — it belongs to a group class, so it is refused. */
const CANCELLED_GROUP_SESSION = "ses_cl10_20260908_1530";
/** cl2 meets on day index 3 (Tuesday): one date on its own day, one off it. */
const ON_SCHEDULE_DATE = "2027-05-11";
const OFF_SCHEDULE_DATE = "2027-05-12";
/**
 * An administrator, from the REAL role matrix: every permission, so the cases in
 * this file exercise the domain's own rules rather than RBAC. The authorization
 * refusals have their own file (`authorization.test.ts`).
 */
const ACTOR: CompensationActor = {
  userId: "usr_admin",
  permissions: permissionsForRole("administrator"),
};

let repo: DemoCompensationRepository;
let scheduling: DemoSchedulingRepository;
let attendance: DemoAttendanceRepository;
let classes: DemoClassRepository;
let store: DemoStore;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  attendance = new DemoAttendanceRepository(store);
  scheduling = new DemoSchedulingRepository(store, () => attendance.sessionIdsWithAttendanceSync());
  classes = new DemoClassRepository(store);
  repo = new DemoCompensationRepository(store, { scheduling, attendance });
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

/** A cancelled private session: the only thing compensation may ever start from. */
async function cancelledPrivateSession(date = ON_SCHEDULE_DATE): Promise<string> {
  const created = await scheduling.create({
    classId: PRIVATE_CLASS,
    date,
    startTime: "14:00",
    endTime: "15:00",
    teacherId: "t1",
    roomId: "r1",
    // The helper is used with dates off the class's own day too, and an
    // off-schedule occurrence is a WARNING the scheduling domain owns.
    acknowledgeWarnings: true,
  });
  await scheduling.cancelSession(created.id, "لغو از سوی مدرس");
  return created.id;
}

async function registered(date = ON_SCHEDULE_DATE) {
  const originalSessionId = await cancelledPrivateSession(date);
  return repo.register({
    originalSessionId,
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسهٔ هنرجو",
    actor: ACTOR,
  });
}

describe("registration follows cancellation, never causes it", () => {
  it("registers nothing when a session is cancelled", async () => {
    expect(store.sessionCompensations.all()).toHaveLength(0);

    const sessionId = await cancelledPrivateSession();

    expect(store.sessionCompensations.all()).toHaveLength(0);
    expect((await repo.list()).data).toHaveLength(0);
    // The cancellation itself is untouched by this domain.
    expect((await scheduling.get(sessionId)).status).toBe("cancelled");
  });

  it("refuses a session that is still scheduled", async () => {
    const created = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: ON_SCHEDULE_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });

    expect(
      await codeOf(
        repo.register({
          originalSessionId: created.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ORIGINAL_NOT_CANCELLED);
  });

  it("refuses a cancelled GROUP session — the seeded cancellation included", async () => {
    const seeded = store.scheduledSessions.find(CANCELLED_GROUP_SESSION);
    expect(seeded?.status).toBe("cancelled");
    expect(store.classes.find(seeded!.classId)?.kind).toBe("group");

    expect(
      await codeOf(
        repo.register({
          originalSessionId: seeded!.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.CLASS_NOT_PRIVATE);
  });

  it("refuses an unknown session, a missing reason and a missing actor", async () => {
    expect(
      await codeOf(
        repo.register({
          originalSessionId: "ses_nope",
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ORIGINAL_NOT_FOUND);

    const originalSessionId = await cancelledPrivateSession();
    expect(
      await codeOf(
        repo.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "   ",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.REASON_REQUIRED);

    expect(
      await codeOf(
        repo.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: { userId: "", permissions: permissionsForRole("administrator") },
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ACTOR_REQUIRED);
    expect(store.sessionCompensations.all()).toHaveLength(0);
  });
});

describe("the affected student is derived and frozen", () => {
  it("freezes the single student the original's roster yields", async () => {
    const compensation = await registered();

    expect(compensation.studentId).toBe(PRIVATE_STUDENT);
    expect(compensation.classId).toBe(PRIVATE_CLASS);
    expect(compensation.status).toBe("required");
    expect(compensation.attempts).toEqual([]);
    expect(compensation.currentAttempt).toBeUndefined();
    expect(compensation.attemptBroken).toBe(false);
    expect(compensation.originalMissing).toBe(false);
  });

  it("refuses a student the session was not about", async () => {
    const originalSessionId = await cancelledPrivateSession();

    expect(
      await codeOf(
        repo.register({
          originalSessionId,
          studentId: "st1",
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.STUDENT_MISMATCH);
  });

  it("refuses a session nobody is enrolled for", async () => {
    // A private class with no enrollment: the roster is empty, so there is no
    // affected student to freeze — and an obligation without one is meaningless.
    const empty = await classes.create({
      title: "پیانو انفرادی · بدون ثبت‌نام",
      instrument: "piano",
      teacherId: "t1",
      roomId: "r1",
      kind: "private",
      level: "سطح ۱",
      days: [3],
      time: "09:00",
      duration: 60,
      capacity: 1,
      tuition: 1_000_000,
    });
    const created = await scheduling.create({
      classId: empty.id,
      date: ON_SCHEDULE_DATE,
      startTime: "09:00",
      endTime: "10:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await scheduling.cancelSession(created.id, "لغو");

    expect(
      await codeOf(
        repo.register({
          originalSessionId: created.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.NO_AFFECTED_STUDENT);
  });
});

describe("attendance on the cancelled original is asked about, not assumed", () => {
  it("refuses to register without an explicit acknowledgement", async () => {
    const created = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: ON_SCHEDULE_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    // Recorded before the cancellation: `record` refuses a cancelled session, and
    // cancelling is not blocked by attendance (existing behaviour, unchanged).
    await attendance.record({
      sessionId: created.id,
      studentId: PRIVATE_STUDENT,
      status: "present",
      recordedByUserId: ACTOR.userId,
    });
    await scheduling.cancelSession(created.id, "لغو دیرهنگام");

    expect(
      await codeOf(
        repo.register({
          originalSessionId: created.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ORIGINAL_ATTENDANCE_UNACKNOWLEDGED);

    const acknowledged = await repo.register({
      originalSessionId: created.id,
      studentId: PRIVATE_STUDENT,
      reason: "دلیل",
      actor: ACTOR,
      acknowledgedOriginalAttendance: true,
    });

    expect(acknowledged.originalAttendanceAcknowledgedAt).toBeTruthy();
    expect(acknowledged.originalStudentAttendance).toBe("present");
    // The decision is recorded; the mark itself is never copied onto the record.
    expect(acknowledged.originalStudentAttendance).not.toBe(acknowledged.reason);
  });

  it("reports no mark as undefined, not as an absent read", async () => {
    const compensation = await registered();
    expect(compensation.originalStudentAttendance).toBeUndefined();
    expect(compensation.originalAttendanceAcknowledgedAt).toBeUndefined();
  });

  it("follows a correction to the original without a second write", async () => {
    const created = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: ON_SCHEDULE_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await attendance.record({
      sessionId: created.id,
      studentId: PRIVATE_STUDENT,
      status: "present",
      recordedByUserId: ACTOR.userId,
    });
    await scheduling.cancelSession(created.id, "لغو");
    const compensation = await repo.register({
      originalSessionId: created.id,
      studentId: PRIVATE_STUDENT,
      reason: "دلیل",
      actor: ACTOR,
      acknowledgedOriginalAttendance: true,
    });
    expect(compensation.originalStudentAttendance).toBe("present");

    const marks = await attendance.list({ sessionId: created.id, studentId: PRIVATE_STUDENT });
    await attendance.correct(marks.data[0].id, {
      status: "absent",
      reason: "اصلاح ثبت",
      changedByUserId: ACTOR.userId,
    });

    const reread = await repo.get(compensation.id);
    expect(reread.originalStudentAttendance).toBe("absent");
  });
});

describe("duplicate protection is an invariant", () => {
  it("refuses a second registration for the same original and student", async () => {
    const compensation = await registered();

    expect(
      await codeOf(
        repo.register({
          originalSessionId: compensation.originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "دوباره",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_OPEN);
    expect(store.sessionCompensations.all()).toHaveLength(1);
  });

  it("still refuses after the obligation is discharged: register is never an upsert", async () => {
    const compensation = await registered();
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    await repo.complete(compensation.id, { actor: ACTOR });

    expect(
      await codeOf(
        repo.register({
          originalSessionId: compensation.originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "دوباره",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SETTLED);
    expect((await repo.get(compensation.id)).status).toBe("completed");
  });

  /**
   * The check-then-write window.
   *
   * `register` awaits two reads — the derived roster and the attendance answer —
   * before it writes, and a second registration for the same pair can complete
   * inside that window (a double submit, a second tab, any concurrent caller).
   * The pair is therefore re-checked immediately before `create()`, with no await
   * in between, which is what makes the lifetime-uniqueness rule hold for this
   * adapter instead of merely being checked early.
   *
   * The seam is the injected scheduling repository: `sessionRoster` is the first
   * of the two suspension points, so completing a rival registration there puts
   * the duplicate exactly where a real interleaving would — after this call's
   * first check, before its write. Nothing about the architecture is bent for the
   * test: the repository is composed from the same two dependencies it always is.
   */
  it("refuses the write when the pair becomes duplicated during the awaited reads", async () => {
    const originalSessionId = await cancelledPrivateSession();
    const rival = new DemoCompensationRepository(store, { scheduling, attendance });

    let interleaved = false;
    // `Object.create` keeps every real verb of the scheduling repository and
    // shadows only the one read this case needs to interleave on.
    const racingScheduling = Object.create(scheduling) as DemoSchedulingRepository;
    racingScheduling.sessionRoster = async (sessionId: string) => {
      const roster = await scheduling.sessionRoster(sessionId);
      if (!interleaved) {
        interleaved = true;
        // A complete, successful registration for the SAME (original, student),
        // finished before this call resumes from the await.
        await rival.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "ثبت همزمان",
          actor: ACTOR,
        });
      }
      return roster;
    };
    const racing = new DemoCompensationRepository(store, { scheduling: racingScheduling, attendance });

    expect(
      await codeOf(
        racing.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "ثبت دوباره",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_OPEN);

    // Exactly one obligation exists, and it is the one that won the race — the
    // late check refused the write rather than merging into an upsert.
    const rows = store.sessionCompensations.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("ثبت همزمان");
    expect(interleaved).toBe(true);
  });
});

describe("booking the make-up", () => {
  it("creates an ordinary manual session through the scheduling repository", async () => {
    const compensation = await registered();
    const original = store.scheduledSessions.find(compensation.originalSessionId)!;

    const scheduled = await repo.schedule(compensation.id, {
      date: original.date,
      startTime: original.startTime,
      endTime: "15:00",
      actor: ACTOR,
    });

    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.attempts).toHaveLength(1);
    expect(scheduled.currentAttempt?.sessionStatus).toBe("scheduled");

    const session = await scheduling.get(scheduled.currentAttempt!.sessionId);
    expect(session.classId).toBe(PRIVATE_CLASS);
    expect(session.date).toBe(original.date);
    expect(session.startTime).toBe(original.startTime);
    // Defaults are the original's, and the session is a normal one.
    expect(session.roomId).toBe(original.roomId);
    expect(session.teacherId).toBe(original.teacherId);
    expect(session.origin).toBe("manual");
    expect(session.status).toBe("scheduled");
  });

  it("lets the operator move the make-up away from every default", async () => {
    const compensation = await registered();

    const scheduled = await repo.schedule(compensation.id, {
      date: OFF_SCHEDULE_DATE,
      startTime: "09:00",
      endTime: "09:30",
      roomId: "r3",
      teacherId: "t2",
      acknowledgeWarnings: true,
      actor: { userId: "usr_manager", permissions: permissionsForRole("manager") },
    });

    const session = await scheduling.get(scheduled.currentAttempt!.sessionId);
    expect(session.date).toBe(OFF_SCHEDULE_DATE);
    expect(session.roomId).toBe("r3");
    expect(session.teacherId).toBe("t2");
    expect(scheduled.attempts[0].scheduledByUserId).toBe("usr_manager");
  });

  it("inherits the scheduling domain's own refusals instead of inventing its own", async () => {
    const compensation = await registered();

    // A make-up off the class's own day is a WARNING: refused unless the operator
    // acknowledges it, and worded by the conflict engine that owns the rule.
    const refused = await codeOf(
      repo.schedule(compensation.id, {
        date: OFF_SCHEDULE_DATE,
        startTime: "09:00",
        endTime: "09:30",
        actor: ACTOR,
      }),
    );
    expect(refused).not.toBe("OK");
    expect((await repo.get(compensation.id)).attempts).toHaveLength(0);

    // A 5-minute make-up violates the duration bounds, which this domain does not
    // restate.
    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "09:00",
          endTime: "09:05",
          acknowledgeWarnings: true,
          actor: ACTOR,
        }),
      ),
    ).toBe(SESSION_ERRORS.CONFLICT);
  });

  /**
   * C-1. This case used to pin the opposite — a second booking appending a second
   * attempt beside the live one — and that behaviour is now refused. The refusal
   * is the point: a make-up an operator booked may already have been promised to
   * the family, so it is never superseded, re-pointed or silently cancelled. The
   * obligation's attempt ledger gains a line only when the previous attempt has
   * stopped being live (cancelled or deleted — the cases below).
   */
  it("refuses a second booking while the current attempt is live, and appends nothing", async () => {
    const compensation = await registered();

    const first = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    const sessionsBefore = store.scheduledSessions.all().length;
    const attemptSessionId = first.currentAttempt!.sessionId;

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);

    // No session was created and no attempt was appended: the live make-up and
    // the obligation are exactly as they were.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    const reread = await repo.get(compensation.id);
    expect(reread.attempts).toHaveLength(1);
    expect(reread.attempts[0].sessionId).toBe(attemptSessionId);
    expect(reread.currentAttempt!.sessionId).toBe(attemptSessionId);
    expect(reread.currentAttempt!.sessionStatus).toBe("scheduled");
    expect(reread.status).toBe("scheduled");
    expect(reread.attemptBroken).toBe(false);
  });

  it("refuses the second booking for every authorized role, not just the one that booked first", async () => {
    // The rule is about the obligation's state, not about who is asking: a manager
    // cannot supersede a secretary's booking either. An actor WITHOUT the write
    // permission is refused one step earlier — as FORBIDDEN rather than
    // ALREADY_SCHEDULED, learning nothing about the record — which
    // `authorization.test.ts` pins.
    const compensation = await registered();
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: { userId: "usr_manager", permissions: permissionsForRole("manager") },
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
  });

  it("re-checks the class kind at booking time", async () => {
    const compensation = await registered();
    await classes.update(PRIVATE_CLASS, { kind: "group" });

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "16:00",
          endTime: "17:00",
          acknowledgeWarnings: true,
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.CLASS_NOT_PRIVATE);
  });

  it("refuses to book a discharged obligation", async () => {
    const compensation = await registered();
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    await repo.complete(compensation.id, { actor: ACTOR });

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SETTLED);
  });
});

/**
 * A MOVE IS NOT A CANCELLATION (C-1.1).
 *
 * `rescheduleSession` implements a move as "cancel the row, create a linked
 * replacement" — its audit device, not a statement that the lesson was called
 * off. Reading the attempt's own session would call that a broken make-up and
 * re-open the debt while the make-up is still on the calendar, and would let a
 * second one be booked. The domain therefore reads the booking's RESCHEDULE
 * LINEAGE: the ledger keeps its entry, the derived answers follow the chain, and
 * nothing is ever re-pointed.
 */
describe("a rescheduled make-up is still the same make-up", () => {
  /** Books the make-up and moves it once; returns both ends of the move. */
  async function bookedAndMoved() {
    const compensation = await registered();
    const booked = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    const entrySessionId = booked.currentAttempt!.sessionId;
    const replacement = await scheduling.rescheduleSession(entrySessionId, {
      date: OFF_SCHEDULE_DATE,
      startTime: "09:00",
      endTime: "10:00",
      reason: "درخواست خانواده برای جابه‌جایی",
      acknowledgeWarnings: true,
    });
    return { compensation, entrySessionId, replacement };
  }

  it("follows the move: the obligation stays scheduled, on the replacement, with one ledger line", async () => {
    const { compensation, entrySessionId, replacement } = await bookedAndMoved();

    // Scheduling's own record of the move: a replacement linked from the moved
    // row, which is cancelled with the reason kept on it.
    expect(replacement.rescheduledFromId).toBe(entrySessionId);
    expect((await scheduling.get(entrySessionId)).rescheduledToId).toBe(replacement.id);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attemptBroken).toBe(false);
    // The read model names the EFFECTIVE session and keeps the booked one visible.
    expect(after.currentAttempt!.sessionId).toBe(replacement.id);
    expect(after.currentAttempt!.sessionStatus).toBe("scheduled");
    expect(after.currentAttempt!.bookedSessionId).toBe(entrySessionId);
    expect(after.currentAttempt!.rescheduleCount).toBe(1);
    // The ledger did not grow and was not re-pointed: one line, still naming the
    // session the booking created.
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(entrySessionId);
    // A move is not something to draw attention to.
    expect((await repo.list({ needsAttention: true })).data).toHaveLength(0);
  });

  it("still refuses a second booking after the move, and discharges against the moved session", async () => {
    const { compensation, replacement } = await bookedAndMoved();
    const sessionsBefore = store.scheduledSessions.all().length;

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);

    const done = await repo.complete(compensation.id, { actor: ACTOR });
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeTruthy();
    expect(done.currentAttempt!.sessionId).toBe(replacement.id);
    expect(done.attempts).toHaveLength(1);
  });

  it("follows a second move: three sessions, one live make-up, one ledger line", async () => {
    const { compensation, entrySessionId, replacement } = await bookedAndMoved();

    const third = await scheduling.rescheduleSession(replacement.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      reason: "تغییر دوبارهٔ زمان",
    });

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attemptBroken).toBe(false);
    expect(after.currentAttempt!.sessionId).toBe(third.id);
    expect(after.currentAttempt!.bookedSessionId).toBe(entrySessionId);
    expect(after.currentAttempt!.rescheduleCount).toBe(2);
    expect(after.attempts).toHaveLength(1);

    // Exactly one live make-up: the calendar holds the third session, and the two
    // the moves left behind are cancelled.
    expect((await scheduling.get(entrySessionId)).status).toBe("cancelled");
    expect((await scheduling.get(replacement.id)).status).toBe("cancelled");
    expect((await scheduling.get(third.id)).status).toBe("scheduled");

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    expect((await repo.complete(compensation.id, { actor: ACTOR })).currentAttempt!.sessionId).toBe(
      third.id,
    );
  });

  it("returns to required only when the END of the chain is cancelled", async () => {
    const { compensation, replacement } = await bookedAndMoved();

    await scheduling.cancelSession(replacement.id, "هنرجو بیمار شد");

    const back = await repo.get(compensation.id);
    expect(back.status).toBe("required");
    expect(back.attemptBroken).toBe(true);
    expect(back.currentAttempt!.sessionStatus).toBe("cancelled");
    // The booked entry and the move count stay readable: history is not erased.
    expect(back.currentAttempt!.rescheduleCount).toBe(1);
    expect(back.attempts).toHaveLength(1);
    expect((await repo.list({ needsAttention: true })).data.map((c) => c.id)).toEqual([
      compensation.id,
    ]);
    expect(await codeOf(repo.complete(compensation.id, { actor: ACTOR }))).toBe(
      COMPENSATION_ERRORS.NOT_SCHEDULED,
    );

    // And now — and only now — booking another make-up is the right answer.
    const rebooked = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      actor: ACTOR,
    });
    expect(rebooked.status).toBe("scheduled");
    expect(rebooked.attemptBroken).toBe(false);
    expect(rebooked.attempts).toHaveLength(2);
    expect(rebooked.currentAttempt!.bookedSessionId).toBe(rebooked.currentAttempt!.sessionId);
    expect(rebooked.currentAttempt!.rescheduleCount).toBe(0);
  });

  it("treats a deleted END of the chain as broken too", async () => {
    const { compensation, replacement } = await bookedAndMoved();
    await scheduling.delete(replacement.id);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("required");
    expect(after.attemptBroken).toBe(true);
    expect(after.currentAttempt!.sessionStatus).toBe("missing");
  });

  it("resolves the move even when the moved-from row was deleted", async () => {
    const { compensation, entrySessionId, replacement } = await bookedAndMoved();

    // A cancelled row with no attendance is deletable by design, and the row that
    // holds the forward link is exactly that row. The reverse
    // `rescheduledFromId` relation is what keeps the booking's continuation
    // reachable, so a deleted row cannot re-open a debt that is being honoured.
    await scheduling.delete(entrySessionId);
    expect(store.scheduledSessions.find(entrySessionId)).toBeUndefined();

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attemptBroken).toBe(false);
    expect(after.currentAttempt!.sessionId).toBe(replacement.id);
    expect(after.currentAttempt!.bookedSessionId).toBe(entrySessionId);
    expect(after.currentAttempt!.rescheduleCount).toBe(1);

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
  });

  it("fails visible, without guessing, when the lineage cannot be resolved", async () => {
    const { compensation, entrySessionId, replacement } = await bookedAndMoved();
    // Both ends gone: there is nothing left to walk, and the replacement's own
    // link went with the entry row.
    await scheduling.delete(replacement.id);
    await scheduling.delete(entrySessionId);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("required");
    expect(after.attemptBroken).toBe(true);
    expect(after.currentAttempt!.sessionStatus).toBe("missing");
    expect((await repo.list({ needsAttention: true })).data.map((c) => c.id)).toEqual([
      compensation.id,
    ]);
    // Reported, never guessed and never replaced: the ledger still names what it
    // booked, and the read model says the make-up could not be resolved.
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(entrySessionId);
    expect(after.currentAttempt!.bookedSessionId).toBe(entrySessionId);
  });

  it("matches any session in the lineage for the reverse lookup and the status filter", async () => {
    const { compensation, entrySessionId, replacement } = await bookedAndMoved();

    expect((await repo.list({ status: "scheduled" })).data.map((c) => c.id)).toEqual([
      compensation.id,
    ]);
    // The entry the ledger recorded, and the session the make-up is on now.
    expect(
      (await repo.list({ compensationSessionId: entrySessionId })).data.map((c) => c.id),
    ).toEqual([compensation.id]);
    expect(
      (await repo.list({ compensationSessionId: replacement.id })).data.map((c) => c.id),
    ).toEqual([compensation.id]);
    expect((await repo.list({ compensationSessionId: "ses_nope" })).data).toHaveLength(0);
    expect((await repo.list({ status: "required" })).data).toHaveLength(0);
  });
});

describe("cancelling the attempt returns the obligation to required", () => {
  it("derives back to required, preserves the cancelled attempt, and refuses completion", async () => {
    const compensation = await registered();
    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    const attemptSessionId = scheduled.currentAttempt!.sessionId;

    await scheduling.cancelSession(attemptSessionId, "هنرجو بیمار شد");

    const back = await repo.get(compensation.id);
    expect(back.status).toBe("required");
    expect(back.attemptBroken).toBe(true);
    expect(back.currentAttempt?.sessionStatus).toBe("cancelled");
    // History is preserved: the cancelled attempt is still on the record.
    expect(back.attempts).toHaveLength(1);
    expect(back.attempts[0].sessionId).toBe(attemptSessionId);

    expect(await codeOf(repo.complete(compensation.id, { actor: ACTOR }))).toBe(
      COMPENSATION_ERRORS.NOT_SCHEDULED,
    );

    const rebooked = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      actor: ACTOR,
    });
    expect(rebooked.status).toBe("scheduled");
    expect(rebooked.attempts).toHaveLength(2);
    expect(rebooked.attempts[0].sessionId).toBe(attemptSessionId);
  });

  it("lets the operator book again once the attempt session is gone", async () => {
    const compensation = await registered();
    const first = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    const deletedSessionId = first.currentAttempt!.sessionId;
    await scheduling.delete(deletedSessionId);

    // Nothing is live any more, so the obligation is open and booking is exactly
    // what should be possible — the refusal only concerns a LIVE attempt.
    const second = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      actor: ACTOR,
    });

    expect(second.status).toBe("scheduled");
    expect(second.attemptBroken).toBe(false);
    // History is appended to, never rewritten: the deleted session is still there.
    expect(second.attempts).toHaveLength(2);
    expect(second.attempts[0].sessionId).toBe(deletedSessionId);
    expect(second.currentAttempt!.sessionId).not.toBe(deletedSessionId);
    expect((await scheduling.get(second.currentAttempt!.sessionId)).status).toBe("scheduled");
  });

  it("treats a hard-deleted attempt as broken too", async () => {
    const compensation = await registered();
    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    await scheduling.delete(scheduled.currentAttempt!.sessionId);

    const reread = await repo.get(compensation.id);
    expect(reread.status).toBe("required");
    expect(reread.attemptBroken).toBe(true);
    expect(reread.currentAttempt?.sessionStatus).toBe("missing");
  });
});

describe("completion", () => {
  it("discharges the obligation once, terminally", async () => {
    const compensation = await registered();
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });

    const done = await repo.complete(compensation.id, {
      actor: { userId: "usr_manager", permissions: permissionsForRole("manager") },
    });
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeTruthy();
    expect(done.completedByUserId).toBe("usr_manager");

    expect(await codeOf(repo.complete(compensation.id, { actor: ACTOR }))).toBe(
      COMPENSATION_ERRORS.ALREADY_SETTLED,
    );
  });

  it("refuses to discharge an obligation that was never booked", async () => {
    const compensation = await registered();

    expect(await codeOf(repo.complete(compensation.id, { actor: ACTOR }))).toBe(
      COMPENSATION_ERRORS.NOT_SCHEDULED,
    );
    expect((await repo.get(compensation.id)).completedAt).toBeUndefined();
  });

  it("does not require an attendance mark on the make-up", async () => {
    const compensation = await registered();
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });

    // The two facts are independent by design: session lifecycle is a different
    // concern (the SL workstream), and a decision is still a decision.
    const marks = await attendance.list({ studentId: PRIVATE_STUDENT });
    expect(marks.data.filter((m) => m.sessionId === compensation.attempts[0].sessionId)).toHaveLength(0);

    expect((await repo.complete(compensation.id, { actor: ACTOR })).status).toBe(
      "completed",
    );
  });
});

describe("reads and filters", () => {
  it("finds an obligation by its typed links and its derived state", async () => {
    const first = await registered();
    const second = await registered(OFF_SCHEDULE_DATE);
    await repo.schedule(first.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    await repo.schedule(second.id, {
      date: OFF_SCHEDULE_DATE,
      startTime: "09:00",
      endTime: "09:30",
      acknowledgeWarnings: true,
      actor: ACTOR,
    });
    await repo.complete(first.id, { actor: ACTOR });

    const byOriginal = await repo.list({ originalSessionId: first.originalSessionId });
    expect(byOriginal.data.map((c) => c.id)).toEqual([first.id]);

    expect((await repo.list({ studentId: PRIVATE_STUDENT })).data).toHaveLength(2);
    expect((await repo.list({ classId: PRIVATE_CLASS })).data).toHaveLength(2);
    expect((await repo.list({ status: "completed" })).data.map((c) => c.id)).toEqual([first.id]);
    expect((await repo.list({ status: "scheduled" })).data.map((c) => c.id)).toEqual([second.id]);
    // A completed obligation cannot be discharged, so it is never "open".
    expect((await repo.list({ openOnly: true })).data.map((c) => c.id)).toEqual([second.id]);

    const attemptSessionId = (await repo.get(second.id)).currentAttempt!.sessionId;
    expect((await repo.list({ compensationSessionId: attemptSessionId })).data.map((c) => c.id)).toEqual([
      second.id,
    ]);

    expect((await repo.list({ needsAttention: true })).data).toHaveLength(0);
  });

  it("surfaces a broken attempt through needsAttention", async () => {
    const compensation = await registered();
    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });
    await scheduling.cancelSession(scheduled.currentAttempt!.sessionId, "لغو");

    const attention = await repo.list({ needsAttention: true });
    expect(attention.data.map((c) => c.id)).toEqual([compensation.id]);
    expect(attention.data[0].attemptBroken).toBe(true);
  });

  it("keeps a readable obligation whose original session was hard-deleted", async () => {
    const compensation = await registered();
    expect(store.scheduledSessions.remove(compensation.originalSessionId)).toBe(true);

    const orphan = await repo.get(compensation.id);
    // The obligation outlives the row it compensates for, and says so.
    expect(orphan.originalMissing).toBe(true);
    expect(orphan.status).toBe("required");
    expect(orphan.classId).toBe(PRIVATE_CLASS);
    expect(orphan.studentId).toBe(PRIVATE_STUDENT);
  });

  it("refuses an unknown obligation", async () => {
    expect(await codeOf(repo.get("cmp_nope"))).toBe(COMPENSATION_ERRORS.NOT_FOUND);
    expect(
      await codeOf(repo.complete("cmp_nope", { actor: ACTOR })),
    ).toBe(COMPENSATION_ERRORS.NOT_FOUND);
  });
});
