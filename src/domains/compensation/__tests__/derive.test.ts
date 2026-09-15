/**
 * Compensation derivation — the rules, with no environment at all.
 *
 * These are the properties the whole domain rests on, so they are pinned here
 * where nothing can be blamed on storage, timing or React:
 *
 *   - `required` → `scheduled` → `completed` is derived from recorded facts;
 *   - a cancelled or deleted attempt sends the obligation BACK to `required`
 *     without a write, which is the owner's rule expressed as arithmetic;
 *   - `completed` is terminal, and still reports the contradiction instead of
 *     hiding it;
 *   - eligibility is the class KIND, never the roster size;
 *   - the default is a reformat of the original, never a booking.
 */
import { describe, expect, it } from "vitest";
import {
  attemptBroken,
  attemptStateOf,
  compensationDefaultFor,
  compensationStatusOf,
  currentAttemptOf,
  isCompensableClass,
  isCompensableOriginal,
  resolveAffectedStudent,
} from "../derive";
import { COMPENSATION_ERRORS, type SessionCompensationRecord } from "../types";

function record(over: Partial<SessionCompensationRecord> = {}): SessionCompensationRecord {
  return {
    id: "cmp_1",
    originalSessionId: "ses_original",
    classId: "cl_private",
    studentId: "st1",
    reason: "لغو جلسه",
    requiredAt: "2026-09-02T10:00:00.000Z",
    requiredByUserId: "usr_admin",
    attempts: [],
    createdAt: "2026-09-02T10:00:00.000Z",
    updatedAt: "2026-09-02T10:00:00.000Z",
    ...over,
  };
}

const attempt = (sessionId: string) => ({
  sessionId,
  scheduledAt: "2026-09-03T09:00:00.000Z",
  scheduledByUserId: "usr_admin",
});

describe("attemptStateOf", () => {
  it("reports a hard-deleted attempt session as missing, not as an error", () => {
    expect(attemptStateOf(undefined)).toBe("missing");
    expect(attemptStateOf({ status: "scheduled" })).toBe("scheduled");
  });
});

describe("compensationStatusOf", () => {
  it("is required while nothing was ever booked", () => {
    const { status, attemptBroken: broken } = compensationStatusOf(record(), undefined);
    expect(status).toBe("required");
    expect(broken).toBe(false);
  });

  it("is scheduled while the newest attempt's session lives", () => {
    const { status, attemptBroken: broken } = compensationStatusOf(
      record({ attempts: [attempt("ses_makeup")] }),
      { status: "scheduled" },
    );
    expect(status).toBe("scheduled");
    expect(broken).toBe(false);
  });

  it("returns to required when the attempt was cancelled, with no write", () => {
    const { status, attemptBroken: broken } = compensationStatusOf(
      record({ attempts: [attempt("ses_makeup")] }),
      { status: "cancelled" },
    );
    expect(status).toBe("required");
    expect(broken).toBe(true);
  });

  it("returns to required when the attempt session was hard-deleted", () => {
    const { status, attemptBroken: broken } = compensationStatusOf(
      record({ attempts: [attempt("ses_gone")] }),
      undefined,
    );
    expect(status).toBe("required");
    expect(broken).toBe(true);
  });

  it("treats the newest attempt as the current one, not the oldest", () => {
    const ledger = [attempt("ses_first"), attempt("ses_second")];
    // The first attempt was cancelled long ago; only the newest one is live.
    expect(compensationStatusOf(record({ attempts: ledger }), { status: "scheduled" }).status).toBe(
      "scheduled",
    );
    expect(
      compensationStatusOf(record({ attempts: ledger }), { status: "cancelled" }).status,
    ).toBe("required");
    expect(currentAttemptOf(record({ attempts: ledger }))?.sessionId).toBe("ses_second");
  });

  it("keeps a discharged obligation completed — the decision is terminal", () => {
    const discharged = record({
      attempts: [attempt("ses_makeup")],
      completedAt: "2026-09-10T12:00:00.000Z",
      completedByUserId: "usr_manager",
    });

    const live = compensationStatusOf(discharged, { status: "scheduled" });
    expect(live.status).toBe("completed");
    expect(live.attemptBroken).toBe(false);

    // Cancelling the session afterwards cannot undo the discharge; the
    // contradiction is reported rather than silently reopening the debt.
    const cancelled = compensationStatusOf(discharged, { status: "cancelled" });
    expect(cancelled.status).toBe("completed");
    expect(cancelled.attemptBroken).toBe(true);
  });
});

