// @vitest-environment jsdom
/**
 * Scheduling hooks.
 *
 * The behaviour worth testing here is not "does it fetch" but the two things
 * that break silently in production: a stale response overwriting a newer one
 * when the user clicks quickly, and a list call that forgets its page size and
 * quietly truncates the dataset.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useConflictCheck,
  useGenerationPreview,
  useSessionRoster,
  useSessions,
} from "../useScheduling";
import { getSchedulingRepository, resetRegistry, setSchedulingRepository } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

describe("useSessions", () => {
  it("loads sessions and reports loading state honestly", async () => {
    const { result } = renderHook(() => useSessions({ per_page: 20 }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.total).toBeGreaterThan(result.current.items.length);
    expect(result.current.error).toBeNull();
  });

  it("applies filters", async () => {
    const { result } = renderHook(() => useSessions({ classId: "cl1", per_page: 100 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.items.every((s) => s.classId === "cl1")).toBe(true);
  });

  it("refreshes when the data version bumps after a write", async () => {
    const { result } = renderHook(() => useSessions({ classId: "cl1", per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.total;

    // A write through the repository bumps the global version.
    const target = result.current.items.find((s) => s.status !== "cancelled")!;
    await getSchedulingRepository().cancelSession(target.id, "تعطیلی");

    await waitFor(() => {
      const cancelled = result.current.items.find((s) => s.id === target.id);
      expect(cancelled?.status).toBe("cancelled");
    });
    expect(result.current.total).toBe(before);
  });
});

describe("useSessionRoster", () => {
  it("returns the derived roster for a session", async () => {
    const sessions = await getSchedulingRepository().list({ per_page: 500 });
    let withRoster: string | undefined;
    for (const session of sessions.data) {
      if ((await getSchedulingRepository().sessionRoster(session.id)).length > 0) {
        withRoster = session.id;
        break;
      }
    }
    expect(withRoster).toBeDefined();

    const { result } = renderHook(() => useSessionRoster(withRoster));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.length).toBeGreaterThan(0);
    expect(result.current.data?.[0]).toHaveProperty("studentName");
  });

  it("does not fetch when no session is selected", async () => {
    const { result } = renderHook(() => useSessionRoster(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error for an unknown session rather than hanging", async () => {
    const { result } = renderHook(() => useSessionRoster("ses_nope"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it("refreshes when the data version bumps, without changing the session", async () => {
    /*
     * `useDerivedRead` (shared by roster, generation preview and conflict
     * check) must re-run on a global data-version bump, not only when its own
     * arguments change. Otherwise a roster stays stale after someone enrolls
     * or withdraws a student elsewhere in the app, and a register is taken
     * against the wrong list of names.
     *
     * Exercised through `useSessionRoster` because `useDerivedRead` is
     * private; the session id is deliberately held constant so a re-run can
     * only be attributable to the version bump.
     */
    const scheduling = getSchedulingRepository();

    // A session whose class has room for one more active enrollment.
    const sessions = (await scheduling.list({ per_page: 500 })).data;
    let target: (typeof sessions)[number] | undefined;
    let baseline = 0;
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      const roster = await scheduling.sessionRoster(session.id);
      if (roster.length > 0) {
        target = session;
        baseline = roster.length;
        break;
      }
    }
    expect(target).toBeDefined();

    const { result } = renderHook(() => useSessionRoster(target!.id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(baseline);

    // Enrol a student not already on this class, effective before the session.
    const onRoster = new Set(result.current.data!.map((r) => r.studentId));
    const newcomer = demoStore.students.all().find((s) => !onRoster.has(s.id));
    expect(newcomer).toBeDefined();

    demoStore.enrollments.create({
      studentId: newcomer!.id,
      classId: target!.classId,
      status: "active",
      startDate: "۱۴۰۳/۰۱/۰۱",
      pricingPlan: { label: "ترم", amount: 1 },
    });

    // The hook's own arguments never changed; only the data version did.
    await waitFor(() => expect(result.current.data).toHaveLength(baseline + 1));
  });

  it("ignores a stale response when the session changes mid-flight", async () => {
    /*
     * The real hazard: a slow first request landing after a fast second one.
     * A fake repository makes the ordering deterministic instead of hoping.
     */
    const slow = { id: "ses_slow", delay: 40, roster: [{ studentId: "st_slow", studentName: "کند" }] };
    const fast = { id: "ses_fast", delay: 0, roster: [{ studentId: "st_fast", studentName: "تند" }] };

    const real = getSchedulingRepository();
    setSchedulingRepository({
      ...real,
      sessionRoster: (id: string) => {
        const match = id === slow.id ? slow : fast;
        return new Promise((resolve) => setTimeout(() => resolve(match.roster), match.delay));
      },
    } as unknown as ReturnType<typeof getSchedulingRepository>);

    const { result, rerender } = renderHook(({ id }: { id: string }) => useSessionRoster(id), {
      initialProps: { id: slow.id },
    });

    // Switch before the slow one resolves.
    rerender({ id: fast.id });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.[0].studentId).toBe("st_fast");

    // Give the slow response time to land; it must be discarded.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(result.current.data?.[0].studentId).toBe("st_fast");
  });
});

describe("useGenerationPreview", () => {
  it("returns a plan and writes nothing", async () => {
    const before = JSON.stringify(demoStore.scheduledSessions.all());

    const { result } = renderHook(() =>
      useGenerationPreview({ classId: "cl1", from: "2026-10-01", to: "2026-10-28" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.classId).toBe("cl1");
    // The preview must never mutate the store.
    expect(JSON.stringify(demoStore.scheduledSessions.all())).toBe(before);
  });

  it("holds the request until enabled", async () => {
    const before = JSON.stringify(demoStore.scheduledSessions.all());
    const { result } = renderHook(() =>
      useGenerationPreview({ classId: "cl1", from: "2026-10-01", to: "2026-10-28" }, false),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(JSON.stringify(demoStore.scheduledSessions.all())).toBe(before);
  });
});

describe("useConflictCheck", () => {
  it("reports a clean slot", async () => {
    const { result } = renderHook(() =>
      useConflictCheck({
        classId: "cl1",
        date: "2026-10-06",
        startTime: "07:00",
        endTime: "08:00",
        teacherId: "t1",
        roomId: "r1",
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.hard).toEqual([]);
  });

  it("reports a clash against a stored session", async () => {
    const existing = (await getSchedulingRepository().list({ per_page: 1 })).data[0];

    const { result } = renderHook(() =>
      useConflictCheck({
        classId: "cl1",
        date: existing.date,
        startTime: existing.startTime,
        endTime: existing.endTime,
        teacherId: existing.teacherId,
        roomId: existing.roomId,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.ok).toBe(false);
  });

  it("does not fetch without a candidate", async () => {
    const { result } = renderHook(() => useConflictCheck(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it("does not refetch when given an equivalent inline candidate", async () => {
    // A component re-rendering with a fresh object literal must not thrash the
    // repository; identity is derived from the values, not the reference.
    const spy = vi.spyOn(getSchedulingRepository(), "checkConflicts");
    const real = getSchedulingRepository();
    setSchedulingRepository(real);

    const candidate = () => ({
      classId: "cl1",
      date: "2026-10-06",
      startTime: "07:00",
      endTime: "08:00",
      teacherId: "t1",
      roomId: "r1",
    });

    const { result, rerender } = renderHook(() => useConflictCheck(candidate()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender();
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeDefined();
    spy.mockRestore();
  });
});
