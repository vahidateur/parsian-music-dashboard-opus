import { CalendarClock, MapPin, Users } from "lucide-react";
import { Button, SectionHeader, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { CALENDAR_UNAVAILABLE, type FlowRow } from "@/domains/shared/dashboardInsights";
import type { TeacherDayModel } from "@/domains/shared/teacherDesk";
import { instrumentName } from "@/domains/instruments/catalog";
import { faNum, faTime, NO_DATA, parseTime } from "@/lib/format";
import { cn } from "@/utils/cn";

const STATUS_TONE: Record<string, { tone: Tone; label: string; live?: boolean }> = {
  live: { tone: "ok", label: "در حال برگزاری", live: true },
  next: { tone: "gold", label: "کلاس بعدی" },
  scheduled: { tone: "neutral", label: "برنامه‌ریزی‌شده" },
  attention: { tone: "warn", label: "نیازمند توجه" },
  cancelled: { tone: "neutral", label: "لغو شده" },
  done: { tone: "neutral", label: "برگزار شد" },
};

/** How far away the next class is, as a sentence — never as a countdown to nothing. */
function countdownLabel(start: string, end: string, nowMinutes: number): string | null {
  const from = parseTime(start);
  const to = parseTime(end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (nowMinutes >= from && nowMinutes < to) return "همین حالا در حال برگزاری است";
  const minutes = from - nowMinutes;
  if (minutes <= 0) return null;
  if (minutes < 60) return `${faNum(minutes)} دقیقه دیگر`;
  return `${faNum(Math.floor(minutes / 60))} ساعت و ${faNum(minutes % 60)} دقیقه دیگر`;
}

/**
 * The one focal plate of the teaching desk: the class the teacher is about to
 * teach (or is teaching right now).
 *
 * Everything on it is read, not composed: the class is the calendar row the
 * day's own status derivation marked `next`/`live`, the room is that session's
 * room, the head-count is the register the roster rule resolves for the
 * session's date, and the register line is the same sentence the day model
 * produced for that row. When the calendar read did not answer the plate says
 * so instead of showing an empty day — an unreadable calendar and a free
 * afternoon are different facts (D12).
 */
export function NextClassPlate({
  row,
  classId,
  day,
  nowMinutes,
  loading,
  unavailable,
  onRetry,
  onOpenClass,
  onOpenSchedule,
  onOpenAttendance,
  className,
}: {
  row: FlowRow | null;
  /** The row's class, resolved by the caller from the session it already holds. */
  classId: string | null;
  day: TeacherDayModel | null;
  nowMinutes: number;
  loading: boolean;
  unavailable: boolean;
  onRetry?: () => void;
  onOpenClass: (classId: string) => void;
  onOpenSchedule: () => void;
  onOpenAttendance: (sessionId: string) => void;
  className?: string;
}) {
  if (loading) {
    return (
      <Surface ornate className={cn("p-6", className)}>
        <LoadingState label="در حال خواندن تقویم شما…" />
      </Surface>
    );
  }
  if (unavailable) {
    return (
      <Surface ornate className={cn("p-6", className)}>
        <ErrorState title={CALENDAR_UNAVAILABLE} description="تقویم شما خوانده نشد، پس نمی‌دانیم کلاس بعدی چه زمانی است." onRetry={onRetry} />
      </Surface>
    );
  }
  if (!row) {
    return (
      <Surface ornate className={cn("p-6", className)}>
        <SectionHeader title="کلاس بعدی شما" kicker="امروز" />
        <EmptyState
          className="mt-2"
          title="کلاس بعدی‌ای در تقویم امروز نیست"
          description="جلسه‌های باقی‌ماندهٔ امروز به پایان رسیده یا برای امروز جلسه‌ای برنامه‌ریزی نشده است."
          action="برنامهٔ هفته"
          onAction={onOpenSchedule}
        />
      </Surface>
    );
  }

  const session = row.session;
  const badge = STATUS_TONE[row.status] ?? STATUS_TONE.scheduled;
  const register = day?.bySessionId.get(session.id);
  const countdown = countdownLabel(session.start, session.end, nowMinutes);
  const held = register?.marks !== null && register?.marks !== undefined && register.marks > 0;

  return (
    <Surface ornate className={cn("p-6", className)}>
      <SectionHeader
        title="کلاس بعدی شما"
        kicker={countdown ?? "جلسهٔ امروز"}
        aside={<StatusBadge tone={badge.tone} label={badge.label} live={badge.live} />}
      />

      <h3 className="mt-5 text-[26px] font-bold leading-tight tracking-tight text-ink-50 sm:text-3xl">
        {session.title}
      </h3>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-200">
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="size-4 text-gold-400" strokeWidth={1.8} />
          <span className="nums">
            {faTime(session.start)} تا {faTime(session.end)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 text-gold-400" strokeWidth={1.8} />
          {session.room}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-gold-400" strokeWidth={1.8} />
          {register?.rosterStudentIds === null || register === undefined
            ? NO_DATA
            : faNum(register.rosterStudentIds.length)}{" "}
          هنرجو
        </span>
        <span className="text-ink-400">{instrumentName(session.instrument)}</span>
      </div>

      {/* The register's own sentence — the same one the day model produced. */}
      <p
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
          register?.registerDue
            ? "border-warn-500/25 bg-warn-500/[0.07] text-warn-400"
            : held
              ? "border-ok-500/22 bg-ok-500/[0.06] text-ok-400"
              : "border-white/[0.07] bg-white/[0.02] text-ink-300",
        )}
      >
        صورت‌جلسه: {register ? register.registerNote : NO_DATA}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={classId === null}
          onClick={() => classId && onOpenClass(classId)}
        >
          گشودن کلاس
        </Button>
        <Button variant="subtle" size="sm" onClick={onOpenSchedule}>
          برنامهٔ من
        </Button>
        <Button variant="subtle" size="sm" onClick={() => onOpenAttendance(session.id)}>
          حضور و غیاب این جلسه
        </Button>
      </div>
    </Surface>
  );
}
