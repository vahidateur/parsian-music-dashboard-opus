/**
 * C-1 — at most one live attempt per obligation, and one writer at a time.
 *
 * These are the cases that need a REAL interleaving, so they live in their own
 * file rather than beside the sequential rules in `demoRepository.test.ts` (the
 * project's rule: new cases go in new files).
 *
 * What is pinned here:
 *
 *   - a second booking is refused while the current attempt is live, and it
 *     creates nothing: no session, no ledger line, no supersede;
 *   - `schedule` and `complete` share ONE serialized section per obligation, so
 *     two concurrent bookings produce ONE session and ONE refusal, and a booking
 *     racing a discharge resolves in a fixed order instead of losing a race;
 *   - whatever the order, a discharged obligation never acquires an attempt
 *     afterwards, and no session is left in the calendar that no attempt
 *     references;
 *   - moving a make-up is `rescheduleSession`, and it does not rewrite the
 *     ledger — but it is still the SAME make-up: the refusal, the discharge and
 *     the model-level defence all follow the lineage to the session the booking
 *     stands on now (C-1.1), and a session inside a lineage is claimed once
 *     however many obligations' ledgers name it.
 *
 * The seams are the ones the domain already composes: a second repository over
 * the same store, and an intercepted `scheduling.create` — the verb whose await
 * is the window a race would have to use. Nothing about the architecture is bent
 * for these tests, and the production code contains no test-only path.
 *
 * WHAT THESE CASES DO NOT PROVE: two BROWSERS do not share this event loop, so
 * none of this is a cross-client guarantee. The server owns that, with a
 * transaction and an idempotent write (see `repository.ts`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { permissionsForRole } from "@/domains/auth/permissions";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import type { CreateSessionInput } from "@/domains/scheduling/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import {
  COMPENSATION_ERRORS,
  type CompensationActor,
  type SessionCompensation,
} from "../types";

/** A seeded PRIVATE class with exactly one enrolled student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** cl2 meets on day index 3 (Tuesday), so this is one of its own days. */
const ON_SCHEDULE_DATE = "2027-05-11";

/** An administrator, from the REAL role matrix, so nothing here tests RBAC. */
const ACTOR: CompensationActor = {
  userId: "usr_admin",
  permissions: permissionsForRole("administrator"),
};

let repo: DemoCompensationRepository;
let scheduling: DemoSchedulingRepository;
let attendance: DemoAttendanceRepository;
let store: DemoStore;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  attendance = new DemoAttendanceRepository(store);
  scheduling = new DemoSchedulingRepository(store, () => attendance.sessionIdsWithAttendanceSync());
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

/** The code of an already-settled outcome, for the concurrent cases. */
function codeOfSettled(result: PromiseSettledResult<unknown>): string {
  if (result.status === "fulfilled") return "OK";
  return result.reason instanceof ApiError ? (result.reason.code ?? "UNKNOWN") : "UNKNOWN";
}

/** Every record whose ledger claims this session — the model's "linked once". */
function claimantsOf(sessionId: string): string[] {
  return store.sessionCompensations
    .all()
    .flatMap((record) =>
      record.attempts.some((attempt) => attempt.sessionId === sessionId) ? [record.id] : [],
    );
}

