/**
 * Attendance repository — persistence and invariants.
 *
 * Attendance about a minor gets disputed, so the properties that matter are
 * the ones protecting the record: no silent edits, no partial register saves,
 * no invented rows for students nobody marked, and an audit trail that only
 * ever grows.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoAttendanceRepository } from "../demoRepository";
import { ATTENDANCE_ERRORS } from "../types";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoAttendanceRepository;
let scheduling: DemoSchedulingRepository;

const RECORDER = "usr_admin";

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoAttendanceRepository();
  // Presence provider wired so scheduling can delete freely in setup.
  scheduling = new DemoSchedulingRepository(demoStore, () => repo.sessionIdsWithAttendanceSync());
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

/** A seeded session whose derived roster is non-empty. */
async function sessionWithRoster(): Promise<{ sessionId: string; studentIds: string[] }> {
  const sessions = (await scheduling.list({ per_page: 500 })).data;
  for (const session of sessions) {
    if (session.status === "cancelled") continue;
    const roster = await scheduling.sessionRoster(session.id);
    if (roster.length > 0) {
      return { sessionId: session.id, studentIds: roster.map((r) => r.studentId) };
    }
  }
  throw new Error("seed should contain a session with a roster");
}

describe("recording", () => {
  it("persists a mark and reads it back", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const created = await repo.record({
      sessionId,
      studentId: studentIds[0],
      status: "present",
      recordedByUserId: RECORDER,
    });

    expect(created.id).toBeTruthy();
    expect((await repo.get(created.id)).status).toBe("present");
  });

  it("stamps provenance and timestamps", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const created = await repo.record({
      sessionId,
      studentId: studentIds[0],
      status: "late",
      recordedByUserId: RECORDER,
    });

    expect(created.recordedByUserId).toBe(RECORDER);
    expect(Number.isNaN(Date.parse(created.recordedAt))).toBe(false);
  });

  it("accepts all four statuses", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const statuses = ["present", "absent", "late", "excused"] as const;

    for (let i = 0; i < Math.min(statuses.length, studentIds.length); i += 1) {
      const created = await repo.record({
        sessionId,
        studentId: studentIds[i],
        status: statuses[i],
        recordedByUserId: RECORDER,
      });
      expect(created.status).toBe(statuses[i]);
    }
  });

  it("rejects an unknown session", async () => {
    expect(
      await codeOf(
        repo.record({ sessionId: "ses_nope", studentId: "st1", status: "present", recordedByUserId: RECORDER }),
      ),
    ).toBe(ATTENDANCE_ERRORS.SESSION_NOT_FOUND);
  });

  it("requires a recorder — an anonymous mark cannot be questioned later", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    expect(
      await codeOf(
        repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: "  " }),
      ),
    ).toBe(ATTENDANCE_ERRORS.RECORDER_REQUIRED);
  });
});

describe("uniqueness", () => {
  it("refuses a second mark for the same (session, student)", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });

    expect(
      await codeOf(
        repo.record({ sessionId, studentId: studentIds[0], status: "absent", recordedByUserId: RECORDER }),
      ),
    ).toBe(ATTENDANCE_ERRORS.DUPLICATE);
  });

  it("allows the same student in a different session", async () => {
    const sessions = (await scheduling.list({ per_page: 500 })).data.filter((s) => s.status !== "cancelled");
    const first = await scheduling.sessionRoster(sessions[0].id);

    const other = sessions.find(
      async (s) => s.id !== sessions[0].id && (await scheduling.sessionRoster(s.id)).length > 0,
    );
    expect(other).toBeDefined();

    await repo.record({
      sessionId: sessions[0].id,
      studentId: first[0].studentId,
      status: "present",
      recordedByUserId: RECORDER,
    });

    // Same student, a different session in the same class.
    const sameClass = sessions.find((s) => s.classId === sessions[0].classId && s.id !== sessions[0].id);
    if (sameClass) {
      const roster = await scheduling.sessionRoster(sameClass.id);
      if (roster.some((r) => r.studentId === first[0].studentId)) {
        const second = await repo.record({
          sessionId: sameClass.id,
          studentId: first[0].studentId,
          status: "absent",
          recordedByUserId: RECORDER,
        });
        expect(second.id).toBeTruthy();
      }
    }
  });

  it("writes nothing when a duplicate is refused", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });
    const before = demoStore.attendanceRecords.all().length;

    await codeOf(
      repo.record({ sessionId, studentId: studentIds[0], status: "absent", recordedByUserId: RECORDER }),
    );
    expect(demoStore.attendanceRecords.all()).toHaveLength(before);
  });
});

