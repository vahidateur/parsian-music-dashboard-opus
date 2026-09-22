/**
 * THE ACADEMY'S OWN RULES, inside the scheduling engine.
 *
 * Settings → قواعد جلسه and ساعات کاری used to be four disabled inputs and a
 * notice. They are read now, and this file pins the two behaviours that make the
 * panel's copy true:
 *
 *   • a session written outside the bookable window, or with less than the
 *     configured turnaround before the next use of the same room or teacher, gets
 *     a WARNING — never a refusal. A concert that runs late and a teacher with ten
 *     minutes to cross the building are both legitimate; the rule exists so the
 *     operator is told, not so the schedule is policed.
 *   • generating sessions produces nothing on a day the academy is closed, and
 *     reports every date it skipped. Existing sessions on such a day are left
 *     alone: closing a weekday is a decision about the future, while a booked
 *     lesson is a commitment, and cancelling one is an auditable act of its own.
 *
 * And the negative case, which is the one that matters most: when no rule has been
 * configured, the engine evaluates nothing. A rule nobody set must never invent a
 * warning of its own.
 */
import { describe, expect, it } from "vitest";
import { buildDateIndex, detectConflicts, type ConflictContext } from "../conflicts";
import { planGeneration, type PlanContext, type RecurrenceSource } from "../generation";
import type { ConflictKind, Session, SessionCandidate } from "../types";

const DATE = "2026-09-15"; // Tuesday, weekday index 3 in the Saturday-first convention

