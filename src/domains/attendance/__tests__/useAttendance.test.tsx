// @vitest-environment jsdom
/**
 * Attendance hooks.
 *
 * The register view is the one screen where a stale or partially-loaded read
 * causes a real mistake — a student shown as unmarked gets marked twice, or a
 * correction appears not to have saved. These tests pin the consistency
 * guarantees rather than the plumbing.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAttendanceCorrections, useSessionAttendance } from "../useAttendance";
import {
  getAttendanceRepository,
  getSchedulingRepository,
  resetRegistry,
  setAttendanceRepository,
} from "@/domains/registry";
import type { SessionAttendance } from "../types";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const RECORDER = "usr_admin";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/** A seeded session whose derived roster is non-empty. */
async function markableSession(): Promise<{ sessionId: string; studentIds: string[] }> {
  const scheduling = getSchedulingRepository();
  for (const session of (await scheduling.list({ per_page: 500 })).data) {
    if (session.status === "cancelled") continue;
    const roster = await scheduling.sessionRoster(session.id);
    if (roster.length > 0) {
      return { sessionId: session.id, studentIds: roster.map((r) => r.studentId) };
    }
  }
  throw new Error("seed should contain a session with a roster");
}

describe("useSessionAttendance", () => {
  it("returns the derived roster joined with marks in one read", async () => {
    const { sessionId, studentIds } = await markableSession();

    const { result } = renderHook(() => useSessionAttendance(sessionId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.attendance?.expected).toBe(studentIds.length);
    expect(result.current.attendance?.roster).toHaveLength(studentIds.length);
    expect(result.current.attendance?.recorded).toBe(0);
  });

  it("shows unmarked students with no record, never a placeholder", async () => {
    const { sessionId } = await markableSession();

    const { result } = renderHook(() => useSessionAttendance(sessionId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (const row of result.current.attendance!.roster) {
      expect(row.record).toBeUndefined();
      expect(row).not.toHaveProperty("status");
    }
  });

  it("reflects a mark immediately, without the caller wiring a refresh", async () => {
    const { sessionId, studentIds } = await markableSession();

    const { result } = renderHook(() => useSessionAttendance(sessionId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attendance?.recorded).toBe(0);

    await getAttendanceRepository().record({
      sessionId,
      studentId: studentIds[0],
      status: "present",
      recordedByUserId: RECORDER,
    });

    // The global data version bump is what drives this.
    await waitFor(() => expect(result.current.attendance?.recorded).toBe(1));
    const marked = result.current.attendance!.roster.find((r) => r.student.studentId === studentIds[0]);
    expect(marked?.record?.status).toBe("present");
  });

  it("reflects a correction", async () => {
    const { sessionId, studentIds } = await markableSession();
    const record = await getAttendanceRepository().record({
      sessionId,
      studentId: studentIds[0],
      status: "absent",
      recordedByUserId: RECORDER,
    });

    const { result } = renderHook(() => useSessionAttendance(sessionId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await getAttendanceRepository().correct(record.id, {
      status: "present",
      reason: "گواهی پزشکی",
      changedByUserId: RECORDER,
    });

    await waitFor(() => {
      const row = result.current.attendance!.roster.find((r) => r.student.studentId === studentIds[0]);
      expect(row?.record?.status).toBe("present");
    });
  });

  it("reports a cancelled session as locked", async () => {
    const { sessionId } = await markableSession();
    await getSchedulingRepository().cancelSession(sessionId, "تعطیلی");

    const { result } = renderHook(() => useSessionAttendance(sessionId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attendance?.locked).toBe(true);
  });

  it("does not fetch when no session is selected", async () => {
    const { result } = renderHook(() => useSessionAttendance(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.attendance).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error for an unknown session", async () => {
    const { result } = renderHook(() => useSessionAttendance("ses_nope"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.attendance).toBeUndefined();
  });

  it("ignores a stale response when the session changes mid-flight", async () => {
    /*
     * The real hazard on a register screen: a teacher clicks session A, it is
     * slow, they click session B, which returns first — and then A's response
     * lands and silently repaints B's register with A's students. Marks would
     * then be taken against the wrong session.
     *
     * A fake repository makes the ordering deterministic rather than hoping
     * the real one happens to race the right way.
     */
    const view = (sessionId: string): SessionAttendance => ({
      sessionId,
      roster: [],
      recorded: 0,
      expected: 0,
      locked: false,
    });

    const SLOW = "ses_slow";
    const FAST = "ses_fast";

    const real = getAttendanceRepository();
    setAttendanceRepository({
      ...real,
      sessionAttendance: (id: string) =>
        new Promise<SessionAttendance>((resolve) =>
          setTimeout(() => resolve(view(id)), id === SLOW ? 60 : 0),
        ),
    } as unknown as ReturnType<typeof getAttendanceRepository>);

    const { result, rerender } = renderHook(({ id }: { id: string }) => useSessionAttendance(id), {
      initialProps: { id: SLOW },
    });

    // Switch before the slow request resolves.
    rerender({ id: FAST });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attendance?.sessionId).toBe(FAST);

    // Now let the slow response land. The ticket guard must discard it.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(result.current.attendance?.sessionId).toBe(FAST);
  });

  it("switches cleanly between sessions", async () => {
    const scheduling = getSchedulingRepository();
    const sessions = (await scheduling.list({ per_page: 500 })).data.filter(
      (s) => s.status !== "cancelled",
    );

    const { result, rerender } = renderHook(({ id }: { id: string }) => useSessionAttendance(id), {
      initialProps: { id: sessions[0].id },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ id: sessions[1].id });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.attendance?.sessionId).toBe(sessions[1].id);
  });
});

describe("useAttendanceCorrections", () => {
  it("returns an empty history before any correction", async () => {
    const { result } = renderHook(() => useAttendanceCorrections({ per_page: 20 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("lists corrections newest first and paginates", async () => {
    const { sessionId, studentIds } = await markableSession();
    const record = await getAttendanceRepository().record({
      sessionId,
      studentId: studentIds[0],
      status: "absent",
      recordedByUserId: RECORDER,
    });
    for (let i = 0; i < 3; i += 1) {
      await getAttendanceRepository().correct(record.id, {
        status: i % 2 === 0 ? "present" : "late",
        reason: `اصلاح ${i}`,
        changedByUserId: RECORDER,
      });
    }

    const { result } = renderHook(() =>
      useAttendanceCorrections({ attendanceRecordId: record.id, per_page: 2 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Bounded: an append-only trail must never be fetched whole.
    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(3);
  });
});
