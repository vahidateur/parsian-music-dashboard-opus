/**
 * Conflict detection.
 *
 * These rules decide whether a booking is allowed, so the boundary cases carry
 * the weight: an off-by-one in the overlap test either blocks legitimate
 * back-to-back lessons or double-books a room.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  buildDateIndex,
  detectConflicts,
  emptyReport,
  mergeReports,
  overlaps,
  type ConflictContext,
} from "../conflicts";
import type { ConflictKind, Session, SessionCandidate } from "../types";

const DATE = "2026-09-15";

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
    startTime: "17:00",
    endTime: "18:00",
    teacherId: "t2",
    roomId: "r2",
    ...over,
  };
}

function ctx(sessions: Session[], extra: Partial<ConflictContext> = {}): ConflictContext {
  return { index: buildDateIndex(sessions), ...extra };
}

const kinds = (items: { kind: ConflictKind }[]) => items.map((i) => i.kind);

describe("overlap primitive", () => {
  it("treats intervals as half-open", () => {
    // 17:00-18:00 vs 18:00-19:00 — back-to-back, NOT a conflict.
    expect(overlaps(1020, 1080, 1080, 1140)).toBe(false);
    // ...and the reverse order.
    expect(overlaps(1080, 1140, 1020, 1080)).toBe(false);
  });

  it("detects a one-minute intrusion", () => {
    expect(overlaps(1020, 1081, 1080, 1140)).toBe(true);
  });

  it("detects containment and identity", () => {
    expect(overlaps(1020, 1140, 1050, 1080)).toBe(true); // b inside a
    expect(overlaps(1050, 1080, 1020, 1140)).toBe(true); // a inside b
    expect(overlaps(1020, 1080, 1020, 1080)).toBe(true); // identical
  });
});

describe("THE boundary case: 17:00-18:00 + 18:00-19:00", () => {
  it("reports NO conflict for back-to-back sessions in the same room", () => {
    const existing = session({ startTime: "17:00", endTime: "18:00", roomId: "r1", teacherId: "t1" });
    const next = candidate({ startTime: "18:00", endTime: "19:00", roomId: "r1", teacherId: "t1" });

    const report = detectConflicts(next, ctx([existing]));
    expect(report.hard).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("reports a conflict when they overlap by one minute", () => {
    const existing = session({ startTime: "17:00", endTime: "18:01", roomId: "r1" });
    const next = candidate({ startTime: "18:00", endTime: "19:00", roomId: "r1" });

    expect(kinds(detectConflicts(next, ctx([existing])).hard)).toContain("SESSION_ROOM_CONFLICT");
  });
});

describe("hard: invalid time range", () => {
  it("rejects an end before the start", () => {
    const report = detectConflicts(candidate({ startTime: "18:00", endTime: "17:00" }), ctx([]));
    expect(kinds(report.hard)).toContain("SESSION_INVALID_TIME_RANGE");
    expect(report.ok).toBe(false);
  });

  it("rejects a zero-length session", () => {
    const report = detectConflicts(candidate({ startTime: "17:00", endTime: "17:00" }), ctx([]));
    expect(kinds(report.hard)).toContain("SESSION_INVALID_TIME_RANGE");
  });

  it("rejects a malformed time without crashing", () => {
    const report = detectConflicts(candidate({ startTime: "nope", endTime: "18:00" }), ctx([]));
    expect(kinds(report.hard)).toContain("SESSION_INVALID_TIME_RANGE");
  });

  it("stops before overlap rules, so no NaN comparison happens", () => {
    const existing = session({ roomId: "r1" });
    const report = detectConflicts(candidate({ startTime: "18:00", endTime: "17:00", roomId: "r1" }), ctx([existing]));
    // Only the range error — not a spurious room clash from NaN maths.
    expect(report.hard).toHaveLength(1);
  });
});

describe("hard: invalid duration", () => {
  it("rejects a session shorter than the minimum", () => {
    const report = detectConflicts(candidate({ startTime: "17:00", endTime: "17:10" }), ctx([]));
    expect(kinds(report.hard)).toContain("SESSION_INVALID_DURATION");
    expect(MIN_SESSION_MINUTES).toBe(15);
  });

  it("rejects an implausibly long session (an end-time typo)", () => {
    const report = detectConflicts(candidate({ startTime: "08:00", endTime: "23:00" }), ctx([]));
    expect(kinds(report.hard)).toContain("SESSION_INVALID_DURATION");
    expect(MAX_SESSION_MINUTES).toBe(480);
  });

  it("accepts the boundary values exactly", () => {
    expect(kinds(detectConflicts(candidate({ startTime: "17:00", endTime: "17:15" }), ctx([])).hard)).not.toContain(
      "SESSION_INVALID_DURATION",
    );
    expect(kinds(detectConflicts(candidate({ startTime: "09:00", endTime: "17:00" }), ctx([])).hard)).not.toContain(
      "SESSION_INVALID_DURATION",
    );
  });
});

describe("hard: room double-booking", () => {
  it("detects an overlapping booking of the same room", () => {
    const existing = session({ roomId: "r1", teacherId: "t1" });
    const report = detectConflicts(candidate({ roomId: "r1", teacherId: "t9" }), ctx([existing]));

    expect(kinds(report.hard)).toContain("SESSION_ROOM_CONFLICT");
    expect(report.hard[0].conflictingSessionId).toBe("ses_a");
  });

  it("allows the same room on a different date", () => {
    const existing = session({ date: "2026-09-16", roomId: "r1" });
    expect(detectConflicts(candidate({ roomId: "r1" }), ctx([existing])).ok).toBe(true);
  });

  it("allows a different room at the same time", () => {
    const existing = session({ roomId: "r1" });
    expect(detectConflicts(candidate({ roomId: "r2", teacherId: "t9" }), ctx([existing])).ok).toBe(true);
  });
});

describe("hard: teacher double-booking", () => {
  it("detects the same teacher in two rooms at once", () => {
    const existing = session({ teacherId: "t1", roomId: "r1" });
    const report = detectConflicts(candidate({ teacherId: "t1", roomId: "r2" }), ctx([existing]));

    expect(kinds(report.hard)).toContain("SESSION_TEACHER_CONFLICT");
  });

  it("reports BOTH room and teacher when both clash", () => {
    const existing = session({ teacherId: "t1", roomId: "r1" });
    const report = detectConflicts(candidate({ teacherId: "t1", roomId: "r1" }), ctx([existing]));

    expect(kinds(report.hard)).toContain("SESSION_ROOM_CONFLICT");
    expect(kinds(report.hard)).toContain("SESSION_TEACHER_CONFLICT");
  });
});

describe("hard: archived class", () => {
  it("refuses a session for an archived class", () => {
    const report = detectConflicts(candidate(), ctx([], { classInfo: { id: "cl2", status: "archived" } }));
    expect(kinds(report.hard)).toContain("SESSION_CLASS_ARCHIVED");
  });

  it("allows an active class", () => {
    const report = detectConflicts(candidate(), ctx([], { classInfo: { id: "cl2", status: "active" } }));
    expect(report.ok).toBe(true);
  });
});

describe("cancelled sessions are invisible", () => {
  it("frees the room", () => {
    const cancelled = session({ status: "cancelled", roomId: "r1" });
    expect(detectConflicts(candidate({ roomId: "r1" }), ctx([cancelled])).ok).toBe(true);
  });

  it("frees the teacher", () => {
    const cancelled = session({ status: "cancelled", teacherId: "t1" });
    expect(detectConflicts(candidate({ teacherId: "t1" }), ctx([cancelled])).ok).toBe(true);
  });

  it("is excluded from the index entirely", () => {
    const index = buildDateIndex([session({ status: "cancelled" }), session({ id: "ses_b" })]);
    expect(index.get(DATE)).toHaveLength(1);
  });
});

describe("editing an existing session", () => {
  it("does not conflict with itself", () => {
    const existing = session({ id: "ses_a", roomId: "r1", teacherId: "t1" });
    const edit = candidate({ id: "ses_a", roomId: "r1", teacherId: "t1", classId: "cl1" });

    expect(detectConflicts(edit, ctx([existing])).ok).toBe(true);
  });

  it("still conflicts with a different session", () => {
    const mine = session({ id: "ses_a", roomId: "r1" });
    const other = session({ id: "ses_b", roomId: "r1", teacherId: "t9" });
    const edit = candidate({ id: "ses_a", roomId: "r1", teacherId: "t1" });

    expect(kinds(detectConflicts(edit, ctx([mine, other])).hard)).toContain("SESSION_ROOM_CONFLICT");
  });
});

describe("warning: student overlap", () => {
  const students = new Map([
    ["cl1", ["st1", "st2", "st3"]],
    ["cl2", ["st3", "st4"]],
  ]);

  it("warns without blocking when a student is in both classes", () => {
    const existing = session({ classId: "cl1", roomId: "r1", teacherId: "t1" });
    const report = detectConflicts(
      candidate({ classId: "cl2", roomId: "r2", teacherId: "t2" }),
      ctx([existing], { studentsByClassId: students }),
    );

    expect(kinds(report.warnings)).toContain("SESSION_STUDENT_OVERLAP");
    expect(report.warnings[0].studentIds).toEqual(["st3"]);
    // A warning must never block.
    expect(report.ok).toBe(true);
    expect(report.hard).toEqual([]);
  });

  it("does not warn when no student is shared", () => {
    const noShare = new Map([
      ["cl1", ["st1"]],
      ["cl2", ["st4"]],
    ]);
    const existing = session({ classId: "cl1", roomId: "r1", teacherId: "t1" });
    const report = detectConflicts(
      candidate({ classId: "cl2", roomId: "r2", teacherId: "t2" }),
      ctx([existing], { studentsByClassId: noShare }),
    );
    expect(report.warnings).toEqual([]);
  });

  it("skips the rule when roster data is not supplied", () => {
    const existing = session({ classId: "cl1", roomId: "r1", teacherId: "t1" });
    const report = detectConflicts(candidate({ classId: "cl2", roomId: "r2", teacherId: "t2" }), ctx([existing]));
    expect(report.warnings).toEqual([]);
  });

  it("does not warn about a class overlapping itself", () => {
    const existing = session({ classId: "cl1", roomId: "r1", teacherId: "t1" });
    const report = detectConflicts(
      candidate({ classId: "cl1", roomId: "r2", teacherId: "t2" }),
      ctx([existing], { studentsByClassId: students }),
    );
    expect(kinds(report.warnings)).not.toContain("SESSION_STUDENT_OVERLAP");
  });
});

describe("warning: inactive resources", () => {
  it("warns for an inactive room", () => {
    const report = detectConflicts(candidate(), ctx([], { roomActive: false }));
    expect(kinds(report.warnings)).toContain("SESSION_RESOURCE_INACTIVE");
    expect(report.ok).toBe(true);
  });

  it("warns once when both room and teacher are inactive", () => {
    const report = detectConflicts(candidate(), ctx([], { roomActive: false, teacherActive: false }));
    expect(report.warnings.filter((w) => w.kind === "SESSION_RESOURCE_INACTIVE")).toHaveLength(1);
    expect(report.warnings[0].message).toContain("اتاق و مدرس");
  });

  it("does not warn when the flags are absent", () => {
    expect(detectConflicts(candidate(), ctx([])).warnings).toEqual([]);
  });
});

describe("warning: off-schedule date", () => {
  it("warns for a make-up session outside the class days", () => {
    const report = detectConflicts(
      candidate(),
      ctx([], { classInfo: { id: "cl2", days: [0, 2] }, weekday: 3 }),
    );
    expect(kinds(report.warnings)).toContain("SESSION_OFF_SCHEDULE");
    expect(report.ok).toBe(true);
  });

  it("stays silent on a normal class day", () => {
    const report = detectConflicts(
      candidate(),
      ctx([], { classInfo: { id: "cl2", days: [0, 3] }, weekday: 3 }),
    );
    expect(kinds(report.warnings)).not.toContain("SESSION_OFF_SCHEDULE");
  });
});

describe("index behaviour", () => {
  it("only inspects the candidate's own date bucket", () => {
    // 400 sessions across 100 dates; the candidate's date holds 4.
    const many: Session[] = [];
    for (let d = 0; d < 100; d += 1) {
      const date = `2026-10-${String((d % 28) + 1).padStart(2, "0")}`;
      for (let k = 0; k < 4; k += 1) {
        many.push(session({ id: `s_${d}_${k}`, date, roomId: `r${k}`, teacherId: `t${k}` }));
      }
    }
    const index = buildDateIndex(many);
    expect(index.size).toBe(28);

    const report = detectConflicts(
      candidate({ date: "2026-10-05", roomId: "r0", teacherId: "t0" }),
      { index },
    );
    // Finds the clash on that day only.
    expect(kinds(report.hard)).toContain("SESSION_ROOM_CONFLICT");
  });

  it("handles an empty index", () => {
    expect(detectConflicts(candidate(), ctx([])).ok).toBe(true);
  });

  it("skips a malformed stored row instead of crashing", () => {
    const broken = session({ id: "ses_bad", startTime: "oops", endTime: "??" });
    const good = session({ id: "ses_ok", roomId: "r1" });
    const report = detectConflicts(candidate({ roomId: "r1" }), ctx([broken, good]));

    expect(kinds(report.hard)).toContain("SESSION_ROOM_CONFLICT");
    expect(report.hard).toHaveLength(1);
  });
});

describe("report helpers", () => {
  it("emptyReport passes", () => {
    expect(emptyReport()).toEqual({ hard: [], warnings: [], ok: true });
  });

  it("merges and de-duplicates", () => {
    const a = detectConflicts(candidate({ roomId: "r1" }), ctx([session({ roomId: "r1" })]));
    const merged = mergeReports([a, a]);
    expect(merged.hard).toHaveLength(a.hard.length);
    expect(merged.ok).toBe(false);
  });

  it("merging clean reports stays ok", () => {
    expect(mergeReports([emptyReport(), emptyReport()]).ok).toBe(true);
  });
});
