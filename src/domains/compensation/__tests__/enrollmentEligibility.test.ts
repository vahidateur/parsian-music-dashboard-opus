/**
 * C-2 — the frozen student versus the roster at the make-up's date.
 *
 * An obligation freezes its student when it is registered. The enrollment behind
 * that student is LIVE data: it can end, be withdrawn, or start later than the date
 * an operator picks for the make-up. That is a fact about the calendar and the
 * enrolment, not a reason to lose the debt — so this domain DISCLOSES it on every
 * read (`currentAttempt.studentOnRoster`) and refuses nothing.
 *
 * What is pinned here, in the decision's own order:
 *
 *   - the ordinary case still works and says `true`;
 *   - an enrollment that ended, was withdrawn, or has not started yet says `false`
 *     — while the booking is still created, still `scheduled`, still one make-up,
 *     still dischargeable, and `needsAttention` stays silent because nothing is
 *     broken;
 *   - the fact FOLLOWS THE LINEAGE: moving the make-up to a date the student is
 *     still expected at clears it, with no write to this domain (C-1.1 intact);
 *   - the disclosed fact is the same fact attendance enforces, which is the whole
 *     reason it is worth showing at booking time;
 *   - the enrollment is NOT touched by booking — no make-up silently enrols
 *     anybody, and re-enrolling clears the disclosure with no compensation write;
 *   - it is derived, never stored: no field of the record carries it;
 *   - it never becomes a gate: the only refusal on the path is authorization, and a
 *     make-up whose student is off the roster is still refused a second booking.
 *
 * The seam is the real enrollment repository over the same demo store — the same
 * object a view would use — and nothing about the architecture is bent for these
 * cases. There is no test-only path in the production code.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { permissionsForRole } from "@/domains/auth/permissions";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { ATTENDANCE_ERRORS } from "@/domains/attendance/types";
import { DemoEnrollmentRepository } from "@/domains/enrollments/demoRepository";
import { jalaliToIso } from "@/domains/scheduling/dateBridge";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import type { RosterEntry } from "@/domains/scheduling/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import {
  COMPENSATION_ERRORS,
  type CompensationActor,
  type SessionCompensation,
} from "../types";

/** The seeded PRIVATE class with exactly one enrolled student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** The seeded enrollment edge for that pair (`enr_${classId}_${studentId}`). */
const PRIVATE_ENROLLMENT = `enr_${PRIVATE_CLASS}_${PRIVATE_STUDENT}`;
/**
 * cl2 meets on day index 3 (Tuesday). The original is cancelled on that day and the
 * make-up is booked the day after — off the class's schedule on purpose, so these
 * cases also show the two dates being used as different dates.
 */
const ON_SCHEDULE_DATE = "2027-05-11";
const MAKEUP_DATE = "2027-05-12";
/**
 * The enrollment's end date, in Jalali as the product types it: the CLASS's own day.
 * `endEnrollment()` asserts through the scheduling domain's own bridge that this is
 * exactly `ON_SCHEDULE_DATE`, which is what makes the roster still expect the
 * student that day and no longer expect them at the make-up.
 */
const ENROLLMENT_ENDED = "۱۴۰۶/۰۲/۲۱";

const ACTOR: CompensationActor = {
  userId: "usr_admin",
  permissions: permissionsForRole("administrator"),
};
const TEACHER: CompensationActor = {
  userId: "usr_teacher_1",
  permissions: permissionsForRole("teacher"),
};

let repo: DemoCompensationRepository;
let scheduling: DemoSchedulingRepository;
let attendance: DemoAttendanceRepository;
let enrollments: DemoEnrollmentRepository;
let store: DemoStore;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  attendance = new DemoAttendanceRepository(store);
  scheduling = new DemoSchedulingRepository(store, () => attendance.sessionIdsWithAttendanceSync());
  enrollments = new DemoEnrollmentRepository(store);
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
    acknowledgeWarnings: true,
  });
  await scheduling.cancelSession(created.id, "لغو از سوی مدرس");
  return created.id;
}

