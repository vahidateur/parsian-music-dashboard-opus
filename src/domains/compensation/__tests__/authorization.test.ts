/**
 * Compensation's three writes are protected operations.
 *
 * `register`, `schedule` and `complete` all require `schedule.write` — the
 * permission the scheduling domain already owns, because a make-up IS a session
 * write. No compensation-specific permission was invented, no second role model
 * was introduced, and nothing here bypasses the existing matrix: the actors in
 * these cases are built with `permissionsForRole()`, the same source
 * `useAuth().permissions` comes from.
 *
 * WHAT THESE CASES PROVE, AND WHAT THEY DO NOT
 *
 * They prove the domain refuses an unauthorized actor at the ONE point every
 * write passes through, that a teacher is refused exactly like any other role
 * without the permission, that an authorized secretary/manager/administrator is
 * not, and that a refusal happens before any read — so a refused caller learns
 * nothing about the record it named.
 *
 * They do NOT prove the product is secure, and cannot: the permissions arrive
 * with the call because the browser is where they are known, and `permissions.ts`
 * documents frontend RBAC as UX-level, bypassable by anyone with a console. The
 * server must re-derive the actor and its permissions from the session token and
 * refuse independently; this file pins the client-side half of that rule, which
 * is the half that exists today.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { can, PERMISSIONS, permissionsForRole, type RoleId } from "@/domains/auth/permissions";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import { COMPENSATION_ERRORS, type CompensationActor, type SessionCompensation } from "../types";

/** A seeded PRIVATE class with exactly one enrolled student (`st7`). */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** cl2 meets on day index 3, so this is one of its own days. */
const ON_SCHEDULE_DATE = "2027-05-11";

/** An actor built from the REAL role matrix — never a hand-written permission list. */
function actorOf(role: RoleId, userId = `usr_${role}`): CompensationActor {
  return { userId, permissions: permissionsForRole(role) };
}

const ADMIN = actorOf("administrator", "usr_admin");
/** The three roles the matrix grants `schedule.write` to. */
const AUTHORIZED_ROLES: RoleId[] = ["staff", "manager", "administrator"];
/** The two it withholds it from — a teacher first, because that is the rule. */
const FORBIDDEN_ROLES: RoleId[] = ["teacher", "accountant"];

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

/** The `ApiError` a refused call produced, or `null` when it resolved. */
async function errorOf(promise: Promise<unknown>): Promise<ApiError | null> {
  try {
    await promise;
    return null;
  } catch (cause) {
    return cause instanceof ApiError ? cause : null;
  }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await errorOf(promise);
  return error ? (error.code ?? "UNKNOWN") : "OK";
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

/** An obligation registered by an authorized actor, for the cases that need one. */
async function registered(actor: CompensationActor = ADMIN): Promise<SessionCompensation> {
  const originalSessionId = await cancelledPrivateSession();
  return repo.register({
    originalSessionId,
    studentId: PRIVATE_STUDENT,
    reason: "لغو جلسهٔ هنرجو",
    actor,
  });
}

describe("the permission model the gate rests on", () => {
  it("grants `schedule.write` to staff, manager and administrator, and withholds it from a teacher", () => {
    for (const role of AUTHORIZED_ROLES) {
      expect(can(actorOf(role), "schedule.write"), `${role} must hold schedule.write`).toBe(true);
    }
    for (const role of FORBIDDEN_ROLES) {
      expect(can(actorOf(role), "schedule.write"), `${role} must NOT hold schedule.write`).toBe(false);
    }
    // The gate is the EXISTING permission: no compensation-specific permission
    // was invented for it.
    expect(PERMISSIONS.filter((permission) => /compensat/i.test(permission))).toEqual([]);
  });
});

describe("an actor without `schedule.write` is refused", () => {
  it("refuses registration, as an authorization error, and writes nothing", async () => {
    const originalSessionId = await cancelledPrivateSession();

    const error = await errorOf(
      repo.register({
        originalSessionId,
        studentId: PRIVATE_STUDENT,
        reason: "لغو جلسهٔ هنرجو",
        actor: actorOf("accountant"),
      }),
    );

    expect(error?.code).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    // The taxonomy's existing 403 kind, so callers pattern-match on `kind`.
    expect(error?.kind).toBe("authorization");
    expect(store.sessionCompensations.all()).toHaveLength(0);
  });

  it("refuses a teacher registering — the rule this gate exists for", async () => {
    const originalSessionId = await cancelledPrivateSession();

    const error = await errorOf(
      repo.register({
        originalSessionId,
        studentId: PRIVATE_STUDENT,
        reason: "لغو جلسهٔ هنرجو",
        actor: actorOf("teacher", "usr_teacher_1"),
      }),
    );

    expect(error?.code).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    expect(store.sessionCompensations.all()).toHaveLength(0);
  });

  it("refuses a teacher both booking the make-up and discharging it, with no side effects", async () => {
    const compensation = await registered(ADMIN);
    const sessionsBefore = store.scheduledSessions.all().length;
    const teacher = actorOf("teacher", "usr_teacher_1");

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "16:00",
          endTime: "17:00",
          actor: teacher,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    expect(await codeOf(repo.complete(compensation.id, { actor: teacher }))).toBe(
      COMPENSATION_ERRORS.FORBIDDEN,
    );

    // Neither write happened: no session was created, no attempt was appended, the
    // obligation is still open and undischarged.
    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    const reread = await repo.get(compensation.id);
    expect(reread.attempts).toHaveLength(0);
    expect(reread.status).toBe("required");
    expect(reread.completedAt).toBeUndefined();
  });

  /**
   * C-1 added a refusal to `schedule`, and it must sit BEHIND the gate, not
   * beside it: an unauthorized caller is refused as FORBIDDEN and is never told
   * whether the obligation already has a live booking.
   */
  it("keeps the live-attempt refusal behind the permission, with nothing disclosed", async () => {
    const compensation = await registered(ADMIN);
    await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: ADMIN,
    });
    const sessionsBefore = store.scheduledSessions.all().length;
    const secondBooking = {
      date: ON_SCHEDULE_DATE,
      startTime: "18:00",
      endTime: "19:00",
    };

    // An authorized caller would now be refused ALREADY_SCHEDULED. This one is
    // refused earlier, and learns nothing about the booking.
    const error = await errorOf(
      repo.schedule(compensation.id, { ...secondBooking, actor: actorOf("teacher", "usr_teacher_1") }),
    );
    expect(error?.code).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    expect(error?.kind).toBe("authorization");

    // An unnamed actor is still a malformed request — the same validation code it
    // has always been — and also not a disclosure of the booking state.
    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          ...secondBooking,
          actor: { userId: "   ", permissions: permissionsForRole("administrator") },
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ACTOR_REQUIRED);

    expect(store.scheduledSessions.all()).toHaveLength(sessionsBefore);
    expect((await repo.get(compensation.id)).attempts).toHaveLength(1);
  });

  it("refuses an accountant the same way: the rule is the permission, not the job title", async () => {
    const compensation = await registered(ADMIN);

    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: ON_SCHEDULE_DATE,
          startTime: "16:00",
          endTime: "17:00",
          actor: actorOf("accountant"),
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    expect((await repo.get(compensation.id)).attempts).toHaveLength(0);
  });
});

