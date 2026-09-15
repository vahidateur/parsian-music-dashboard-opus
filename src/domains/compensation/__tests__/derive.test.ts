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
 *   - the default is a reformat of the original, never a booking;
 *   - and a booked make-up is read as a LINEAGE: moving it keeps the obligation
 *     booked, only the end of the chain decides, and a chain that cannot be
 *     walked is reported rather than guessed (C-1.1).
 */
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_LINEAGE_MAX_MOVES,
  attemptBroken,
  attemptIsLive,
  attemptLineageOf,
  attemptStateOf,
  type LineageSession,
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

/**
 * THE LEDGER LINE NAMES A BOOKING ACT, NOT A ROW (C-1.1).
 *
 * `rescheduleSession` implements a move as "cancel the row, create a linked
 * replacement", so "is the make-up still on?" is a question about the END of the
 * chain, not about the session the ledger recorded. These cases are pure: a map
 * of rows and a map of reverse links, so the rule is pinned without the store —
 * and the same walk serves the demo adapter and a server.
 */
describe("attemptLineageOf", () => {
  /** Sessions by id, and "which session was moved FROM this one" for the fallback. */
  function storeOf(rows: LineageSession[], links: Record<string, string> = {}) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const successors = new Map(Object.entries(links));
    return {
      lookup: (id: string) => byId.get(id),
      successorOf: (id: string) => {
        const next = successors.get(id);
        return next ? byId.get(next) : undefined;
      },
    };
  }

  it("follows one hop to the replacement, and reports the entry it started from", () => {
    // A moved from B (cancelled, forward link kept) to C: the make-up is C.
    const a = { id: "ses_a", status: "cancelled" as const, rescheduledToId: "ses_b" };
    const b = { id: "ses_b", status: "scheduled" as const };
    const { lookup, successorOf } = storeOf([a, b]);

    expect(attemptLineageOf("ses_a", lookup, successorOf)).toEqual({
      entrySessionId: "ses_a",
      effectiveSessionId: "ses_b",
      effectiveStatus: "scheduled",
      moves: 1,
      resolvable: true,
      chain: ["ses_a", "ses_b"],
    });
  });

  it("follows two hops, so the last move is what the obligation stands on", () => {
    const { lookup, successorOf } = storeOf([
      { id: "ses_a", status: "cancelled", rescheduledToId: "ses_b" },
      { id: "ses_b", status: "cancelled", rescheduledToId: "ses_c" },
      { id: "ses_c", status: "scheduled" },
    ]);

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.moves).toBe(2);
    expect(lineage.effectiveSessionId).toBe("ses_c");
    expect(lineage.effectiveStatus).toBe("scheduled");
    expect(lineage.chain).toEqual(["ses_a", "ses_b", "ses_c"]);
  });

  it("reports a cancelled END of the chain as cancelled, not as a lost booking", () => {
    const { lookup, successorOf } = storeOf([
      { id: "ses_a", status: "cancelled", rescheduledToId: "ses_b" },
      { id: "ses_b", status: "cancelled" },
    ]);

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.effectiveSessionId).toBe("ses_b");
    expect(lineage.effectiveStatus).toBe("cancelled");
    // Resolvable — there IS a row — but not live. The distinction is what lets a
    // cancelled chain return the obligation to `required` without calling the
    // data broken.
    expect(lineage.resolvable).toBe(true);
    expect(attemptIsLive({ attempts: [attempt("ses_a")] }, { status: lineage.effectiveStatus })).toBe(
      false,
    );
  });

  it("follows the move out of a cancelled entry, because a move cancels the row it moved", () => {
    // The trap this whole rule exists for: `rescheduleSession` cancels the
    // moved-from row, so the entry is ALWAYS cancelled after a move.
    const { lookup, successorOf } = storeOf([
      { id: "ses_a", status: "cancelled", rescheduledToId: "ses_b" },
      { id: "ses_b", status: "scheduled" },
    ]);

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.effectiveStatus).toBe("scheduled");
    expect(attemptIsLive({ attempts: [attempt("ses_a")] }, { status: lineage.effectiveStatus })).toBe(
      true,
    );
  });

  it("recovers the continuation of a DELETED entry through the reverse link", () => {
    // A cancelled row with no attendance is deletable, taking its forward link
    // with it; the replacement still carries `rescheduledFromId` (= ses_a).
    const { lookup, successorOf } = storeOf(
      [{ id: "ses_b", status: "scheduled" }],
      { ses_a: "ses_b" },
    );

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.effectiveSessionId).toBe("ses_b");
    expect(lineage.effectiveStatus).toBe("scheduled");
    expect(lineage.moves).toBe(1);
    expect(lineage.resolvable).toBe(true);
    expect(lineage.chain).toEqual(["ses_a", "ses_b"]);
  });

  it("does not invent a continuation when the entry is missing and nothing was moved from it", () => {
    const { lookup, successorOf } = storeOf([{ id: "ses_other", status: "scheduled" }]);

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.effectiveSessionId).toBe("ses_a");
    expect(lineage.effectiveStatus).toBe("missing");
    expect(lineage.resolvable).toBe(false);
    expect(lineage.moves).toBe(0);
    expect(lineage.chain).toEqual(["ses_a"]);
  });

  it("refuses to walk a cycle, keeping the last accepted row and saying so", () => {
    const { lookup, successorOf } = storeOf([
      { id: "ses_a", status: "cancelled", rescheduledToId: "ses_b" },
      { id: "ses_b", status: "scheduled", rescheduledToId: "ses_a" },
    ]);

    const lineage = attemptLineageOf("ses_a", lookup, successorOf);
    expect(lineage.resolvable).toBe(false);
    expect(lineage.effectiveStatus).toBe("missing");
    // The last ACCEPTED row is the effective id: `ses_b`, the row that pointed
    // back at the entry.
    expect(lineage.effectiveSessionId).toBe("ses_b");
    expect(lineage.chain).toEqual(["ses_a", "ses_b"]);
  });

  it("stops at the hop cap and reports the chain as unresolvable", () => {
    // A chain longer than any real schedule: the walk terminates on it instead of
    // spinning, and it does not pretend to know where the make-up ended up.
    const rows: LineageSession[] = Array.from({ length: ATTEMPT_LINEAGE_MAX_MOVES + 2 }, (_, i) => ({
      id: `ses_${i}`,
      status: "cancelled" as const,
      rescheduledToId: `ses_${i + 1}`,
    }));
    rows.push({ id: `ses_${rows.length}`, status: "scheduled" });
    const { lookup, successorOf } = storeOf(rows);

    const lineage = attemptLineageOf("ses_0", lookup, successorOf);
    expect(lineage.resolvable).toBe(false);
    expect(lineage.effectiveStatus).toBe("missing");
    expect(lineage.moves).toBe(ATTEMPT_LINEAGE_MAX_MOVES);
    expect(lineage.chain).toHaveLength(ATTEMPT_LINEAGE_MAX_MOVES + 1);

    // The cap is a limit on nonsense, not a silent behaviour change: a chain that
    // fits inside it still resolves to the real row.
    const short = storeOf([
      { id: "ses_0", status: "cancelled", rescheduledToId: "ses_1" },
      { id: "ses_1", status: "cancelled", rescheduledToId: "ses_2" },
      { id: "ses_2", status: "cancelled", rescheduledToId: "ses_3" },
      { id: "ses_3", status: "scheduled" },
    ]);
    const resolved = attemptLineageOf("ses_0", short.lookup, short.successorOf, 3);
    expect(resolved.moves).toBe(3);
    expect(resolved.resolvable).toBe(true);
    expect(resolved.effectiveSessionId).toBe("ses_3");
    // One hop past the cap is refused, which is the boundary itself.
    expect(attemptLineageOf("ses_0", short.lookup, short.successorOf, 2).resolvable).toBe(false);
  });
});

