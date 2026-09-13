/**
 * Bounded session generation.
 *
 * The protection rules are the point of this module. A regression here does
 * not throw — it silently rewrites a session that already has attendance
 * against it, which is unrecoverable and invisible. Each protection therefore
 * has its own explicit test.
 */
import { describe, expect, it } from "vitest";
import {
  deterministicSessionId,
  exceedsSessionCap,
  isGeneratedIdFor,
  isNoopPlan,
  planGeneration,
  summarizePlan,
  validateWindow,
  type PlanContext,
  type RecurrenceSource,
} from "../generation";
import { MAX_GENERATION_DAYS, type Session } from "../types";

/** 2026-09-12 is a Saturday, so weekday indices are easy to reason about. */
const TODAY = "2026-09-15"; // Tuesday, index 3

/** Tuesday(3) and Thursday(5) at 17:00 for 90 minutes. */
function klass(over: Partial<RecurrenceSource> = {}): RecurrenceSource {
  return {
    id: "cl1",
    status: "active",
    days: [3, 5],
    time: "17:00",
    duration: 90,
    teacherId: "t1",
    roomId: "r1",
    ...over,
  };
}

function session(over: Partial<Session> = {}): Session {
  return {
    id: "ses_x",
    classId: "cl1",
    date: TODAY,
    startTime: "17:00",
    endTime: "18:30",
    teacherId: "t1",
    roomId: "r1",
    status: "scheduled",
    origin: "generated",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function ctx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    existing: [],
    sessionIdsWithAttendance: new Set<string>(),
    today: TODAY,
    ...over,
  };
}

const plan = (from: string, to: string, k = klass(), c = ctx()) =>
  planGeneration({ classId: k.id, from, to }, k, c);

describe("deterministic ids", () => {
  it("derives the id from class, date and time", () => {
    expect(deterministicSessionId("cl1", "2026-09-15", "17:00")).toBe("ses_cl1_20260915_1700");
  });

  it("is stable across calls — the basis of idempotency", () => {
    const a = deterministicSessionId("cl1", "2026-09-15", "17:00");
    const b = deterministicSessionId("cl1", "2026-09-15", "17:00");
    expect(a).toBe(b);
  });

  it("differs per class, date and time", () => {
    const ids = new Set([
      deterministicSessionId("cl1", "2026-09-15", "17:00"),
      deterministicSessionId("cl2", "2026-09-15", "17:00"),
      deterministicSessionId("cl1", "2026-09-16", "17:00"),
      deterministicSessionId("cl1", "2026-09-15", "18:00"),
    ]);
    expect(ids.size).toBe(4);
  });

  it("recognises its own class prefix, and not a manual id", () => {
    expect(isGeneratedIdFor("cl1", "ses_cl1_20260915_1700")).toBe(true);
    expect(isGeneratedIdFor("cl1", "ses_m_abc123")).toBe(false);
    expect(isGeneratedIdFor("cl1", "ses_cl2_20260915_1700")).toBe(false);
  });
});