describe("the refusal is the first thing that happens", () => {
  it("does not depend on the record existing, and does not report whether it does", async () => {
    const teacher = actorOf("teacher", "usr_teacher_1");

    // An unknown id would otherwise answer NOT_FOUND — an unauthorized caller must
    // not be able to use this domain as an existence oracle.
    expect(
      await codeOf(
        repo.schedule("cmp_does_not_exist", {
          date: ON_SCHEDULE_DATE,
          startTime: "16:00",
          endTime: "17:00",
          actor: teacher,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.FORBIDDEN);
    expect(await codeOf(repo.complete("cmp_does_not_exist", { actor: teacher }))).toBe(
      COMPENSATION_ERRORS.FORBIDDEN,
    );

    // Nor is a malformed registration judged first: authorization precedes it.
    expect(
      await codeOf(
        repo.register({
          originalSessionId: "ses_does_not_exist",
          studentId: PRIVATE_STUDENT,
          reason: "",
          actor: teacher,
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.FORBIDDEN);
  });

  it("keeps a missing actor a validation failure, not an authorization one", async () => {
    const originalSessionId = await cancelledPrivateSession();

    // The unnamed-actor refusal is unchanged (same code as before this gate
    // existed), so a caller that forgot the actor is not told it lacks a
    // permission it may well hold.
    expect(
      await codeOf(
        repo.register({
          originalSessionId,
          studentId: PRIVATE_STUDENT,
          reason: "لغو جلسهٔ هنرجو",
          actor: { userId: "   ", permissions: permissionsForRole("administrator") },
        }),
      ),
    ).toBe(COMPENSATION_ERRORS.ACTOR_REQUIRED);
    expect(store.sessionCompensations.all()).toHaveLength(0);
  });

  it("protects only the three writes: the reads are not gated here", async () => {
    const compensation = await registered(ADMIN);

    // Reading is governed by the view layer's `schedule.read`; these two verbs
    // take no actor at all, which is the contract, not an omission.
    expect((await repo.list()).data.map((row) => row.id)).toEqual([compensation.id]);
    expect((await repo.get(compensation.id)).id).toBe(compensation.id);
  });
});

describe("an authorized actor proceeds", () => {
  it("lets a secretary, a manager and an administrator register", async () => {
    const registered_ids: string[] = [];
    for (const role of AUTHORIZED_ROLES) {
      // Each role compensates its own cancelled session: uniqueness is per pair.
      const compensation = await registered(actorOf(role));
      registered_ids.push(compensation.id);
    }

    expect(registered_ids).toHaveLength(AUTHORIZED_ROLES.length);
    expect(store.sessionCompensations.all()).toHaveLength(AUTHORIZED_ROLES.length);
  });

  it("carries an authorized actor through the whole flow, recording who did what", async () => {
    const staff = actorOf("staff", "usr_staff_1");
    const compensation = await registered(staff);
    expect(compensation.requiredByUserId).toBe("usr_staff_1");

    const scheduled = await repo.schedule(compensation.id, {
      date: ON_SCHEDULE_DATE,
      startTime: "16:00",
      endTime: "17:00",
      actor: staff,
    });
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.attempts[0].scheduledByUserId).toBe("usr_staff_1");

    const manager = actorOf("manager", "usr_manager_1");
    const done = await repo.complete(compensation.id, { actor: manager });
    expect(done.status).toBe("completed");
    // Provenance records each actor; the AUTHORIZATION decision was the gate.
    expect(done.completedByUserId).toBe("usr_manager_1");
    // And the make-up is still an ordinary session on the ordinary calendar.
    expect((await scheduling.get(done.currentAttempt!.sessionId)).origin).toBe("manual");
  });
});