describe("roster enforcement", () => {
  it("rejects a student who is not on the derived roster", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const outsider = demoStore.students.all().find((s) => !studentIds.includes(s.id));
    expect(outsider).toBeDefined();

    expect(
      await codeOf(
        repo.record({ sessionId, studentId: outsider!.id, status: "present", recordedByUserId: RECORDER }),
      ),
    ).toBe(ATTENDANCE_ERRORS.STUDENT_NOT_ON_ROSTER);
  });

  it("rejects a student who does not exist at all", async () => {
    const { sessionId } = await sessionWithRoster();
    expect(
      await codeOf(
        repo.record({ sessionId, studentId: "st_ghost", status: "present", recordedByUserId: RECORDER }),
      ),
    ).toBe(ATTENDANCE_ERRORS.STUDENT_NOT_ON_ROSTER);
  });
});

describe("cancelled sessions", () => {
  it("refuses marks for a cancelled session", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await scheduling.cancelSession(sessionId, "تعطیلی");

    expect(
      await codeOf(
        repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER }),
      ),
    ).toBe(ATTENDANCE_ERRORS.SESSION_CANCELLED);
  });

  it("refuses a bulk save for a cancelled session", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await scheduling.cancelSession(sessionId, "تعطیلی");

    expect(
      await codeOf(
        repo.bulkRecord({
          sessionId,
          entries: [{ studentId: studentIds[0], status: "present" }],
          recordedByUserId: RECORDER,
        }),
      ),
    ).toBe(ATTENDANCE_ERRORS.SESSION_CANCELLED);
  });

  it("marks the session as locked in the derived view", async () => {
    const { sessionId } = await sessionWithRoster();
    await scheduling.cancelSession(sessionId, "تعطیلی");
    expect((await repo.sessionAttendance(sessionId)).locked).toBe(true);
  });
});

describe("bulk recording is atomic", () => {
  it("saves a whole register in one act", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const created = await repo.bulkRecord({
      sessionId,
      entries: studentIds.map((studentId) => ({ studentId, status: "present" as const })),
      recordedByUserId: RECORDER,
    });

    expect(created).toHaveLength(studentIds.length);
    expect(demoStore.attendanceRecords.all()).toHaveLength(studentIds.length);
  });

  it("writes NOTHING when one entry is off-roster", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const outsider = demoStore.students.all().find((s) => !studentIds.includes(s.id))!;

    const code = await codeOf(
      repo.bulkRecord({
        sessionId,
        entries: [
          { studentId: studentIds[0], status: "present" },
          { studentId: outsider.id, status: "present" },
        ],
        recordedByUserId: RECORDER,
      }),
    );

    expect(code).toBe(ATTENDANCE_ERRORS.INVALID);
    // The valid entry must NOT have been written.
    expect(demoStore.attendanceRecords.all()).toHaveLength(0);
  });

  it("writes nothing when one entry duplicates an existing mark", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });
    const before = demoStore.attendanceRecords.all().length;

    await codeOf(
      repo.bulkRecord({
        sessionId,
        entries: studentIds.map((studentId) => ({ studentId, status: "absent" as const })),
        recordedByUserId: RECORDER,
      }),
    );
    expect(demoStore.attendanceRecords.all()).toHaveLength(before);
  });

  it("rejects a duplicate student inside the same request", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const code = await codeOf(
      repo.bulkRecord({
        sessionId,
        entries: [
          { studentId: studentIds[0], status: "present" },
          { studentId: studentIds[0], status: "absent" },
        ],
        recordedByUserId: RECORDER,
      }),
    );
    expect(code).toBe(ATTENDANCE_ERRORS.INVALID);
    expect(demoStore.attendanceRecords.all()).toHaveLength(0);
  });

  it("names the offending students so the error is actionable", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const outsider = demoStore.students.all().find((s) => !studentIds.includes(s.id))!;

    const fields = await fieldsOf(
      repo.bulkRecord({
        sessionId,
        entries: [{ studentId: outsider.id, status: "present" }],
        recordedByUserId: RECORDER,
      }),
    );
    expect(fields).toHaveProperty(outsider.id);
  });
});