/** A cancelled private session: the only thing compensation may ever start from. */
async function cancelledPrivateSession(): Promise<string> {
  const created = await scheduling.create({
    classId: PRIVATE_CLASS,
    date: ON_SCHEDULE_DATE,
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

/** The one booking these cases start from, and the session it created. */
async function booked(compensation: SessionCompensation): Promise<string> {
  const scheduled = await repo.schedule(compensation.id, {
    date: ON_SCHEDULE_DATE,
    startTime: "16:00",
    endTime: "17:00",
    actor: ACTOR,
  });
  return scheduled.currentAttempt!.sessionId;
}

describe("a second booking is refused while the current attempt is live", () => {
  it("refuses it from another repository over the same store, and creates nothing", async () => {
    const compensation = await registered();
    const attemptSessionId = await booked(compensation);
    const sessionsBefore = store.scheduledSessions.all().length;

    // The rule is a property of the RECORD, not of the object that booked first:
    // a second adapter over the same store is refused the same way.
    const other = new DemoCompensationRepository(store, { scheduling, attendance });
    const error = await (async () => {
      try {
        await other.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "18:00",
          endTime: "19:00",
          actor: ACTOR,
        });
        return null;
      } catch (cause) {
        return cause instanceof ApiError ? cause : null;
      }
    })();

    expect(error?.code).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    // A conflict — the same 409 kind the other "already in this state" refusals
    // use — and never an authorization or validation failure dressed up as one.
    expect(error?.kind).toBe("conflict");

    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    const after = await repo.get(compensation.id);
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(attemptSessionId);
    expect(after.status).toBe("scheduled");
  });
});

describe("two concurrent bookings of the same obligation", () => {
  it("creates one session, appends one attempt, and refuses the other caller", async () => {
    const compensation = await registered();
    const sessionsBefore = store.scheduledSessions.all().length;

    /*
     * HOW MANY SESSION WRITES ARE IN FLIGHT AT ONCE. The section exists so that
     * this never exceeds one for a given obligation: the window it closes is the
     * await on `create()`, during which a caller without the section would still
     * be holding a record that says "nothing is live yet".
     */
    let inFlight = 0;
    let peakInFlight = 0;
    const instrumented = Object.create(scheduling) as DemoSchedulingRepository;
    instrumented.create = async (input: CreateSessionInput) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      try {
        return await scheduling.create(input);
      } finally {
        inFlight -= 1;
      }
    };

    // Two ADAPTERS, one store and one section: a double submit does not have to
    // come from the same object, and the guarantee is about the data.
    const deps = { scheduling: instrumented, attendance };
    const first = new DemoCompensationRepository(store, deps);
    const second = new DemoCompensationRepository(store, deps);

    const outcomes = await Promise.allSettled([
      first.schedule(compensation.id, {
        date: ON_SCHEDULE_DATE,
        startTime: "16:00",
        endTime: "17:00",
        actor: ACTOR,
      }),
      second.schedule(compensation.id, {
        date: ON_SCHEDULE_DATE,
        startTime: "18:00",
        endTime: "19:00",
        actor: ACTOR,
      }),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const refused = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(codeOfSettled(refused[0])).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);

    // One session was created, not two, and never two at the same time.
    expect(peakInFlight).toBe(1);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore + 1);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attempts).toHaveLength(1);
    // The winning session is the one on the ledger, it is live, and it is claimed
    // exactly once — the refused caller left no session behind.
    const winner = after.currentAttempt!.sessionId;
    expect(store.scheduledSessions.find(winner)?.status).toBe("scheduled");
    expect(claimantsOf(winner)).toEqual([compensation.id]);
  });
});

describe("the model-level defence refuses before the session write", () => {
  it("refuses an ambiguous ledger and creates no session", async () => {
    const compensation = await registered();
    const attemptSessionId = await booked(compensation);
    // Cancelled, so the attempt is no longer live and C-1 is not what answers
    // here: the booking is allowed to reach the ledger check.
    await scheduling.cancelSession(attemptSessionId, "لغو جلسهٔ جبرانی");

    const other = await registered();
    const stamp = new Date().toISOString();
    // A ledger only a hand-edited backup could produce: one session claimed by two
    // obligations. `validateDataset` refuses to import it; the write path must
    // refuse to extend it.
    expect(
      store.sessionCompensations.update(other.id, {
        attempts: [
          { sessionId: attemptSessionId, scheduledAt: stamp, scheduledByUserId: ACTOR.userId },
        ],
        updatedAt: stamp,
      }),
    ).toBeTruthy();

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
    ).toBe(COMPENSATION_ERRORS.SESSION_ALREADY_LINKED);

    // The refusal happened BEFORE the session write — which is the whole reason
    // the check moved: no stray session is left in the calendar on this path.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    expect((await repo.get(compensation.id)).attempts).toHaveLength(1);
  });
});