async function registered(): Promise<SessionCompensation> {
  return repo.register({
    originalSessionId: await cancelledPrivateSession(),
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسهٔ هنرجو",
    actor: ACTOR,
  });
}

/**
 * Books the make-up on the day after the class's own day. `MAKEUP_DATE` is
 * off-schedule, so the scheduling domain's WARNING applies and is acknowledged —
 * exactly what an operator moving a make-up off the class's day has to do.
 */
async function booked(compensation: SessionCompensation): Promise<SessionCompensation> {
  return repo.schedule(compensation.id, {
    date: MAKEUP_DATE,
    startTime: "16:00",
    endTime: "17:00",
    acknowledgeWarnings: true,
    actor: ACTOR,
  });
}

/**
 * Ends the enrollment — the C-2 condition — and proves the condition is REAL
 * before any assertion about the disclosure runs: the make-up session's derived
 * roster no longer expects the frozen student, while the end date is still the
 * class's own day. Nothing here touches the compensation domain.
 */
async function endEnrollment(makeUpSessionId: string): Promise<void> {
  expect(jalaliToIso(ENROLLMENT_ENDED)).toBe(ON_SCHEDULE_DATE);

  const updated = await enrollments.update(PRIVATE_ENROLLMENT, { endDate: ENROLLMENT_ENDED });
  expect(updated.endDate).toBe(ENROLLMENT_ENDED);

  const roster = await scheduling.sessionRoster(makeUpSessionId);
  expect(roster.map((entry) => entry.studentId)).not.toContain(PRIVATE_STUDENT);
}

