/**
 * Clock — the single source of "now".
 *
 * The demo needs a *deterministic* clock: a showcase where "today's schedule"
 * shifts depending on when the demo is opened is not reproducible, and QA
 * screenshots would never match. Production needs the real wall clock.
 *
 * So "now" is an environment-dependent value, not a constant. Views must read
 * it through `useAcademyNow()` / `academyNowMinutes()` rather than importing a
 * hardcoded number, so the production path gets real time for free.
 *
 * BACKEND REQUIRED: in production, anything time-sensitive that matters
 * (attendance windows, invoice due dates, session status) must be decided by
 * the server. The browser clock is user-controlled and cannot be trusted for
 * authorization or billing.
 */
import { useEffect, useState } from "react";
import { getRuntimeConfig } from "@/api/config";

/**
 * The frozen demo instant: 10:47. Chosen so the seeded schedule shows a mix of
 * finished, in-progress and upcoming sessions — the state that best exercises
 * the UI.
 */
export const DEMO_NOW_MINUTES = 10 * 60 + 47;

/** Minutes elapsed since midnight for a given date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** True when "now" is a fixed demo instant rather than the real clock. */
export function isDeterministicClock(): boolean {
  return getRuntimeConfig().mode !== "api";
}

/**
 * Current academy time in minutes since midnight: frozen in demo, real in
 * production.
 */
export function academyNowMinutes(): number {
  return isDeterministicClock() ? DEMO_NOW_MINUTES : minutesOfDay(new Date());
}

/** Current instant as a `Date`; real time outside demo mode. */
export function academyNow(): Date {
  if (!isDeterministicClock()) return new Date();
  const frozen = new Date();
  frozen.setHours(Math.floor(DEMO_NOW_MINUTES / 60), DEMO_NOW_MINUTES % 60, 0, 0);
  return frozen;
}

/**
 * Reactive academy time.
 *
 * In demo mode the value is constant and no timer is created. In production it
 * ticks once a minute so "in progress" indicators stay honest — this is a real
 * clock, not a simulated loading delay.
 */
export function useAcademyNow(): number {
  const [now, setNow] = useState(academyNowMinutes);

  useEffect(() => {
    if (isDeterministicClock()) return;
    const id = window.setInterval(() => setNow(academyNowMinutes()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