describe("a booking racing a discharge", () => {
  it("books and then discharges when the booking reaches the section first", async () => {
    const compensation = await registered();
    const sessionsBefore = store.scheduledSessions.all().length;

    /*
     * The worst possible moment for the interleave: the discharge is attempted
     * from INSIDE the booking's session write, i.e. after the booking's checks
     * and before its ledger append. It is deliberately not awaited there — it is
     * a second caller, and it waits in the section like any other.
     */
    let discharge: Promise<SessionCompensation> | undefined;
    const instrumented = Object.create(scheduling) as DemoSchedulingRepository;
    instrumented.create = async (input: CreateSessionInput) => {
      const session = await scheduling.create(input);
      discharge = repo.complete(compensation.id, { actor: ACTOR });
      return session;
    };
    const racing = new DemoCompensationRepository(store, { scheduling: instrumented, attendance });

    const booking = await racing.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });

    expect(discharge).toBeDefined();
    const discharged = await discharge!;

    // The discharge was decided against the COMMITTED booking — it saw the
    // attempt, which is the only reason it could succeed at all.
    expect(discharged.status).toBe("completed");
    expect(discharged.attempts).toHaveLength(1);
    expect(discharged.attempts[0].sessionId).toBe(booking.currentAttempt!.sessionId);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeTruthy();
    expect(after.attempts).toHaveLength(1);
    // Exactly one session exists for this obligation, and the ledger claims it.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore + 1);
    expect(claimantsOf(after.attempts[0].sessionId)).toEqual([compensation.id]);
  });

  it("refuses the discharge and then books when the discharge reaches the section first", async () => {
    const compensation = await registered();
    const sessionsBefore = store.scheduledSessions.all().length;

    // Enqueued in this order, deliberately: the discharge is called first, finds
    // nothing live, and is refused — it does not queue behind the booking and
    // decide afterwards. `complete` is not a deferred promise to discharge.
    const discharge = repo.complete(compensation.id, { actor: ACTOR });
    const booking = repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ACTOR,
    });

    expect(await codeOf(discharge)).toBe(COMPENSATION_ERRORS.NOT_SCHEDULED);
    expect((await booking).status).toBe("scheduled");

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.completedAt).toBeUndefined();
    expect(after.attempts).toHaveLength(1);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore + 1);
    expect(claimantsOf(after.attempts[0].sessionId)).toEqual([compensation.id]);
  });

  it("refuses a second booking that races a discharge, and the discharge still stands", async () => {
    const compensation = await registered();
    const attemptSessionId = await booked(compensation);
    const sessionsBefore = store.scheduledSessions.all().length;

    const secondBooking = repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      actor: ACTOR,
    });
    const discharge = repo.complete(compensation.id, { actor: ACTOR });

    // C-1 runs inside the section, so it is answered against the state the first
    // booking left: a live attempt, refused, and nothing created.
    expect(await codeOf(secondBooking)).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    expect((await discharge).status).toBe("completed");

    // The ledger grew by nothing: the refused booking appended no line and the
    // discharge added none, so the discharged obligation carries exactly the
    // attempt it was discharged against.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    const after = await repo.get(compensation.id);
    expect(after.status).toBe("completed");
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(attemptSessionId);
    expect(after.currentAttempt!.sessionId).toBe(attemptSessionId);
  });

  it("refuses the booking as terminal when the discharge reaches the section first", async () => {
    const compensation = await registered();
    const attemptSessionId = await booked(compensation);
    const sessionsBefore = store.scheduledSessions.all().length;

    const discharge = repo.complete(compensation.id, { actor: ACTOR });
    const secondBooking = repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      actor: ACTOR,
    });

    expect((await discharge).status).toBe("completed");
    // Terminal wins, with the code this verb has always answered for a discharged
    // obligation: C-1 added a refusal for a LIVE attempt, it did not change the
    // precedence of the existing terminal one.
    expect(await codeOf(secondBooking)).toBe(COMPENSATION_ERRORS.ALREADY_SETTLED);

    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    const after = await repo.get(compensation.id);
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(attemptSessionId);
    // The whole point of sharing the section: a completed obligation can never end
    // up with an attempt after the discharge, whoever calls and in whatever order.
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeTruthy();
  });
});

/**
 * C-1.1 — the same invariant, on the session the make-up is actually on.
 *
 * `rescheduleSession` cancels the row it moved and creates a linked replacement,
 * so the entry a ledger line names is `cancelled` the moment the make-up is moved.
 * A rule that read the entry would call that make-up broken: it would let a second
 * one be booked while the first is still on the calendar, and it would refuse the
 * discharge of a make-up that is being honoured. These cases pin the invariant
 * against the EFFECTIVE session, and they fail if the lineage walk is removed.
 */