describe("C-2 — the make-up when the frozen student is no longer on the roster", () => {
  it("reports the student as expected while the enrollment stands (normal booking)", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    const makeUpSessionId = after.currentAttempt!.sessionId;

    expect(after.status).toBe("scheduled");
    expect(after.attemptBroken).toBe(false);
    expect(after.currentAttempt!.studentOnRoster).toBe(true);
    // Nothing changed about the seat: the make-up is an ordinary session of the class.
    expect(await scheduling.sessionRoster(makeUpSessionId)).toHaveLength(1);
    expect((await repo.list({ needsAttention: true })).data).toHaveLength(0);
  });

  it("still books, stays scheduled and discharges when the enrollment ENDED before the make-up", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    const makeUpSessionId = after.currentAttempt!.sessionId;
    await endEnrollment(makeUpSessionId);

    // The session exists and is live, and the ledger claims it exactly once.
    const reread = await repo.get(compensation.id);
    expect(reread.status).toBe("scheduled");
    expect(reread.attemptBroken).toBe(false);
    expect(reread.attempts).toHaveLength(1);
    expect(store.scheduledSessions.find(reread.currentAttempt!.sessionId)?.status).toBe("scheduled");

    /*
     * The disclosure is a fact about a read, not a live view: the record returned by
     * the BOOKING reported the state at booking time (`true` — the enrollment stood
     * then), and a fresh read reports the state now. Both are honest; neither is a
     * cached verdict, because nothing stores it.
     */
    expect(after.currentAttempt!.studentOnRoster).toBe(true);
    expect(reread.currentAttempt!.studentOnRoster).toBe(false);
    expect((await repo.list()).data[0].currentAttempt!.studentOnRoster).toBe(false);

    // And the debt is still honoured: the make-up is discharged against that session.
    const discharged = await repo.complete(compensation.id, { actor: ACTOR });
    expect(discharged.status).toBe("completed");
    expect(discharged.currentAttempt!.sessionId).toBe(makeUpSessionId);
  });

  it("says `false`, and refuses nothing, once the enrollment ended", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    await endEnrollment(after.currentAttempt!.sessionId);

    const reread = await repo.get(compensation.id);
    expect(reread.currentAttempt!.studentOnRoster).toBe(false);

    // Nothing about the obligation changed: not the status, not the ledger, and not
    // the attention flag — an ended enrollment is not a broken make-up.
    expect(reread.status).toBe("scheduled");
    expect(reread.attemptBroken).toBe(false);
    expect(reread.attempts).toHaveLength(1);
    expect(reread.completedAt).toBeUndefined();
    expect((await repo.list({ needsAttention: true })).data).toHaveLength(0);
    expect((await repo.list({ status: "scheduled" })).data.map((c) => c.id)).toEqual([
      compensation.id,
    ]);
  });

  it("keeps the C-1 invariant while the student is off the roster: a second booking is still refused", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    await endEnrollment(after.currentAttempt!.sessionId);
    const sessionsBefore = store.scheduledSessions.all().length;

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: MAKEUP_DATE,
          startTime: "18:00",
          endTime: "19:00",
          acknowledgeWarnings: true,
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    // Refused because the make-up is LIVE, not because of the roster: nothing was
    // created, and the disclosure is what tells the operator about the roster.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    expect((await repo.get(compensation.id)).currentAttempt!.studentOnRoster).toBe(false);
  });

  it("follows the lineage: moving the make-up to a date the student is still expected at clears it", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    const makeUpSessionId = after.currentAttempt!.sessionId;
    await endEnrollment(makeUpSessionId);
    expect((await repo.get(compensation.id)).currentAttempt!.studentOnRoster).toBe(false);

    /*
     * The same student, the same enrollment, the same obligation — moved back to the
     * class's own day, which the enrollment still covers. The disclosure is computed
     * from the EFFECTIVE session, so it clears with no write here and no re-pointing
     * of the ledger (C-1.1).
     */
    const moved = await scheduling.rescheduleSession(makeUpSessionId, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      reason: "جابه‌جایی به روز کلاس",
    });

    const reread = await repo.get(compensation.id);
    expect(reread.status).toBe("scheduled");
    expect(reread.currentAttempt!.sessionId).toBe(moved.id);
    expect(reread.currentAttempt!.bookedSessionId).toBe(makeUpSessionId);
    expect(reread.currentAttempt!.rescheduleCount).toBe(1);
    expect(reread.attempts).toHaveLength(1);
    expect(reread.currentAttempt!.studentOnRoster).toBe(true);
  });

  it("discloses exactly the fact attendance enforces, and stores no roster fact of its own", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    const makeUpSessionId = after.currentAttempt!.sessionId;

    // On the roster: the make-up can be registered normally.
    const recorded = await attendance.record({
      sessionId: makeUpSessionId,
      studentId: PRIVATE_STUDENT,
      status: "present",
      recordedByUserId: ACTOR.userId,
    });
    expect(recorded.studentId).toBe(PRIVATE_STUDENT);
    expect((await repo.get(compensation.id)).currentAttempt!.studentOnRoster).toBe(true);

    // Off the roster: attendance refuses the mark — the enforcement the disclosure
    // was added to make predictable rather than surprising.
    await enrollments.update(PRIVATE_ENROLLMENT, { status: "completed" });
    expect((await repo.get(compensation.id)).currentAttempt!.studentOnRoster).toBe(false);
    const error = await (async () => {
      try {
        await attendance.record({
          sessionId: makeUpSessionId,
          studentId: PRIVATE_STUDENT,
          status: "present",
          recordedByUserId: ACTOR.userId,
        });
        return null;
      } catch (cause) {
        return cause instanceof ApiError ? cause : null;
      }
    })();
    expect(error?.code).toBe(ATTENDANCE_ERRORS.STUDENT_NOT_ON_ROSTER);

    // The disclosure is the roster's answer, never a copy of it: the stored record
    // carries no roster field, and booking wrote nothing about enrollment.
    const stored = store.sessionCompensations.find(compensation.id)!;
    expect(Object.keys(stored)).not.toContain("studentOnRoster");
    expect(JSON.stringify(stored)).not.toContain("studentOnRoster");
  });

  it("is never a gate: authorization is the only refusal, booking enrols nobody, and re-enrolling clears it", async () => {
    const compensation = await registered();

    // A teacher is refused by the permission gate — the only refusal on this path.
    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: MAKEUP_DATE,
          startTime: "16:00",
          endTime: "17:00",
          acknowledgeWarnings: true,
          actor: TEACHER,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.FORBIDDEN);

    // Withdraw the student BEFORE any make-up exists, then book: the booking is
    // still allowed, and the roster state is disclosed rather than enforced.
    await enrollments.update(PRIVATE_ENROLLMENT, { status: "completed" });
    const after = await booked(compensation);
    expect(after.status).toBe("scheduled");
    expect(after.currentAttempt!.studentOnRoster).toBe(false);

    // Booking wrote no enrollment: the make-up is an ordinary session, the ended
    // enrollment stays ended, and no second edge appears for the class.
    const enrollment = await enrollments.get(PRIVATE_ENROLLMENT);
    expect(enrollment.status).toBe("completed");
    expect(store.enrollments.all().filter((e) => e.classId === PRIVATE_CLASS)).toHaveLength(1);

    // Re-enrolling clears the disclosure with no compensation write at all.
    await enrollments.update(PRIVATE_ENROLLMENT, { status: "active" });
    const reread = await repo.get(compensation.id);
    expect(reread.currentAttempt!.studentOnRoster).toBe(true);
    expect(reread.status).toBe("scheduled");
  });

  it("says nothing it cannot determine: with no make-up, and with an unresolvable lineage", async () => {
    const compensation = await registered();
    // No attempt: there is no session to ask the roster about.
    expect((await repo.get(compensation.id)).currentAttempt).toBeUndefined();

    const after = await booked(compensation);
    expect(after.currentAttempt!.studentOnRoster).toBe(true);

    // Both ends of the lineage gone: the effective id is evidence, not a target
    // (C-1.1), so the roster question is not asked and the field is omitted.
    await scheduling.delete(after.currentAttempt!.sessionId);
    await scheduling.delete(compensation.originalSessionId);
    const unresolved = await repo.get(compensation.id);
    expect(unresolved.status).toBe("required");
    expect(unresolved.currentAttempt!.sessionStatus).toBe("missing");
    expect(unresolved.currentAttempt!.studentOnRoster).toBeUndefined();
  });
});

