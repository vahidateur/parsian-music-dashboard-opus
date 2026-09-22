/**
 * Clock — the single source of "now".
 *
 * THE CLOCK IS THE WALL CLOCK, IN EVERY MODE.
 *
 * It used to freeze at 10:47 whenever the data source was `demo`, on the
 * argument that a showcase must be reproducible. That argument was wrong where
 * it mattered: the person looking at the panel is not looking at a screenshot,
 * and a clock that never moves reads as a broken product, not as a controlled
 * experiment. Reproducibility belongs to the SEED (which is anchored to a fixed
 * date — see `domains/demo/schedulingSeed.ts`) and to tests that pin the instant
 * they need explicitly, not to the operator's wall clock.
 *
 * So `academyNow()` answers the real time in `demo` and in `api` alike, and a
 * test that needs 10:47 passes 10:47 — every derivation in the product already
 * takes `now` as a parameter for exactly that reason.
 *
 * BACKEND REQUIRED: in production, anything time-sensitive that matters
 * (attendance windows, invoice due dates, session status) must be decided by the
 * server. The browser clock is user-controlled and cannot be trusted for
 * authorization or billing.
 */
import { useEffect, useState } from "react";

/**
 * The instant the demo used to be frozen at (10:47), kept as a named reference
 * for tests that want to pin a specific time of day instead of inventing the
 * number inline. Nothing in the application reads it.
 */
export const DEMO_NOW_MINUTES = 10 * 60 + 47;

/** Minutes elapsed since midnight for a given date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Current academy time in minutes since midnight.
 *
 * Truncated to the minute on purpose: every status derived from it ("in
 * progress", "done") is a minute-granular fact, and a value that changed every
 * second would re-render the whole dashboard for no difference in meaning.
 * Display surfaces that want seconds use `useAcademyClock()`.
 */
export function academyNowMinutes(): number {
  return minutesOfDay(new Date());
}

/** Current instant as a `Date`. */
export function academyNow(): Date {
  return new Date();
}

/**
 * Reactive academy time in MINUTES.
 *
 * Ticks on the minute boundary (checked every 15s, so a tab that was throttled
 * catches up within a quarter-minute) and only commits when the minute actually
 * changed — a re-render of the dashboard costs more than the check.
 */
export function useAcademyNow(): number {
  const [now, setNow] = useState(academyNowMinutes);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow((previous) => {
        const next = academyNowMinutes();
        return next === previous ? previous : next;
      });
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

/**
 * Reactive wall clock with second precision, for surfaces that SHOW the time.
 *
 * Deliberately separate from `useAcademyNow()`: a seconds display must not drag
 * the dashboard's derived state (filters, statuses, aggregates) through a
 * re-render every second, so it lives in its own hook and is mounted only by the
 * clock itself. Ticks are aligned to the next second boundary, which keeps the
 * displayed seconds from drifting or repeating.
 */
export function useAcademyClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let id = 0;
    const schedule = () => {
      const delay = 1000 - (Date.now() % 1000);
      id = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(id);
  }, []);

  return now;
}
