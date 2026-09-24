import { Button, SectionHeader, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { TimelineEvent } from "@/components/ds/blocks";
import { CALENDAR_UNAVAILABLE, type FlowRow, type FlowSummary } from "@/domains/shared/dashboardInsights";
import type { TeacherDayModel, TeacherRegisterRow } from "@/domains/shared/teacherDesk";
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { faNum, NO_DATA } from "@/lib/format";
import { cn } from "@/utils/cn";

const NO_REGISTER_ACCESS = "ثبت صورت‌جلسه برای این جلسه به شما سپرده نشده است";

/** The register sentence + its action, under one timeline row. */
function RegisterFooter({
  register,
  writable,
  onOpenAttendance,
}: {
  register: TeacherRegisterRow;
  writable: boolean;
  onOpenAttendance: () => void;
}) {
  if (register.registerDue) {
    return writable ? (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11.5px] text-warn-400">{register.registerNote}</span>
        <Button variant="primary" size="sm" onClick={onOpenAttendance}>
          ثبت صورت‌جلسه
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-warn-400">{register.registerNote}</span>
        <span className="text-[11.5px] text-ink-400">{NO_REGISTER_ACCESS}</span>
      </div>
    );
  }
  return <span className="text-[11.5px] text-ink-400">{register.registerNote}</span>;
}

/**
 * The teacher's own day, in the flow primitive the management dashboard already
 * uses — one row per session, with the register's state on the row.
 *
 * The rows are `deriveFlowRows`' output over the sessions read with a
 * `teacherId` filter: the same status vocabulary (next / live / done /
 * attention), the same clash rule, and no fixture fields. `Teacher.todayClasses`
 * is never consulted — its ids match nothing in the dataset.
 */