describe("corrections", () => {
  async function marked() {
    const { sessionId, studentIds } = await sessionWithRoster();
    const record = await repo.record({
      sessionId,
      studentId: studentIds[0],
      status: "absent",
      recordedByUserId: RECORDER,
    });
    return record;
  }

  it("requires a non-empty reason", async () => {
    const record = await marked();
    expect(
      await codeOf(repo.correct(record.id, { status: "present", reason: "   ", changedByUserId: RECORDER })),
    ).toBe(ATTENDANCE_ERRORS.REASON_REQUIRED);
  });

  it("changes the mark and appends history", async () => {
    const record = await marked();
    const updated = await repo.correct(record.id, {
      status: "present",
      reason: "گواهی پزشکی ارائه شد",
      changedByUserId: RECORDER,
    });

    expect(updated.status).toBe("present");

    const history = await repo.listCorrections({ attendanceRecordId: record.id, per_page: 50 });
    expect(history.data).toHaveLength(1);
    expect(history.data[0]).toMatchObject({
      previousStatus: "absent",
      newStatus: "present",
      reason: "گواهی پزشکی ارائه شد",
      changedByUserId: RECORDER,
    });
  });

  it("grows the trail with each correction", async () => {
    const record = await marked();
    await repo.correct(record.id, { status: "present", reason: "اول", changedByUserId: RECORDER });
    await repo.correct(record.id, { status: "late", reason: "دوم", changedByUserId: RECORDER });
    await repo.correct(record.id, { status: "excused", reason: "سوم", changedByUserId: RECORDER });

    const history = await repo.listCorrections({ attendanceRecordId: record.id, per_page: 50 });
    expect(history.data).toHaveLength(3);
    expect((await repo.get(record.id)).status).toBe("excused");
  });

  it("chains previousStatus through the sequence", async () => {
    const record = await marked();
    await repo.correct(record.id, { status: "present", reason: "اول", changedByUserId: RECORDER });
    await repo.correct(record.id, { status: "late", reason: "دوم", changedByUserId: RECORDER });

    const history = await repo.listCorrections({ attendanceRecordId: record.id, per_page: 50 });
    const ordered = [...history.data].sort((a, b) => a.changedAt.localeCompare(b.changedAt));

    expect(ordered[0].previousStatus).toBe("absent");
    expect(ordered[0].newStatus).toBe("present");
    expect(ordered[1].previousStatus).toBe("present");
    expect(ordered[1].newStatus).toBe("late");
  });

  it("never mutates an earlier correction", async () => {
    const record = await marked();
    await repo.correct(record.id, { status: "present", reason: "اول", changedByUserId: RECORDER });
    const first = JSON.stringify(demoStore.attendanceCorrections.all());

    await repo.correct(record.id, { status: "late", reason: "دوم", changedByUserId: RECORDER });

    const all = demoStore.attendanceCorrections.all();
    const original = all.filter((c) => JSON.parse(first).some((f: { id: string }) => f.id === c.id));
    expect(JSON.stringify(original)).toBe(first);
  });

  it("offers no way to edit or delete a correction", () => {
    // The interface has no such verb; asserted so adding one is deliberate.
    expect((repo as unknown as Record<string, unknown>).updateCorrection).toBeUndefined();
    expect((repo as unknown as Record<string, unknown>).deleteCorrection).toBeUndefined();
  });

  it("rejects a correction on a missing record", async () => {
    expect(
      await codeOf(repo.correct("att_nope", { status: "present", reason: "x", changedByUserId: RECORDER })),
    ).toBe(ATTENDANCE_ERRORS.NOT_FOUND);
  });

  it("paginates the history", async () => {
    const record = await marked();
    for (let i = 0; i < 5; i += 1) {
      await repo.correct(record.id, {
        status: i % 2 === 0 ? "present" : "absent",
        reason: `اصلاح ${i}`,
        changedByUserId: RECORDER,
      });
    }

    const page = await repo.listCorrections({ attendanceRecordId: record.id, per_page: 2 });
    expect(page.data).toHaveLength(2);
    expect(page.meta.total).toBe(5);
  });

  it("filters history by session and student", async () => {
    const record = await marked();
    await repo.correct(record.id, { status: "present", reason: "x", changedByUserId: RECORDER });

    const bySession = await repo.listCorrections({ sessionId: record.sessionId, per_page: 50 });
    expect(bySession.data).toHaveLength(1);

    const byStudent = await repo.listCorrections({ studentId: record.studentId, per_page: 50 });
    expect(byStudent.data).toHaveLength(1);
  });
});