describe("C-2 — the roster read cannot turn a reportable state into an error", () => {
  it("reports the session as missing when it is deleted while the read is in flight", async () => {
    const compensation = await registered();
    const after = await booked(compensation);
    const makeUpSessionId = after.currentAttempt!.sessionId;

    /*
     * The read walks the lineage synchronously and then asks the roster about the
     * session — an await, and therefore a window. This seam puts a real delete in
     * exactly that window: the roster call is delegated to, the session vanishes,
     * and the scheduling repository throws NOT_FOUND. Before the retry this made
     * `repo.get()` fail, which contradicts what every other path promises for a
     * deleted session (`missing`, reported — never an error).
     */
    let deleted = false;
    const racing = Object.create(scheduling) as DemoSchedulingRepository;
    racing.sessionRoster = async (sessionId: string): Promise<RosterEntry[]> => {
      if (!deleted && sessionId === makeUpSessionId) {
        deleted = true;
        await scheduling.delete(makeUpSessionId);
      }
      return scheduling.sessionRoster(sessionId);
    };
    const reading = new DemoCompensationRepository(store, { scheduling: racing, attendance });

    const reread = await reading.get(compensation.id);
    expect(deleted).toBe(true);
    // The deletion is REPORTED, not thrown: fail-visible, and the undeterminable
    // roster answer is omitted rather than guessed.
    expect(reread.status).toBe("required");
    expect(reread.attemptBroken).toBe(true);
    expect(reread.currentAttempt!.sessionStatus).toBe("missing");
    expect(reread.currentAttempt!.studentOnRoster).toBeUndefined();
    expect(store.scheduledSessions.find(makeUpSessionId)).toBeUndefined();
  });
});