export function TeacherDayTimeline({
  flow,
  day,
  now,
  loading,
  unavailable,
  onRetry,
  onOpenSession,
  onResolveConflict,
  onOpenSchedule,
  onOpenAttendance,
  writableSessionIds,
  className,
}: {
  flow: { rows: FlowRow[]; summary: FlowSummary } | null;
  day: TeacherDayModel | null;
  now: number;
  loading: boolean;
  unavailable: boolean;
  onRetry: () => void;
  onOpenSession: (sessionId: string) => void;
  onResolveConflict: () => void;
  onOpenSchedule: () => void;
  onOpenAttendance: (sessionId: string) => void;
  writableSessionIds: ReadonlySet<string>;
  className?: string;
}) {
  const kicker = loading
    ? "در حال خواندن تقویم…"
    : unavailable || !flow
      ? CALENDAR_UNAVAILABLE
      : flow.summary.total === 0
        ? "برای امروز جلسه‌ای روی تقویم نیست"
        : [
            `${faNum(flow.summary.total)} جلسه`,
            `${faNum(flow.summary.remaining)} جلسه در پیش`,
            flow.summary.cancelled > 0 ? `${faNum(flow.summary.cancelled)} لغو‌شده` : null,
          ]
            .filter((part): part is string => part !== null)
            .join(" · ");

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader title="برنامهٔ امروز من" kicker={kicker} action="تقویم" onAction={onOpenSchedule} />
      {loading ? (
        <LoadingState label="در حال خواندن جلسه‌های امروز…" />
      ) : unavailable || !flow ? (
        <ErrorState
          className="mt-4"
          title={CALENDAR_UNAVAILABLE}
          description="جلسه‌های امروز خوانده نشد؛ برنامه‌ای که در دست نیست را خالی نشان نمی‌دهیم."
          onRetry={onRetry}
        />
      ) : flow.rows.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="امروز جلسه‌ای روی تقویم شما نیست"
          description="اگر جلسه‌ای برای امروز ثبت شده باشد اینجا و در تقویم دیده می‌شود."
          action="گشودن تقویم"
          onAction={onOpenSchedule}
        />
      ) : (
        <ol className="mt-5">
          {flow.rows.map((row, index) => {
            const register = day?.bySessionId.get(row.session.id);
            return (
              <TimelineEvent
                key={row.session.id}
                session={row.session}
                status={row.status}
                isLast={index === flow.rows.length - 1}
                now={now}
                onOpen={() => onOpenSession(row.session.id)}
                onResolve={onResolveConflict}
                footer={
                  register ? (
                    <RegisterFooter
                      register={register}
                      writable={writableSessionIds.has(row.session.id)}
                      onOpenAttendance={() => onOpenAttendance(row.session.id)}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ol>
      )}
      {!loading && !unavailable && flow && flow.summary.total > flow.rows.length && (
        <p className="mt-4 text-[11px] text-ink-400">
          {faNum(flow.summary.total - flow.rows.length)} جلسهٔ دیگر هم روی تقویم امروز هست.
        </p>
      )}
    </Surface>
  );
}

/** «امروز» / «دیروز» / a Jalali date — never a bare ISO string. */
function dayLabel(date: string, todayIso: string): string {
  if (date === todayIso) return "امروز";
  const shown = isoToJalaliDisplay(date, { weekday: "long", day: "numeric", month: "long" });
  return shown.length > 0 ? shown : NO_DATA;
}

/**
 * The registers that are genuinely due: sessions whose slot is behind the
 * academy clock, that have a roster, and that provably carry no mark.
 *
 * Three honest abstentions are built in. While the marks read is incomplete the
 * panel says it cannot tell an unmarked session from an unread one; while the
 * roster read is incomplete it says the register's own students are unknown; and
 * a due register the canonical rule (`canWriteAttendance`) does not authorise is
 * listed with the reason instead of a button that would fail.
 */
export function RegisterDuePanel({
  day,
  todayIso,
  loading,
  marksEvidence,
  rosterEvidence,
  summary,
  writableSessionIds,
  classTitle,
  describeSession,
  onOpenAttendance,
  onOpenClass,
  className,
}: {
  day: TeacherDayModel | null;
  todayIso: string;
  loading: boolean;
  marksEvidence: boolean;
  rosterEvidence: boolean;
  /** The calendar's own summary, for the sentence about how today looks. */
  summary: FlowSummary | null;
  writableSessionIds: ReadonlySet<string>;
  /** The class's stored title, or «—» when the class row is not in hand. */
  classTitle: (classId: string) => string;
  /** «۱۷:۰۰ تا ۱۸:۳۰ · اتاق ۱» from the session row the view already holds. */
  describeSession: (sessionId: string) => string;
  onOpenAttendance: (sessionId: string) => void;
  onOpenClass: (classId: string) => void;
  className?: string;
}) {
  const due = day?.due ?? [];
  const dueTotal = day?.dueTotal ?? 0;

  const kicker = loading
    ? "در حال خواندن…"
    : !marksEvidence
      ? "وضعیت ثبت صورت‌جلسه‌ها خوانده نشد"
      : !rosterEvidence
        ? "فهرست هنرجویان خوانده نشد"
        : dueTotal === 0
          ? summary && summary.total === 0
            ? "امروز جلسه‌ای نداشته‌اید"
            : "همهٔ جلسه‌های گذشتهٔ این هفته ثبت شده‌اند"
          : `${faNum(dueTotal)} جلسه بدون صورت‌جلسه`;

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader title="صورت‌جلسه‌های ثبت‌نشده" kicker={kicker} />
      {loading ? (
        <LoadingState label="در حال خواندن صورت‌جلسه‌ها…" />
      ) : !marksEvidence ? (
        <EmptyState
          className="mt-2"
          title="وضعیت صورت‌جلسه‌ها خوانده نشد"
          description="مهرهای این هفته خوانده نشد؛ تا خواندن کامل نمی‌گوییم جلسه‌ای ثبت‌نشده مانده است — نبودِ شاهد، صفر نیست."
        />
      ) : !rosterEvidence ? (
        <EmptyState
          className="mt-2"
          title="فهرست هنرجویان خوانده نشد"
          description="بدون فهرست هنرجویان نمی‌توان گفت کدام جلسه صورت‌جلسهٔ لازم داشته است."
        />
      ) : due.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="صورت‌جلسهٔ معوقی نیست"
          description="جلسه‌های گذشتهٔ این هفته که هنرجو داشته‌اند، ثبت شده‌اند."
        />
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-white/[0.05]">
          {due.map((row) => {
            const writable = writableSessionIds.has(row.sessionId);
            return (
              <li key={row.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenClass(row.classId)}
                    className="truncate text-right text-sm font-medium text-ink-50 transition-colors hover:text-gold-300"
                  >
                    {classTitle(row.classId)}
                  </button>
                  <p className="mt-0.5 text-xs text-ink-300">
                    {dayLabel(row.date, todayIso)} · {describeSession(row.sessionId)} ·{" "}
                    {faNum(row.rosterStudentIds?.length ?? 0)} هنرجو
                  </p>
                  {!writable && <p className="mt-1 text-[11px] text-ink-400">{NO_REGISTER_ACCESS}</p>}
                </div>
                {writable ? (
                  <Button variant="primary" size="sm" onClick={() => onOpenAttendance(row.sessionId)}>
                    ثبت صورت‌جلسه
                  </Button>
                ) : (
                  <StatusBadge tone="neutral" label="بدون دسترسی ثبت" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && marksEvidence && rosterEvidence && dueTotal > due.length && (
        <p className="mt-3 text-[11px] text-ink-400">
          و {faNum(dueTotal - due.length)} جلسهٔ دیگر در هفتهٔ گذشته — از «حضور و غیاب» ثبت کنید.
        </p>
      )}
    </Surface>
  );
}