function session(over: Partial<Session> = {}): Session {
  return {
    id: "ses_a",
    classId: "cl1",
    date: DATE,
    startTime: "17:00",
    endTime: "18:00",
    teacherId: "t1",
    roomId: "r1",
    status: "scheduled",
    origin: "generated",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function candidate(over: Partial<SessionCandidate> = {}): SessionCandidate {
  return {
    classId: "cl2",
    date: DATE,
    startTime: "19:00",
    endTime: "20:00",
    teacherId: "t2",
    roomId: "r2",
    ...over,
  };
}

function ctx(sessions: Session[], extra: Partial<ConflictContext> = {}): ConflictContext {
  return { index: buildDateIndex(sessions), ...extra };
}

const kinds = (items: { kind: ConflictKind }[]) => items.map((item) => item.kind);

/** The academy's shipped rules: 08:00–21:00, ten minutes of turnaround. */
const RULES = { gapMinutes: 10, workingHours: { start: 8 * 60, end: 21 * 60 } };

describe("the bookable window", () => {
  it("warns about a session that ends after closing time", () => {
    const report = detectConflicts(candidate({ startTime: "20:30", endTime: "21:30" }), ctx([], { rules: RULES }));
    expect(kinds(report.warnings)).toContain("SESSION_OUTSIDE_WORKING_HOURS");
    expect(report.warnings[0].message).toContain("08:00–21:00");
    // A warning is a question for the operator, never a refusal.
    expect(report.ok).toBe(true);
    expect(report.hard).toEqual([]);
  });

  it("warns about a session that starts before opening time", () => {
    const report = detectConflicts(candidate({ startTime: "07:00", endTime: "08:00" }), ctx([], { rules: RULES }));
    expect(kinds(report.warnings)).toContain("SESSION_OUTSIDE_WORKING_HOURS");
  });

  it("says nothing about a session inside the window", () => {
    const report = detectConflicts(candidate({ startTime: "09:00", endTime: "10:30" }), ctx([], { rules: RULES }));
    expect(kinds(report.warnings)).not.toContain("SESSION_OUTSIDE_WORKING_HOURS");
  });

  it("treats the window as inclusive at both ends", () => {
    for (const times of [
      { startTime: "08:00", endTime: "09:00" },
      { startTime: "20:00", endTime: "21:00" },
    ]) {
      expect(kinds(detectConflicts(candidate(times), ctx([], { rules: RULES })).warnings)).not.toContain(
        "SESSION_OUTSIDE_WORKING_HOURS",
      );
    }
  });

  it("evaluates nothing when no window has been configured", () => {
    const report = detectConflicts(candidate({ startTime: "03:00", endTime: "04:00" }), ctx([]));
    expect(kinds(report.warnings)).not.toContain("SESSION_OUTSIDE_WORKING_HOURS");
    expect(report.ok).toBe(true);
  });
});

describe("the turnaround rule", () => {
  it("warns when the same room is reused too fast", () => {
    // Existing 17:00–18:00 in r1; the candidate starts 18:05 in the same room.
    const report = detectConflicts(
      candidate({ roomId: "r1", startTime: "18:05", endTime: "19:05" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.warnings)).toContain("SESSION_TIGHT_TURNAROUND");
    expect(report.warnings[0].message).toContain("اتاق");
    expect(report.warnings[0].message).toContain("5 دقیقه");
    expect(report.warnings[0].conflictingSessionId).toBe("ses_a");
    expect(report.ok, "a tight turnaround is not a clash").toBe(true);
  });

  it("warns when the same teacher is reused too fast, and names the teacher", () => {
    const report = detectConflicts(
      candidate({ teacherId: "t1", startTime: "18:08", endTime: "19:08" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.warnings)).toContain("SESSION_TIGHT_TURNAROUND");
    expect(report.warnings[0].message).toContain("مدرس");
  });

  it("warns in both directions — before and after the existing session", () => {
    const report = detectConflicts(
      candidate({ roomId: "r1", startTime: "16:55", endTime: "16:58" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.warnings)).toContain("SESSION_TIGHT_TURNAROUND");
    expect(report.warnings[0].message).toContain("2 دقیقه");
  });

  it("says nothing once the configured gap is met", () => {
    const report = detectConflicts(
      candidate({ roomId: "r1", startTime: "18:10", endTime: "19:10" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
  });

  it("says nothing when neither the room nor the teacher is shared", () => {
    const report = detectConflicts(candidate({ startTime: "18:02", endTime: "19:02" }), ctx([session()], { rules: RULES }));
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
  });

  it("leaves a genuine overlap to the hard rules instead of double-reporting it", () => {
    const report = detectConflicts(
      candidate({ roomId: "r1", startTime: "17:30", endTime: "18:30" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.hard)).toContain("SESSION_ROOM_CONFLICT");
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
    expect(report.ok).toBe(false);
  });

  it("is off when the academy sets the gap to zero", () => {
    const report = detectConflicts(
      candidate({ roomId: "r1", startTime: "18:00", endTime: "19:00" }),
      ctx([session()], { rules: { gapMinutes: 0, workingHours: RULES.workingHours } }),
    );
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
  });

  it("never warns about itself when a session is edited in place", () => {
    const report = detectConflicts(
      candidate({ id: "ses_a", roomId: "r1", startTime: "17:00", endTime: "18:00" }),
      ctx([session()], { rules: RULES }),
    );
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
  });

  it("evaluates nothing when no gap has been configured", () => {
    const report = detectConflicts(candidate({ roomId: "r1", startTime: "18:01", endTime: "19:01" }), ctx([session()]));
    expect(kinds(report.warnings)).not.toContain("SESSION_TIGHT_TURNAROUND");
  });
});

/* ------------------------------------------------------------------ */
/* Closed weekdays, in generation                                       */
/* ------------------------------------------------------------------ */

const TODAY = "2026-09-15"; // Tuesday, index 3

function klass(over: Partial<RecurrenceSource> = {}): RecurrenceSource {
  return {
    id: "cl1",
    status: "active",
    days: [3, 5], // Tuesday and Thursday
    time: "17:00",
    duration: 90,
    teacherId: "t1",
    roomId: "r1",
    ...over,
  };
}

function planCtx(over: Partial<PlanContext> = {}): PlanContext {
  return { existing: [], sessionIdsWithAttendance: new Set<string>(), today: TODAY, ...over };
}

const plan = (from: string, to: string, k = klass(), c = planCtx()) =>
  planGeneration({ classId: k.id, from, to }, k, c);

describe("a day the academy is closed", () => {
  it("creates nothing on it, and reports every date it skipped", () => {
    const without = plan("2026-09-15", "2026-09-24");
    expect(without.creates.map((slot) => slot.date)).toEqual(["2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24"]);

    const closed = plan("2026-09-15", "2026-09-24", klass(), planCtx({ closedWeekdays: [5] }));
    expect(closed.creates.map((slot) => slot.date), "the Thursdays are gone").toEqual(["2026-09-15", "2026-09-22"]);
    expect(closed.skips.filter((skip) => skip.reason === "SKIP_CLOSED_DAY").map((skip) => skip.date)).toEqual([
      "2026-09-17",
      "2026-09-24",
    ]);
    expect(closed.conflicts.ok).toBe(true);
  });

  it("leaves an existing session on a newly closed day exactly where it is", () => {
    /*
      Closing a weekday stops NEW sessions. It does not orphan the ones already
      booked: those are cancelled deliberately, with a reason, which is an
      auditable act — not a side effect of a settings change.
    */
    const existing = session({ id: "ses_cl1_20260917_1700", date: "2026-09-17" });
    const closed = plan("2026-09-15", "2026-09-24", klass(), planCtx({ existing: [existing], closedWeekdays: [5] }));
    expect(closed.orphans).toEqual([]);
    expect(closed.updates).toEqual([]);
    expect(closed.skips.map((skip) => skip.reason)).toContain("SKIP_CLOSED_DAY");
  });

  it("generates normally when no day is closed", () => {
    const closed = plan("2026-09-15", "2026-09-24", klass(), planCtx({ closedWeekdays: [] }));
    expect(closed.creates).toHaveLength(4);
    expect(closed.skips.filter((skip) => skip.reason === "SKIP_CLOSED_DAY")).toEqual([]);
  });
});