describe("attemptBroken", () => {
  it("is false when there is nothing to break", () => {
    expect(attemptBroken(record(), undefined)).toBe(false);
  });

  it("is true for a missing attempt session too", () => {
    expect(attemptBroken(record({ attempts: [attempt("ses_gone")] }), undefined)).toBe(true);
  });
});

describe("isCompensableOriginal", () => {
  const privateClass = { id: "cl2", kind: "private" as const };
  const groupClass = { id: "cl1", kind: "group" as const };

  it("requires BOTH a cancelled session and a private class", () => {
    expect(isCompensableOriginal({ status: "cancelled" }, privateClass)).toBe(true);
    expect(isCompensableOriginal({ status: "scheduled" }, privateClass)).toBe(false);
    expect(isCompensableOriginal({ status: "completed" }, privateClass)).toBe(false);
    expect(isCompensableOriginal({ status: "cancelled" }, groupClass)).toBe(false);
  });

  it("fails closed when the class cannot be read", () => {
    expect(isCompensableClass(undefined)).toBe(false);
    expect(isCompensableOriginal({ status: "cancelled" }, undefined)).toBe(false);
  });

  it("is a fact about the class kind, not about how many students it holds", () => {
    // Both classes may hold exactly one student; only the private one is eligible.
    expect(isCompensableClass({ id: "cl_group_of_one", kind: "group" })).toBe(false);
    expect(isCompensableClass(privateClass)).toBe(true);
  });
});

describe("resolveAffectedStudent", () => {
  const sara = { studentId: "st1", studentName: "سارا" };
  const reza = { studentId: "st2", studentName: "رضا" };

  it("freezes the single expected student when it is the named one", () => {
    expect(resolveAffectedStudent([sara], "st1")).toEqual({
      ok: true,
      studentId: "st1",
      studentName: "سارا",
    });
  });

  it("refuses an empty roster: nobody was expected, so nobody is owed", () => {
    expect(resolveAffectedStudent([], "st1")).toEqual({
      ok: false,
      code: COMPENSATION_ERRORS.NO_AFFECTED_STUDENT,
    });
  });

  it("refuses an ambiguous roster rather than picking one", () => {
    expect(resolveAffectedStudent([sara, reza], "st1")).toEqual({
      ok: false,
      code: COMPENSATION_ERRORS.ROSTER_AMBIGUOUS,
    });
  });

  it("refuses to freeze a student other than the one the session was about", () => {
    expect(resolveAffectedStudent([sara], "st2")).toEqual({
      ok: false,
      code: COMPENSATION_ERRORS.STUDENT_MISMATCH,
    });
  });
});

describe("compensationDefaultFor", () => {
  it("prefills the original's date, room and teacher, one hour long", () => {
    expect(
      compensationDefaultFor({
        date: "2026-09-08",
        startTime: "14:00",
        roomId: "r1",
        teacherId: "t1",
      }),
    ).toEqual({
      date: "2026-09-08",
      startTime: "14:00",
      endTime: "15:00",
      roomId: "r1",
      teacherId: "t1",
    });
  });

  it("keeps the minutes it was given, through the domain's own clock arithmetic", () => {
    expect(
      compensationDefaultFor({
        date: "2026-09-08",
        startTime: "14:45",
        roomId: "r1",
        teacherId: "t1",
      })?.endTime,
    ).toBe("15:45");
  });

  it("returns no default when the original is gone or its time is unreadable", () => {
    expect(compensationDefaultFor(undefined)).toBeNull();
    expect(
      compensationDefaultFor({
        date: "2026-09-08",
        startTime: "بعدازظهر",
        roomId: "r1",
        teacherId: "t1",
      }),
    ).toBeNull();
  });

  it("returns no default when one hour would cross midnight", () => {
    // A session spanning two calendar days is not a shape this model has, so the
    // caller gets no fabricated end time and must type one.
    expect(
      compensationDefaultFor({
        date: "2026-09-08",
        startTime: "23:30",
        roomId: "r1",
        teacherId: "t1",
      }),
    ).toBeNull();
  });
});
