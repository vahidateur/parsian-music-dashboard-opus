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
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { DemoClassRepository } from "@/domains/classes/demoRepository";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { SESSION_ERRORS } from "@/domains/scheduling/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import { COMPENSATION_ERRORS } from "../types";

/** A seeded PRIVATE class with exactly one enrolled student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** The seeded CANCELLED session — it belongs to a group class, so it is refused. */
const CANCELLED_GROUP_SESSION = "ses_cl10_20260908_1530";
/** cl2 meets on day index 3 (Tuesday): one date on its own day, one off it. */
const ON_SCHEDULE_DATE = "2027-05-11";
const OFF_SCHEDULE_DATE = "2027-05-12";
const ACTOR = "usr_admin";

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
    requiredByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.REASON_REQUIRED);

    expect(
      await codeOf(
        repo.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          requiredByUserId: "",
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
          requiredByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
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
      recordedByUserId: ACTOR,
    });
    await scheduling.cancelSession(created.id, "لغو دیرهنگام");

    expect(
      await codeOf(
        repo.register({
          originalSessionId: created.id,
          studentId: PRIVATE_STUDENT,
          reason: "دلیل",
          requiredByUserId: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ORIGINAL_ATTENDANCE_UNACKNOWLEDGED);

    const acknowledged = await repo.register({
      originalSessionId: created.id,
      studentId: PRIVATE_STUDENT,
      reason: "دلیل",
      requiredByUserId: ACTOR,
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
      recordedByUserId: ACTOR,
    });
    await scheduling.cancelSession(created.id, "لغو");
    const compensation = await repo.register({
      originalSessionId: created.id,
      studentId: PRIVATE_STUDENT,
      reason: "دلیل",
      requiredByUserId: ACTOR,
      acknowledgedOriginalAttendance: true,
    });
    expect(compensation.originalStudentAttendance).toBe("present");

    const marks = await attendance.list({ sessionId: created.id, studentId: PRIVATE_STUDENT });
    await attendance.correct(marks.data[0].id, {
      status: "absent",
      reason: "اصلاح ثبت",
      changedByUserId: ACTOR,
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
          requiredByUserId: ACTOR,
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
      scheduledByUserId: ACTOR,
    });
    await repo.complete(compensation.id, { completedByUserId: ACTOR });

    expect(
      await codeOf(
        repo.register({
          originalSessionId: compensation.originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "دوباره",
          requiredByUserId: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SETTLED);
    expect((await repo.get(compensation.id)).status).toBe("completed");
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
      scheduledByUserId: ACTOR,
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
      scheduledByUserId: "usr_manager",
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
        scheduledByUserId: ACTOR,
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
          scheduledByUserId: ACTOR,
        }),
      ),
    ).toBe(SESSION_ERRORS.CONFLICT);
  });

  it("appends to the ledger instead of replacing the previous attempt", async () => {
    const compensation = await registered();

    const first = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      scheduledByUserId: ACTOR,
    });
    const second = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      scheduledByUserId: ACTOR,
    });

    expect(second.attempts).toHaveLength(2);
    expect(second.attempts[0].sessionId).toBe(first.currentAttempt!.sessionId);
    expect(second.currentAttempt!.sessionId).not.toBe(first.currentAttempt!.sessionId);
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
          scheduledByUserId: ACTOR,
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
      scheduledByUserId: ACTOR,
    });
    await repo.complete(compensation.id, { completedByUserId: ACTOR });

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          scheduledByUserId: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SETTLED);
  });
});

describe("cancelling the attempt returns the obligation to required", () => {
  it("derives back to required, preserves the cancelled attempt, and refuses completion", async () => {
    const compensation = await registered();
    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      scheduledByUserId: ACTOR,
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

    expect(await codeOf(repo.complete(compensation.id, { completedByUserId: ACTOR }))).toBe(
      COMPENSATION_ERRORS.NOT_SCHEDULED,
    );

    const rebooked = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      scheduledByUserId: ACTOR,
    });
    expect(rebooked.status).toBe("scheduled");
    expect(rebooked.attempts).toHaveLength(2);
    expect(rebooked.attempts[0].sessionId).toBe(attemptSessionId);
  });

  it("treats a hard-deleted attempt as broken too", async () => {
    const compensation = await registered();
    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      scheduledByUserId: ACTOR,
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
      scheduledByUserId: ACTOR,
    });

    const done = await repo.complete(compensation.id, { completedByUserId: "usr_manager" });
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeTruthy();
    expect(done.completedByUserId).toBe("usr_manager");

    expect(await codeOf(repo.complete(compensation.id, { completedByUserId: ACTOR }))).toBe(
      COMPENSATION_ERRORS.ALREADY_SETTLED,
    );
  });

  it("refuses to discharge an obligation that was never booked", async () => {
    const compensation = await registered();

    expect(await codeOf(repo.complete(compensation.id, { completedByUserId: ACTOR }))).toBe(
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
      scheduledByUserId: ACTOR,
    });

    // The two facts are independent by design: session lifecycle is a different
    // concern (the SL workstream), and a decision is still a decision.
    const marks = await attendance.list({ studentId: PRIVATE_STUDENT });
    expect(marks.data.filter((m) => m.sessionId === compensation.attempts[0].sessionId)).toHaveLength(0);

    expect((await repo.complete(compensation.id, { completedByUserId: ACTOR })).status).toBe(
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
      scheduledByUserId: ACTOR,
    });
    await repo.schedule(second.id, {
      date: OFF_SCHEDULE_DATE,
      startTime: "09:00",
      endTime: "09:30",
      acknowledgeWarnings: true,
      scheduledByUserId: ACTOR,
    });
    await repo.complete(first.id, { completedByUserId: ACTOR });

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
      scheduledByUserId: ACTOR,
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
      await codeOf(repo.complete("cmp_nope", { completedByUserId: ACTOR })),
    ).toBe(COMPENSATION_ERRORS.NOT_FOUND);
  });
});