describe("window validation", () => {
  it("accepts a sane range", () => {
    expect(validateWindow("2026-09-01", "2026-09-29").ok).toBe(true);
  });

  it("accepts a single day", () => {
    expect(validateWindow("2026-09-15", "2026-09-15").ok).toBe(true);
  });

  it("rejects an inverted range", () => {
    expect(validateWindow("2026-09-29", "2026-09-01").ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(validateWindow("nope", "2026-09-01").ok).toBe(false);
    expect(validateWindow("2026-02-30", "2026-03-01").ok).toBe(false);
  });

  it("rejects a window over the day cap rather than truncating it", () => {
    // Silent truncation would look like success and leave an invisible gap.
    const result = validateWindow("2026-01-01", "2026-12-31");
    expect(result.ok).toBe(false);
    expect(result.message).toContain(String(MAX_GENERATION_DAYS));
  });

  it("accepts exactly the cap", () => {
    // from + 179 days = 180 inclusive.
    expect(validateWindow("2026-01-01", "2026-06-29").ok).toBe(true);
  });

  it("surfaces an invalid window as a hard conflict in the plan", () => {
    const result = plan("2026-09-29", "2026-09-01");
    expect(result.conflicts.ok).toBe(false);
    expect(result.creates).toEqual([]);
  });
});

describe("slot computation", () => {
  it("creates a session on each recurrence day in range", () => {
    // 2026-09-15 Tue(3), 17 Thu(5), 22 Tue, 24 Thu
    const result = plan("2026-09-15", "2026-09-25");
    expect(result.creates.map((c) => c.date)).toEqual([
      "2026-09-15",
      "2026-09-17",
      "2026-09-22",
      "2026-09-24",
    ]);
  });

  it("derives the end time from the class duration", () => {
    const result = plan("2026-09-15", "2026-09-15");
    expect(result.creates[0]).toMatchObject({ startTime: "17:00", endTime: "18:30" });
  });

  it("snapshots the class teacher and room onto each slot", () => {
    const result = plan("2026-09-15", "2026-09-15");
    expect(result.creates[0]).toMatchObject({ teacherId: "t1", roomId: "r1" });
  });

  it("produces nothing when the class has no recurrence days", () => {
    expect(plan("2026-09-15", "2026-09-30", klass({ days: [] })).creates).toEqual([]);
  });

  it("produces nothing when no recurrence day falls in the window", () => {
    // 2026-09-19 Sat(0) to 2026-09-21 Mon(2) — no Tue/Thu.
    expect(plan("2026-09-19", "2026-09-21").creates).toEqual([]);
  });

  it("refuses an archived class", () => {
    const result = plan("2026-09-15", "2026-09-30", klass({ status: "archived" }));
    expect(result.conflicts.ok).toBe(false);
    expect(result.creates).toEqual([]);
  });

  it("refuses a class whose duration would cross midnight", () => {
    const result = plan("2026-09-15", "2026-09-15", klass({ time: "23:30", duration: 90 }));
    expect(result.conflicts.ok).toBe(false);
  });

  it("refuses a malformed class time", () => {
    expect(plan("2026-09-15", "2026-09-15", klass({ time: "5pm" })).conflicts.ok).toBe(false);
  });
});

describe("idempotency", () => {
  it("plans zero creates when every slot already exists", () => {
    const first = plan("2026-09-15", "2026-09-25");
    const existing = first.creates.map((slot) => session({ ...slot }));

    const second = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing }));
    expect(second.creates).toEqual([]);
    expect(second.updates).toEqual([]);
    expect(second.skips.every((s) => s.reason === "SKIP_UNCHANGED")).toBe(true);
    expect(isNoopPlan(second)).toBe(true);
  });

  it("re-running produces an identical plan", () => {
    const existing = plan("2026-09-15", "2026-09-25").creates.map((slot) => session({ ...slot }));
    const a = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing }));
    const b = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("creates only the genuinely missing slot", () => {
    const all = plan("2026-09-15", "2026-09-25").creates;
    const existing = all.slice(0, 3).map((slot) => session({ ...slot }));

    const result = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing }));
    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].date).toBe("2026-09-24");
  });
});

