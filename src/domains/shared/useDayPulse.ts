/**
 * The live pulse of one academy day: how many sessions are in progress right
 * now, and how many room clashes the day carries.
 *
 * M10 — before this hook existed, the Hero and the TopBar read those numbers
 * from a floating "schedule" fixture: thirteen rows with `state: "live"` and
 * `state: "attention"` assigned by hand, always whatever the fixture said,
 * regardless of the day or the dataset. The numbers below are derived from the
 * scheduling repository over an explicit one-day window, by the same
 * `conflictPairs` rule the dashboard uses (`domains/shared/dashboardInsights`)
 * — in EMPTY there is nothing to count, so the result is honestly zero.
 */
import { useMemo } from "react";
import type { ApiError } from "@/api/errors";
import { parseTime } from "@/lib/format";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { conflictPairs } from "./dashboardInsights";

const DAY_PAGE = 200;

export interface DayPulse {
  /** Sessions running right this minute. */
  live: number;
  /** Same-room clashing pairs today (one shared slot = one attention point). */
  conflicts: number;
  /** Earliest start involved in a clash — where the attention begins. */
  firstConflictStart: string | null;
  loading: boolean;
  error: ApiError | null;
}

export function useDayPulse(todayIso: string, nowMinutes: number): DayPulse {
  const sessions = useSessions({ from: todayIso, to: todayIso, per_page: DAY_PAGE });
  const pulse = useMemo(() => {
    const items = sessions.items;
    const live = items.filter(
      (s) =>
        s.status === "scheduled" &&
        parseTime(s.startTime) <= nowMinutes &&
        nowMinutes < parseTime(s.endTime),
    ).length;
    const pairs = conflictPairs(items.filter((s) => s.date === todayIso));
    return {
      live,
      conflicts: pairs.length,
      firstConflictStart: pairs.length ? pairs.map((p) => p.a.startTime).sort((a, b) => a.localeCompare(b))[0] : null,
    };
  }, [sessions.items, nowMinutes, todayIso]);
  return { ...pulse, loading: sessions.loading, error: sessions.error };
}
