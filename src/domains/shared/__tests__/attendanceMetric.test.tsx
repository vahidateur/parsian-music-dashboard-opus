// @vitest-environment jsdom
/**
 * Derived attendance metric.
 *
 * This is the number a manager will quote in a meeting, so the two things that
 * matter are that `excused` genuinely does not distort it, and that "no data"
 * never renders as a confident 0٪.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAcademyMetrics, useHeroStats } from "../useAcademyMetrics";
import {
  getAttendanceRepository,
  getSchedulingRepository,
  resetRegistry,
} from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import type { AttendanceStatus } from "@/domains/attendance/types";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const RECORDER = "usr_admin";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/**
 * Marks the given statuses across roster slots.
 *
 * Skips any (session, student) pair already marked, because the repository
 * correctly refuses a duplicate — so successive calls continue into fresh
 * slots rather than colliding with earlier ones.
 */
async function markStatuses(statuses: readonly AttendanceStatus[]): Promise<void> {
  const scheduling = getSchedulingRepository();
  const attendance = getAttendanceRepository();

  const taken = new Set(
    demoStore.attendanceRecords.all().map((r) => `${r.sessionId}|${r.studentId}`),
  );
  const remaining = [...statuses];

  for (const session of (await scheduling.list({ per_page: 500 })).data) {
    if (remaining.length === 0) break;
    if (session.status === "cancelled") continue;

    for (const entry of await scheduling.sessionRoster(session.id)) {
      if (remaining.length === 0) break;
      const key = `${session.id}|${entry.studentId}`;
      if (taken.has(key)) continue;

      await attendance.record({
        sessionId: session.id,
        studentId: entry.studentId,
        status: remaining.shift()!,
        recordedByUserId: RECORDER,
      });
      taken.add(key);
    }
  }
  expect(remaining, "seed should offer enough unmarked roster slots").toEqual([]);
}

async function rate() {
  const { result } = renderHook(() => useAcademyMetrics());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current.metrics;
}

describe("no data", () => {
  it("reports null, never 0, before anything is recorded", async () => {
    /*
     * "Nobody has taken the register" and "everybody was absent" are different
     * facts. A 0 here would state the second while meaning the first.
     */
    const metrics = await rate();
    expect(metrics.attendanceRatePct).toBeNull();
    expect(metrics.attendanceSampleSize).toBe(0);
  });

  it("reports null when the only marks are excused", async () => {
    // Excused is excluded from both sides, so the sample is still empty.
    await markStatuses(["excused", "excused"]);
    const metrics = await rate();

    expect(metrics.attendanceRatePct).toBeNull();
    expect(metrics.attendanceSampleSize).toBe(0);
  });
});

describe("the formula", () => {
  it("counts present as attended", async () => {
    await markStatuses(["present", "present", "present", "present"]);
    const metrics = await rate();
    expect(metrics.attendanceRatePct).toBe(100);
    expect(metrics.attendanceSampleSize).toBe(4);
  });

  it("counts absent against the rate", async () => {
    await markStatuses(["present", "absent"]);
    expect((await rate()).attendanceRatePct).toBe(50);
  });

  it("counts LATE as attended, not as an absence", async () => {
    // A student who arrived late was present; treating them as absent would
    // understate the rate and misrepresent them.
    await markStatuses(["late", "late"]);
    expect((await rate()).attendanceRatePct).toBe(100);
  });

  it("excludes EXCUSED from both numerator and denominator", async () => {
    // 1 present + 1 absent = 50%. Adding two excused must not move it.
    await markStatuses(["present", "absent"]);
    const before = await rate();
    expect(before.attendanceRatePct).toBe(50);
    expect(before.attendanceSampleSize).toBe(2);

    cleanup();
    await markStatuses(["excused", "excused"]);
    const after = await rate();

    expect(after.attendanceRatePct).toBe(50);
    expect(after.attendanceSampleSize).toBe(2);
  });

  it("rounds to a whole percentage", async () => {
    // 2 of 3 = 66.67 -> 67
    await markStatuses(["present", "present", "absent"]);
    expect((await rate()).attendanceRatePct).toBe(67);
  });
});

describe("liveness", () => {
  it("updates after a new mark is recorded", async () => {
    await markStatuses(["absent"]);
    const { result } = renderHook(() => useAcademyMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics.attendanceRatePct).toBe(0);

    await markStatuses(["present"]);
    await waitFor(() => expect(result.current.metrics.attendanceRatePct).toBe(50));
  });

  it("distinguishes a real 0٪ from no data", async () => {
    // A genuine all-absent register IS 0, with a non-zero sample.
    await markStatuses(["absent", "absent"]);
    const metrics = await rate();

    expect(metrics.attendanceRatePct).toBe(0);
    expect(metrics.attendanceSampleSize).toBe(2);
  });
});

describe("existing metrics are untouched", () => {
  it("still reports the four hero numbers", async () => {
    const metrics = await rate();
    expect(metrics.activeStudents).toBeGreaterThan(0);
    expect(metrics.classes).toBeGreaterThan(0);
    expect(metrics.activeEnrollments).toBeGreaterThan(0);
    expect(metrics.capacityUsedPct).toBeGreaterThan(0);
  });
});

describe("the hero surface must not expose the capped rate", () => {
  /**
   * P1 DECISION GUARD.
   *
   * `attendanceRatePct` is computed from at most 500 attendance records, so it
   * is a capped sample rather than a full-history academy figure. Backend
   * aggregation is deferred, and the metric was deliberately NOT renamed — so
   * the only thing standing between it and a misleading dashboard headline is
   * this test.
   *
   * It fails if the value, or anything derived from it, is added to
   * `useHeroStats`.
   */
  it("useHeroStats exposes exactly the four agreed metrics", async () => {
    await markStatuses(["present", "absent", "late", "excused"]);

    const { result } = renderHook(() => useHeroStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats.map((s) => s.label)).toEqual([
      "هنرجوی فعال",
      "کلاس فعال",
      "ثبت‌نام فعال",
      "اشغال ظرفیت",
    ]);
  });

  it("no hero stat carries the attendance rate value", async () => {
    // 1 present + 1 late + 1 absent => 67٪. If that number ever appears in a
    // hero tile, the capped sample has leaked into the dashboard headline.
    await markStatuses(["present", "late", "absent"]);

    const { result: metrics } = renderHook(() => useAcademyMetrics());
    await waitFor(() => expect(metrics.current.loading).toBe(false));
    const rate = metrics.current.metrics.attendanceRatePct;
    expect(rate).toBe(67);

    cleanup();

    const { result: hero } = renderHook(() => useHeroStats());
    await waitFor(() => expect(hero.current.loading).toBe(false));

    expect(hero.current.stats.some((s) => s.value === rate)).toBe(false);
    // Nor smuggled in as a percentage-suffixed tile other than capacity.
    const percentTiles = hero.current.stats.filter((s) => s.suffix === "٪");
    expect(percentTiles.map((s) => s.label)).toEqual(["اشغال ظرفیت"]);
  });

  it("no hero stat is labelled as attendance", async () => {
    const { result } = renderHook(() => useHeroStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (const stat of result.current.stats) {
      expect(stat.label).not.toContain("حضور");
      expect(stat.label).not.toContain("غیاب");
    }
  });

  it("hero stats stay a fixed length, so a fifth tile is a deliberate choice", async () => {
    const { result } = renderHook(() => useHeroStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toHaveLength(4);
  });
});
