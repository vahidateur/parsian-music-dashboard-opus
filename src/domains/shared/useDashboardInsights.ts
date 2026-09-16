/**
 * The dashboard's one read set, and the insights derived from it.
 *
 * WHY ONE HOOK
 *
 * `Signals`, `Attention`, `TodayFlow`, `Intelligence` and `BusinessIntelligence`
 * all describe the same academy at the same instant. If each panel read the
 * repositories itself they could disagree mid-write, and the dashboard would show
 * two different rosters a frame apart. So the view performs one read set and
 * hands each panel the slice it renders — which is also the split the rest of the
 * product uses: views wire data, components render it.
 *
 * WHAT IT READS, AND WHY THOSE BOUNDS
 *
 *   students, classes, rooms, teachers   the whole (small) demo dataset, at the
 *                                        same page size `useAcademyMetrics` uses
 *   sessions                             the last thirteen rolling weeks ending
 *                                        on the academy day — the span the weekly
 *                                        series draws — and nothing after today,
 *                                        because a schedule holds occurrences that
 *                                        have not happened yet
 *
 * `metrics` comes from `useAcademyMetrics`, the existing seam M9 names for the
 * hero numbers, rather than being recomputed here.
 *
 * BACKEND REQUIRED: in production this must become `GET /dashboard/insights`.
 * The client read is honest (every figure is supported by the rows read) but it is
 * still client-side aggregation over a bounded window, exactly like the note on
 * `useAcademyMetrics.attendanceRatePct`.
 */
import { useMemo } from "react";
import { useClasses } from "@/domains/classes/useClasses";
import { useRooms } from "@/domains/rooms/useRooms";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { useStudentList } from "@/domains/students/useStudents";
import { useSessions } from "@/domains/scheduling/useScheduling";
import type { ApiError } from "@/api/errors";
import {
  dashboardCounts,
  deriveAttentionItems,
  deriveFlowRows,
  deriveInstrumentMix,
  deriveIntelligenceCards,
  deriveOccupancy,
  deriveReceivables,
  deriveSignals,
  isoDayNumber,
  isoFromDayNumber,
  rosterSeries,
  type DashboardCounts,
  type FlowRow,
  type FlowSummary,
  type InstrumentRow,
  type InsightInput,
  type OccupancyModel,
  type ReceivablesModel,
  type RosterModel,
} from "./dashboardInsights";
import type { AttentionItem, Signal } from "@/lib/viewContracts";
import type { IntelligenceCard } from "./dashboardInsights";
import { useAcademyMetrics } from "./useAcademyMetrics";

/** Page size for the whole-dataset reads. Same ceiling the metrics hook states. */
const PAGE = 500;
/** Rolling weeks the trend series draws. */
const WEEKS = 13;

export interface DashboardInsights {
  loading: boolean;
  error: ApiError | null;
  counts: DashboardCounts;
  /** Zero stored rows: the panels say «داده‌ای نیست» rather than a figure. */
  hasRecords: boolean;
  signals: Signal[];
  attention: AttentionItem[];
  intelligence: IntelligenceCard[];
  flow: FlowRow[];
  flowSummary: FlowSummary;
  roster: RosterModel;
  occupancy: OccupancyModel;
  instruments: InstrumentRow[];
  receivables: ReceivablesModel;
  /** Re-reads every source. Wired to the Intelligence panel's refresh control. */
  reload: () => void;
}

/**
 * The insights for the academy day `todayIso`, as of `nowMinutes`.
 *
 * Both are passed in rather than read here: `academyNow()` is the product's one
 * clock, and `academyIsoDate()` (views/relations/academyDay) is its one calendar
 * conversion. A hook under `domains/` importing from `views/` would invert the
 * layering, and formatting the day a second time would create the second
 * conversion that module exists to prevent.
 */
export function useDashboardInsights({ todayIso, nowMinutes }: { todayIso: string; nowMinutes: number }): DashboardInsights {
  const { metrics, loading: metricsLoading } = useAcademyMetrics();
  const students = useStudentList({ per_page: PAGE });
  const classes = useClasses({ per_page: PAGE });
  const rooms = useRooms({ per_page: PAGE });
  const teachers = useTeachers({ per_page: PAGE });

  const windowStart = useMemo(() => {
    const reference = isoDayNumber(todayIso);
    return reference === null ? todayIso : isoFromDayNumber(reference - (WEEKS * 7 - 1));
  }, [todayIso]);

  const sessions = useSessions({ from: windowStart, to: todayIso, per_page: PAGE });

  const reload = useMemo(
    () => () => {
      students.reload();
      classes.reload();
      rooms.reload();
      teachers.reload();
      sessions.reload();
    },
    [students, classes, rooms, teachers, sessions],
  );

  const input: InsightInput = useMemo(
    () => ({
      metrics,
      students: students.students,
      classes: classes.items,
      rooms: rooms.items,
      teachers: teachers.items,
      sessions: sessions.items,
      todayIso,
      nowMinutes,
    }),
    [
      metrics,
      students.students,
      classes.items,
      rooms.items,
      teachers.items,
      sessions.items,
      todayIso,
      nowMinutes,
    ],
  );

  /**
   * The teacher lookup `TimelineEvent` needs. Teachers carry a `name`; the map is
   * index-only, so a session pointing at an unknown id renders `NO_DATA` rather
   * than a blank.
   */
  const lookups = useMemo(
    () => ({
      classes: new Map(input.classes.map((klass) => [klass.id, klass])),
      rooms: new Map(input.rooms.map((room) => [room.id, room])),
      teachers: new Map(input.teachers.map((teacher) => [teacher.id, teacher.name])),
    }),
    [input.classes, input.rooms, input.teachers],
  );

  const signals = useMemo(() => deriveSignals(input), [input]);
  const attention = useMemo(() => deriveAttentionItems(input), [input]);
  const intelligence = useMemo(() => deriveIntelligenceCards(input), [input]);
  const flow = useMemo(() => deriveFlowRows(input.sessions, todayIso, nowMinutes, lookups), [input, todayIso, nowMinutes, lookups]);
  const roster = useMemo(() => rosterSeries(input.students), [input.students]);
  const occupancy = useMemo(() => deriveOccupancy(input.classes, input.rooms), [input.classes, input.rooms]);
  const instruments = useMemo(() => deriveInstrumentMix(input.students), [input.students]);
  const receivables = useMemo(() => deriveReceivables(input.students), [input.students]);
  const counts = useMemo(
    () =>
      dashboardCounts({
        students: input.students,
        classes: input.classes,
        rooms: input.rooms,
        teachers: input.teachers.length,
        sessions: input.sessions,
      }),
    [input],
  );

  return {
    loading: metricsLoading || students.loading || classes.loading || rooms.loading || teachers.loading || sessions.loading,
    error: students.error ?? classes.error ?? rooms.error ?? teachers.error ?? sessions.error,
    counts,
    hasRecords: counts.records > 0,
    signals,
    attention,
    intelligence,
    flow: flow.rows,
    flowSummary: flow.summary,
    roster,
    occupancy,
    instruments,
    receivables,
    reload,
  };
}
