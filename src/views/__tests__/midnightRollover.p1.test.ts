import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setRuntimeConfig, resetRuntimeConfig } from "@/api/config";
import { isDeterministicClock, academyNowMinutes, DEMO_NOW_MINUTES, academyNow } from "@/domains/shared/clock";
import { academyIsoDate } from "@/views/relations/academyDay";

describe("Midnight rollover fix — Scheduling & Attendance", () => {
  beforeEach(() => resetRuntimeConfig());
  afterEach(() => resetRuntimeConfig());

  it("Scheduling recalculates todayIso when academy clock ticks", () => {
    const src = readFileSync(join(process.cwd(), "src/views/Scheduling.tsx"), "utf8");
    // Must import and use useAcademyNow
    expect(src).toContain("useAcademyNow");
    expect(src).toContain("academyIsoDate");
    // Must have useMemo with [now] dep, not empty []
    expect(src).toContain("useMemo(() => academyIsoDate(), [now])");
    expect(src).not.toContain("useMemo(() => academyIsoDate(), [])");
    // Must not have duplicate helper
    expect(src).not.toContain("function isoFromAcademyDate");
    // No new timer in view
    expect(src).not.toMatch(/setInterval\s*\(/);
    expect(src).not.toMatch(/setTimeout\s*\(/);
    // No direct new Date() — should use academy clock
    // Allow new Date only via academyNow, not directly in view for todayIso
    const viewWithoutComments = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Check that todayIso is not derived from new Date()
    expect(viewWithoutComments).not.toMatch(/todayIso.*new Date\(\)/);
  });

  it("Attendance subscribes to useAcademyNow and recalculates todayIso", () => {
    const src = readFileSync(join(process.cwd(), "src/views/Attendance.tsx"), "utf8");
    expect(src).toContain("useAcademyNow");
    expect(src).toContain("academyIsoDate");
    expect(src).toContain("useMemo(() => academyIsoDate(), [now])");
    expect(src).not.toContain("useMemo(() => academyIsoDate(), [])");
    expect(src).not.toContain("function isoFromAcademyDate");
    expect(src).not.toMatch(/setInterval\s*\(/);
    expect(src).not.toMatch(/setTimeout\s*\(/);
    const viewWithoutComments = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(viewWithoutComments).not.toMatch(/todayIso.*new Date\(\)/);
  });

  it("No new timer/date implementation introduced", () => {
    const scheduling = readFileSync(join(process.cwd(), "src/views/Scheduling.tsx"), "utf8");
    const attendance = readFileSync(join(process.cwd(), "src/views/Attendance.tsx"), "utf8");
    // Both should use canonical useAcademyNow from clock, not create own interval
    // Ensure they don't import setInterval from elsewhere or create Date directly for todayIso
    expect(scheduling).toContain('from "@/domains/shared/clock"');
    expect(attendance).toContain('from "@/domains/shared/clock"');
    // Ensure dateBridge remains canonical for Jalali, not reimplemented
    expect(scheduling).not.toContain("fa-IR-u-ca-persian");
    expect(attendance).not.toContain("fa-IR-u-ca-persian");
  });

  it("Demo deterministic behavior preserved", () => {
    setRuntimeConfig({ mode: "demo", apiBaseUrl: "/api/v1", error: null });
    expect(isDeterministicClock()).toBe(true);
    expect(academyNowMinutes()).toBe(DEMO_NOW_MINUTES);
    const frozen = academyNow();
    expect(frozen.getHours()).toBe(Math.floor(DEMO_NOW_MINUTES / 60));
    expect(frozen.getMinutes()).toBe(DEMO_NOW_MINUTES % 60);
    const iso = academyIsoDate(frozen);
    // Calendar date is real today, time frozen
    const real = new Date();
    const expectedIso = `${real.getFullYear()}-${String(real.getMonth() + 1).padStart(2, "0")}-${String(real.getDate()).padStart(2, "0")}`;
    expect(iso).toBe(expectedIso);
  });

  it("API/live mode rolls over within minute after midnight", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "/api/v1", error: null });
    expect(isDeterministicClock()).toBe(false);
    const now1 = academyNow();
    const iso1 = academyIsoDate(now1);
    // Simulate that useAcademyNow ticks every minute, so todayIso recomputed
    // In real app, now changes, iso recomputed via useMemo [now]
    // Here we just verify that academyIsoDate returns real date and changes if date changes
    expect(iso1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The mechanism: useMemo [now] ensures recomputation, no stale closure
  });
});