describe("protection: sessions that must never be rewritten", () => {
  /** An existing slot that differs from the class, so it WOULD be updated. */
  function divergent(over: Partial<Session> = {}): Session {
    return session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
      startTime: "17:00",
      endTime: "18:30",
      roomId: "r9", // differs from class r1
      ...over,
    });
  }

  it("never touches a session with attendance recorded", () => {
    const target = divergent();
    const result = plan(
      "2026-09-15",
      "2026-09-25",
      klass(),
      ctx({ existing: [target], sessionIdsWithAttendance: new Set([target.id]) }),
    );

    expect(result.updates).toEqual([]);
    expect(result.skips.find((s) => s.id === target.id)?.reason).toBe("SKIP_PROTECTED");
  });

  it("never touches a past session", () => {
    const target = divergent({
      id: deterministicSessionId("cl1", "2026-09-10", "17:00"),
      date: "2026-09-10", // Thursday, before TODAY
    });
    const result = plan("2026-09-08", "2026-09-25", klass(), ctx({ existing: [target] }));

    expect(result.updates).toEqual([]);
    expect(result.skips.find((s) => s.id === target.id)?.reason).toBe("SKIP_PAST");
  });

  it("never resurrects a cancelled session", () => {
    const target = divergent({ status: "cancelled" });
    const result = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing: [target] }));

    expect(result.creates.find((c) => c.id === target.id)).toBeUndefined();
    expect(result.updates).toEqual([]);
    expect(result.skips.find((s) => s.id === target.id)?.reason).toBe("SKIP_CANCELLED");
  });

  it("never overwrites a manual override", () => {
    const target = divergent({ origin: "manual" });
    const result = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing: [target] }));

    expect(result.updates).toEqual([]);
    expect(result.skips.find((s) => s.id === target.id)?.reason).toBe("SKIP_MANUAL");
  });

  it("reports cancelled ahead of protected when both apply", () => {
    // The operator's most important fact is that nothing will change.
    const target = divergent({ status: "cancelled" });
    const result = plan(
      "2026-09-15",
      "2026-09-25",
      klass(),
      ctx({ existing: [target], sessionIdsWithAttendance: new Set([target.id]) }),
    );
    expect(result.skips.find((s) => s.id === target.id)?.reason).toBe("SKIP_CANCELLED");
    expect(result.updates).toEqual([]);
  });

  it("protects a past session even when it also has attendance", () => {
    const target = divergent({
      id: deterministicSessionId("cl1", "2026-09-10", "17:00"),
      date: "2026-09-10",
    });
    const result = plan(
      "2026-09-08",
      "2026-09-25",
      klass(),
      ctx({ existing: [target], sessionIdsWithAttendance: new Set([target.id]) }),
    );
    expect(result.updates).toEqual([]);
  });
});

describe("changed recurrence", () => {
  it("offers a future unprotected divergence as an update, never automatic", () => {
    const target = session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
      roomId: "r9",
    });
    // Window narrowed to the single divergent day, so `creates` is empty and
    // the no-op assertion measures the update rule alone.
    const result = plan("2026-09-17", "2026-09-17", klass(), ctx({ existing: [target] }));

    expect(result.creates).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      sessionId: target.id,
      current: { roomId: "r9" },
      next: { roomId: "r1" },
    });
    // An update is never applied without explicit confirmation.
    expect(isNoopPlan(result, false)).toBe(true);
    expect(isNoopPlan(result, true)).toBe(false);
  });

  it("detects a teacher change as an update", () => {
    const target = session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
      teacherId: "t9",
    });
    const result = plan("2026-09-15", "2026-09-25", klass(), ctx({ existing: [target] }));
    expect(result.updates[0].next.teacherId).toBe("t1");
  });
});

describe("orphans", () => {
  it("surfaces a future session the new recurrence no longer produces", () => {
    // Class moved from 17:00 to 18:00; the old 17:00 slot is orphaned.
    const stale = session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
      startTime: "17:00",
      endTime: "18:30",
    });
    const result = plan("2026-09-15", "2026-09-25", klass({ time: "18:00" }), ctx({ existing: [stale] }));

    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]).toMatchObject({
      sessionId: stale.id,
      date: "2026-09-17",
      reason: "ORPHANED_RECURRENCE_CHANGED",
    });
    // Never deleted — only reported.
    expect(result.creates.some((c) => c.startTime === "18:00")).toBe(true);
  });

  it("does not orphan a past session", () => {
    const stale = session({
      id: deterministicSessionId("cl1", "2026-09-10", "17:00"),
      date: "2026-09-10",
    });
    const result = plan("2026-09-08", "2026-09-25", klass({ time: "18:00" }), ctx({ existing: [stale] }));
    expect(result.orphans).toEqual([]);
  });

  it("does not orphan an attendance-bearing session", () => {
    const stale = session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
    });
    const result = plan(
      "2026-09-15",
      "2026-09-25",
      klass({ time: "18:00" }),
      ctx({ existing: [stale], sessionIdsWithAttendance: new Set([stale.id]) }),
    );
    expect(result.orphans).toEqual([]);
  });

  it("does not orphan a manual session", () => {
    const manual = session({ id: "ses_m_custom", date: "2026-09-17", origin: "manual" });
    const result = plan("2026-09-15", "2026-09-25", klass({ time: "18:00" }), ctx({ existing: [manual] }));
    expect(result.orphans).toEqual([]);
  });

  it("does not orphan a cancelled session", () => {
    const cancelled = session({
      id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
      date: "2026-09-17",
      status: "cancelled",
    });
    const result = plan("2026-09-15", "2026-09-25", klass({ time: "18:00" }), ctx({ existing: [cancelled] }));
    expect(result.orphans).toEqual([]);
  });

  it("ignores sessions outside the requested window", () => {
    const outside = session({
      id: deterministicSessionId("cl1", "2026-10-20", "17:00"),
      date: "2026-10-20",
    });
    const result = plan("2026-09-15", "2026-09-25", klass({ time: "18:00" }), ctx({ existing: [outside] }));
    expect(result.orphans).toEqual([]);
  });
});