/**
 * The named predicate C-1's refusal is built on. It is pinned separately BECAUSE
 * two rules depend on it — the derived `scheduled` state and `schedule`'s refusal
 * of a second booking — and they must never disagree about what "live" means.
 */
describe("attemptIsLive", () => {
  it("is false with no attempt at all, and for a cancelled or deleted one", () => {
    expect(attemptIsLive(record(), undefined)).toBe(false);
    expect(attemptIsLive(record({ attempts: [attempt("ses_makeup")] }), { status: "cancelled" })).toBe(
      false,
    );
    expect(attemptIsLive(record({ attempts: [attempt("ses_makeup")] }), undefined)).toBe(false);
  });

  it("is true while the newest attempt's session stands", () => {
    expect(attemptIsLive(record({ attempts: [attempt("ses_makeup")] }), { status: "scheduled" })).toBe(
      true,
    );
    // Only the NEWEST line decides: an older attempt's session is history.
    expect(
      attemptIsLive(record({ attempts: [attempt("ses_first"), attempt("ses_second")] }), {
        status: "scheduled",
      }),
    ).toBe(true);
  });

  it("keeps the derived status and the booking refusal on one definition of live", () => {
    const attempts = [attempt("ses_makeup")];
    for (const status of ["scheduled", "completed", "cancelled"] as const) {
      const derived = compensationStatusOf(record({ attempts }), { status }).status;
      const live = attemptIsLive(record({ attempts }), { status });
      // `scheduled` is exactly the live case, so `schedule` can never refuse an
      // attempt the read model calls live, nor book one it calls broken.
      if (derived !== "completed") expect(derived === "scheduled").toBe(live);
    }
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