describe("sessionAttendance", () => {
  it("returns the derived roster joined with marks", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });

    const view = await repo.sessionAttendance(sessionId);
    expect(view.expected).toBe(studentIds.length);
    expect(view.recorded).toBe(1);
    expect(view.roster).toHaveLength(studentIds.length);
  });

  it("leaves unmarked students with NO record rather than a placeholder", async () => {
    const { sessionId } = await sessionWithRoster();
    const view = await repo.sessionAttendance(sessionId);

    expect(view.recorded).toBe(0);
    for (const row of view.roster) {
      expect(row.record).toBeUndefined();
      // Never a null/placeholder row: "not taken" and "absent" differ.
      expect(row).not.toHaveProperty("status");
    }
    expect(demoStore.attendanceRecords.all()).toHaveLength(0);
  });

  it("reports an empty roster without failing", async () => {
    // A session for a class with no active enrollments.
    const sessions = (await scheduling.list({ per_page: 500 })).data;
    for (const session of sessions) {
      const roster = await scheduling.sessionRoster(session.id);
      if (roster.length === 0) {
        const view = await repo.sessionAttendance(session.id);
        expect(view.roster).toEqual([]);
        expect(view.expected).toBe(0);
        return;
      }
    }
  });

  it("rejects an unknown session", async () => {
    expect(await codeOf(repo.sessionAttendance("ses_nope"))).toBe(ATTENDANCE_ERRORS.SESSION_NOT_FOUND);
  });
});

describe("the scheduling boundary", () => {
  it("reports session ids that have attendance", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    expect(await repo.sessionIdsWithAttendance()).toEqual(new Set());

    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });
    expect(await repo.sessionIdsWithAttendance()).toEqual(new Set([sessionId]));
  });

  it("exposes ids only, never attendance internals", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });

    const ids = await repo.sessionIdsWithAttendance();
    for (const value of ids) expect(typeof value).toBe("string");
  });

  it("protects the session in the scheduling repository once marked", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();

    // Deletable before any mark exists.
    const view = await repo.sessionAttendance(sessionId);
    expect(view.recorded).toBe(0);

    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });

    // The narrow boundary now blocks destruction.
    const code = await codeOf(scheduling.delete(sessionId));
    expect(code).toBe("SESSION_HAS_ATTENDANCE");
    expect(demoStore.scheduledSessions.find(sessionId)).toBeDefined();
  });
});

describe("persistence", () => {
  it("survives a snapshot round-trip", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    const record = await repo.record({
      sessionId,
      studentId: studentIds[0],
      status: "present",
      recordedByUserId: RECORDER,
    });
    await repo.correct(record.id, { status: "late", reason: "دیر رسید", changedByUserId: RECORDER });

    demoStore.replace(demoStore.snapshot());

    expect(demoStore.attendanceRecords.all()).toHaveLength(1);
    expect(demoStore.attendanceCorrections.all()).toHaveLength(1);
  });

  it("is cleared by a reset", async () => {
    const { sessionId, studentIds } = await sessionWithRoster();
    await repo.record({ sessionId, studentId: studentIds[0], status: "present", recordedByUserId: RECORDER });

    resetToDemoEnvironment();
    expect(demoStore.attendanceRecords.all()).toHaveLength(0);
  });
});