describe("conflicts across the plan", () => {
  it("detects a clash with another class's session", () => {
    const other = session({ id: "ses_cl2_20260915_1700", classId: "cl2", date: "2026-09-15", roomId: "r1" });
    const result = plan(
      "2026-09-15",
      "2026-09-15",
      klass(),
      ctx({ conflict: { otherSessions: [other] } }),
    );

    expect(result.conflicts.ok).toBe(false);
    expect(result.conflicts.hard.some((h) => h.kind === "SESSION_ROOM_CONFLICT")).toBe(true);
  });

  it("reports a clean plan as ok", () => {
    expect(plan("2026-09-15", "2026-09-25").conflicts.ok).toBe(true);
  });

  it("does not report a batch slot as conflicting with itself", () => {
    // Four slots for one class, same room and teacher, different days.
    const result = plan("2026-09-15", "2026-09-25");
    expect(result.creates).toHaveLength(4);
    expect(result.conflicts.ok).toBe(true);
  });
});

describe("summary and caps", () => {
  it("summarises counts per skip reason", () => {
    const existing = [
      session({ id: deterministicSessionId("cl1", "2026-09-15", "17:00"), date: "2026-09-15" }),
      session({
        id: deterministicSessionId("cl1", "2026-09-17", "17:00"),
        date: "2026-09-17",
        status: "cancelled",
      }),
    ];
    const summary = summarizePlan(plan("2026-09-15", "2026-09-25", klass(), ctx({ existing })));

    expect(summary.creates).toBe(2);
    expect(summary.skipped.SKIP_UNCHANGED).toBe(1);
    expect(summary.skipped.SKIP_CANCELLED).toBe(1);
  });

  it("flags a plan over the session cap", () => {
    /*
     * The day cap (180) and the session cap (500) are independent guards. A
     * daily class over the maximum window yields only 180 sessions, so the
     * session cap is reached by a class meeting several times a day — modelled
     * here by planning across many classes' worth of slots.
     */
    const daily = klass({ days: [0, 1, 2, 3, 4, 5, 6] });
    const result = plan("2026-01-01", "2026-06-29", daily);
    expect(result.creates).toHaveLength(180);
    // 180 < 500, so this legitimately does NOT exceed the session cap.
    expect(exceedsSessionCap(result)).toBe(false);

    // Synthesised plan just over the ceiling.
    const oversized = { ...result, creates: [...result.creates, ...Array.from({ length: 400 }, (_, i) => ({ ...result.creates[0], id: `pad_${i}` }))] };
    expect(exceedsSessionCap(oversized)).toBe(true);
  });

  it("does not flag a normal term", () => {
    expect(exceedsSessionCap(plan("2026-09-15", "2026-09-25"))).toBe(false);
  });
});

describe("purity", () => {
  it("does not mutate the inputs it is given", () => {
    const existing = [session({ id: deterministicSessionId("cl1", "2026-09-17", "17:00"), date: "2026-09-17", roomId: "r9" })];
    const snapshot = JSON.stringify(existing);
    const source = klass();
    const sourceSnapshot = JSON.stringify(source);

    plan("2026-09-15", "2026-09-25", source, ctx({ existing }));

    expect(JSON.stringify(existing)).toBe(snapshot);
    expect(JSON.stringify(source)).toBe(sourceSnapshot);
  });
});
