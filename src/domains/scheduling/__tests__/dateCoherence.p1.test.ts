import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isoToJalaliDisplay, isIsoDate } from "../dateBridge";
import { academyIsoDate } from "@/views/relations/academyDay";
import { academyNow, academyNowMinutes, DEMO_NOW_MINUTES, isDeterministicClock } from "@/domains/shared/clock";
import { faToday } from "@/lib/format";
import { setRuntimeConfig, resetRuntimeConfig, getRuntimeConfig } from "@/api/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("GAP-010 date source coherence", () => {
  beforeEach(() => {
    resetRuntimeConfig();
  });
  afterEach(() => {
    resetRuntimeConfig();
  });

  it("academyIsoDate uses academyNow (deterministic in demo, real in api)", () => {
    // Demo mode: frozen time but real calendar date
    setRuntimeConfig({ mode: "demo", apiBaseUrl: "/api/v1", error: null });
    expect(isDeterministicClock()).toBe(true);
    expect(academyNowMinutes()).toBe(DEMO_NOW_MINUTES);
    const now = academyNow();
    expect(now.getHours()).toBe(Math.floor(DEMO_NOW_MINUTES / 60));
    expect(now.getMinutes()).toBe(DEMO_NOW_MINUTES % 60);
    const iso = academyIsoDate(now);
    expect(isIsoDate(iso)).toBe(true);
    // Calendar date should be today real date (not frozen)
    const realToday = new Date();
    const expectedRealIso = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, "0")}-${String(realToday.getDate()).padStart(2, "0")}`;
    expect(iso).toBe(expectedRealIso);
  });

  it("faToday uses canonical bridge isoToJalaliDisplay and academyIsoDate, not new Date directly", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/format.ts"), "utf8");
    // Should import isoToJalaliDisplay and academyIsoDate
    expect(source).toContain("isoToJalaliDisplay");
    expect(source).toContain("academyIsoDate");
    // Should NOT contain new Date() directly in faToday implementation (except fallback derived)
    // Check that faToday does not contain "new Date()" in its body as primary source
    // We allow new Date only if it's inside academyNow, not in faToday
    const faTodayBlock = source.slice(source.indexOf("export const faToday"));
    // The new implementation should not have "new Date()" — it uses academyIsoDate
    expect(faTodayBlock).not.toContain("new Date()");
    // Should not contain hardcoded fallback date
    expect(source).not.toContain("۱۹ اسفند ۱۴۰۴");
    expect(source).not.toContain("سه‌شنبه، ۱۹ اسفند");
  });

  it("faToday(iso) equals isoToJalaliDisplay(iso) with weekday options — canonical path", () => {
    setRuntimeConfig({ mode: "demo", apiBaseUrl: "/api/v1", error: null });
    const iso = academyIsoDate();
    const expected = isoToJalaliDisplay(iso, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const actual = faToday(iso);
    expect(actual).toBe(expected);
  });

  it("faToday() without arg uses academyIsoDate() — coherent with Dashboard", () => {
    setRuntimeConfig({ mode: "demo", apiBaseUrl: "/api/v1", error: null });
    const iso = academyIsoDate();
    const viaBridge = isoToJalaliDisplay(iso, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const today = faToday();
    expect(today).toBe(viaBridge);
  });

  it("Scheduling and Attendance no longer have duplicate isoFromAcademyDate helper", () => {
    const sched = readFileSync(join(process.cwd(), "src/views/Scheduling.tsx"), "utf8");
    const attend = readFileSync(join(process.cwd(), "src/views/Attendance.tsx"), "utf8");
    expect(sched).not.toContain("function isoFromAcademyDate");
    expect(attend).not.toContain("function isoFromAcademyDate");
    expect(sched).toContain("academyIsoDate");
    expect(attend).toContain("academyIsoDate");
  });

  it("Hero and TopBar use academyIsoDate for faToday — same source as Dashboard", () => {
    const hero = readFileSync(join(process.cwd(), "src/components/hero/Hero.tsx"), "utf8");
    const topbar = readFileSync(join(process.cwd(), "src/components/layout/TopBar.tsx"), "utf8");
    // Both should import academyIsoDate and use it for faToday
    expect(hero).toContain("academyIsoDate");
    expect(hero).toContain("faToday(todayIso)");
    expect(hero).toContain("const todayIso = academyIsoDate()");
    expect(topbar).toContain("academyIsoDate");
    expect(topbar).toContain("faToday(todayIso)");
    expect(topbar).toContain("const todayIso = academyIsoDate()");
  });

  it("API/live mode uses real clock and minute tick preserved", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "/api/v1", error: null });
    expect(isDeterministicClock()).toBe(false);
    const minutes = academyNowMinutes();
    // Real minutes should be within 0-1439 and not necessarily DEMO_NOW_MINUTES
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThan(24 * 60);
    // academyNow should be close to new Date()
    const now = academyNow();
    const realNow = new Date();
    expect(Math.abs(now.getTime() - realNow.getTime())).toBeLessThan(2000);
  });

  it("dateBridge remains canonical — no second implementation", () => {
    const bridge = readFileSync(join(process.cwd(), "src/domains/scheduling/dateBridge.ts"), "utf8");
    expect(bridge).toContain("export function isoToJalaliDisplay");
    expect(bridge).toContain("export function isIsoDate");
    // Ensure format.ts does not re-implement Jalali conversion itself, it uses bridge
    const format = readFileSync(join(process.cwd(), "src/lib/format.ts"), "utf8");
    // Should not contain Intl.DateTimeFormat with persian calendar directly except via bridge
    // The only persian calendar usage should be in dateBridge, not in format.ts
    // We allow isoToJalaliDisplay which internally uses Intl, but format.ts should not directly instantiate fa-IR-u-ca-persian
    const formatAfterImports = format.slice(format.indexOf("export const faToday"));
    expect(formatAfterImports).not.toContain("fa-IR-u-ca-persian");
  });
});