describe("a moved make-up is still the make-up", () => {
  /** One booking, moved once: the ledger entry and the session it stands on now. */
  async function bookedAndMoved() {
    const compensation = await registered();
    const entrySessionId = await booked(compensation);
    const replacement = await scheduling.rescheduleSession(entrySessionId, {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
      reason: "جابه‌جایی جلسهٔ جبرانی",
    });
    return { compensation, entrySessionId, replacementSessionId: replacement.id };
  }

  it("refuses a second booking while the MOVED-TO session is live, and creates nothing", async () => {
    const { compensation, entrySessionId, replacementSessionId } = await bookedAndMoved();
    const sessionsBefore = store.scheduledSessions.all().length;

    // The entry is cancelled — Scheduling cancelled it to perform the move — and
    // the booking is nevertheless live. This is the case that would silently open
    // a second make-up if the rule read the ledger's session instead of the chain.
    expect(store.scheduledSessions.find(entrySessionId)?.status).toBe("cancelled");

    const other = new DemoCompensationRepository(store, { scheduling, attendance });
    expect(
      await codeOf(
        other.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "20:00",
          endTime: "21:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);

    const after = await repo.get(compensation.id);
    expect(after.status).toBe("scheduled");
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].sessionId).toBe(entrySessionId);
    expect(after.currentAttempt!.sessionId).toBe(replacementSessionId);
    expect(after.currentAttempt!.rescheduleCount).toBe(1);

    // And when the END of the chain is cancelled the obligation really is open
    // again, so the refusal above was the lineage rule and not a blanket ban.
    await scheduling.cancelSession(replacementSessionId, "هنرجو بیمار شد");
    const rebooked = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "20:00",
      endTime: "21:00",
      actor: ACTOR,
    });
    expect(rebooked.status).toBe("scheduled");
    expect(rebooked.attempts).toHaveLength(2);
    // The new booking is a booking act of its own: its own entry, no moves.
    expect(rebooked.currentAttempt!.sessionId).toBe(rebooked.currentAttempt!.bookedSessionId);
    expect(rebooked.currentAttempt!.rescheduleCount).toBe(0);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore + 1);
    expect(claimantsOf(rebooked.currentAttempt!.sessionId)).toEqual([compensation.id]);
  });

  it("discharges against the MOVED-TO session while refusing the booking racing it", async () => {
    const { compensation, entrySessionId, replacementSessionId } = await bookedAndMoved();
    const sessionsBefore = store.scheduledSessions.all().length;

    const secondBooking = repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "20:00",
      endTime: "21:00",
      actor: ACTOR,
    });
    const discharge = repo.complete(compensation.id, { actor: ACTOR });

    expect(await codeOf(secondBooking)).toBe(COMPENSATION_ERRORS.ALREADY_SCHEDULED);
    const discharged = await discharge;
    expect(discharged.status).toBe("completed");
    // The discharge stands on the session the make-up is on now, and the ledger
    // still shows where the booking was made.
    expect(discharged.currentAttempt!.sessionId).toBe(replacementSessionId);
    expect(discharged.currentAttempt!.bookedSessionId).toBe(entrySessionId);
    expect(discharged.attempts).toHaveLength(1);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
  });

  it("refuses a ledger that claims a session inside another obligation's lineage", async () => {
    const first = await bookedAndMoved();
    // The chain's END is cancelled, so this obligation's own attempt is not live
    // and only the model-level defence can answer for it.
    await scheduling.cancelSession(first.replacementSessionId, "لغو جلسهٔ جبرانی");
    expect((await repo.get(first.compensation.id)).status).toBe("required");

    const other = await registered();
    const stamp = new Date().toISOString();
    /*
     * The collision a move would otherwise hide: the replacement session is not
     * the ENTRY of any ledger line — the first obligation's line names the row the
     * move cancelled — so a check that only collected `attempt.sessionId` would
     * let the second obligation claim the same make-up. Nothing but a hand-edited
     * backup produces this; the write path must still refuse to extend it.
     */
    expect(
      store.sessionCompensations.update(other.id, {
        attempts: [
          {
            sessionId: first.replacementSessionId,
            scheduledAt: stamp,
            scheduledByUserId: ACTOR.userId,
          },
        ],
        updatedAt: stamp,
      }),
    ).toBeTruthy();

    const sessionsBefore = store.scheduledSessions.all().length;
    expect(
      await codeOf(
        repo.schedule(other.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "20:00",
          endTime: "21:00",
          actor: ACTOR,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.SESSION_ALREADY_LINKED);
    // Refused BEFORE the session write: no stray session on the refusal path.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);

    // Control: with the injected claim removed the very same call succeeds, so the
    // refusal came from the ambiguous claim and nothing else.
    store.sessionCompensations.update(other.id, { attempts: [], updatedAt: stamp });
    const bookedOther = await repo.schedule(other.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "20:00",
      endTime: "21:00",
      actor: ACTOR,
    });
    expect(bookedOther.status).toBe("scheduled");
    expect(bookedOther.attempts).toHaveLength(1);
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore + 1);
  });
});
