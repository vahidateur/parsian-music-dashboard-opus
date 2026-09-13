/**
 * Scheduling — the operational calendar.
 *
 * M4 / CP1: **reads only**. Every row on this screen is a `Session` from the
 * scheduling domain, read through `useSessions` for a real, bounded date window,
 * and labelled from the classes, rooms and teachers domains. The fixtures this
 * view used to render (`weekSessions`, `rooms`, `teachers`, `TODAY_INDEX` and the
 * `GridSession` shape from `src/data/records.ts`) are gone from it, and with them
 * the fabricated room-occupancy, room-pressure and free-slot narratives, which
 * described no data anyone had (H1a, H4).
 *
 * WHAT CP1 DELIBERATELY DOES NOT DO
 *
 *   - **No writes.** Reschedule, cancel and generate are M4's writes and belong to
 *     a later checkpoint, so this file calls no mutating verb and fires no
 *     notification of any kind: a success message here would be a claim about a
 *     write that did not happen (H2, and M2's rule that a control whose operation
 *     does not exist is removed rather than disabled).
 *   - **No conflict derivation.** Conflicts are the domain's (`conflicts.ts`
 *     through `checkConflicts`), and re-deriving overlap rules in a view would
 *     duplicate them and then disagree with them. So no conflict count, badge or
 *     card is rendered: an invented number would be worse than none. The
 *     `filter=conflict` deep link is honoured as real view state and says plainly
 *     what is not wired yet.
 *   - **No roster or generation preview.** Those derived reads arrive with the
 *     write workflows.
 *
 * HONESTY RULES THIS FILE FOLLOWS
 *
 *   - every read states its own `per_page` and a `from`/`to` window, and the view
 *     says so when the answer was truncated instead of looking complete (I16);
 *   - each read owns its own error: a failed read renders its own message with a
 *     retry and withholds what it would have offered, and is never rendered as an
 *     empty list (D12);
 *   - a session's status comes from `session.status`, never from its date — a past
 *     session that was not marked is still `scheduled`, and guessing "completed"
 *     from the clock would be a fabricated fact;
 *   - the selection is an **id**, and the session it points at is derived from the
 *     loaded page, so a window change cannot leave the previous window's session
 *     open in the drawer (I13).
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { Chip, Drawer, FilterBar, PageHeader, Segmented, StatStrip, type StatDef } from "@/components/ds/patterns";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { useClasses } from "@/domains/classes/useClasses";
import { instrumentName } from "@/domains/instruments/catalog";
import { useRooms } from "@/domains/rooms/useRooms";
import {
  addDays,
  datesInRange,
  durationMinutes,
  isoToJalaliDisplay,
  toMinutes,
  weekdayIndex,
} from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session, type SessionStatus } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { academyNow, useAcademyNow } from "@/domains/shared/clock";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { NO_DATA, faNum, faTime, minutesToFaTime, toFa } from "@/lib/format";
import { cn } from "@/utils/cn";

/**
 * Every read states its own ceiling rather than relying on the repository's
 * default page size, which would silently truncate the window (I16). 200 is the
 * house convention for "the whole list", and a bounded week is an order of
 * magnitude smaller — so when the view does report truncation, it is reporting a
 * real answer that did not fit, not its own default.
 */
const SESSIONS_PER_PAGE = 200;
const SUPPORT_PER_PAGE = 200;

/** Grid geometry. The bounds widen to fit the loaded sessions (see `gridBounds`). */
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const PX_PER_MIN = 1.05;

/**
 * Room colours are assigned by position in the loaded room list.
 *
 * They used to be keyed by the fixture ids `r1`–`r4`, which silently rendered an
 * unstyled block for any room that was not in that fixture — a real academy's
 * rooms have their own ids.
 */
const ROOM_TONES = [
  "border-gold-500/35 bg-gold-500/[0.10] text-gold-200",
  "border-violet-500/35 bg-violet-500/[0.10] text-violet-200",
  "border-info-400/30 bg-info-400/[0.09] text-info-400",
  "border-ok-500/30 bg-ok-500/[0.09] text-ok-400",
] as const;

/** A room the room read has not answered for: visible, but not dressed up. */
const UNKNOWABLE_TONE = "border-white/[0.10] bg-white/[0.04] text-ink-200";

const STATUS_TONE: Record<SessionStatus, Tone> = {
  scheduled: "ok",
  cancelled: "neutral",
  completed: "info",
};

/* ------------------------------------------------------------------ */
/* Local date helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * The academy clock's own calendar date as `YYYY-MM-DD`.
 *
 * `academyNow()` is the single source of "now" (frozen time of day in demo, the
 * real clock in production); this only reformats it. Local getters, not UTC: the
 * academy's day is the day on its own wall clock. No date library and no inline
 * `new Date()` anywhere in this view.
 */
function isoFromAcademyDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Saturday-first week start, using the domain's own weekday convention. */
function startOfWeek(iso: string): string {
  const index = weekdayIndex(iso);
  if (index === null) return iso;
  return addDays(iso, -index) ?? iso;
}

/** The two deep links this view understands; anything else is not its business. */
function isFocusFilter(value: string | undefined): value is "conflict" | "new-slot" {
  return value === "conflict" || value === "new-slot";
}

/** Whole-hour grid bounds that contain every loaded session. */
function gridBounds(items: readonly Session[]): { start: number; end: number; hours: number[] } {
  let start = DAY_START;
  let end = DAY_END;
  for (const session of items) {
    const from = toMinutes(session.startTime);
    const span = durationMinutes(session.startTime, session.endTime);
    if (from === null || span === null) continue;
    start = Math.min(start, from);
    end = Math.max(end, from + span);
  }
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;
  const hours: number[] = [];
  for (let hour = start / 60; hour <= end / 60; hour += 1) hours.push(hour);
  return { start, end, hours };
}

/* ------------------------------------------------------------------ */
/* One session on the grid                                             */
/* ------------------------------------------------------------------ */
function SessionBlock({
  session,
  title,
  roomName,
  teacherName,
  tone,
  dense,
  dayStart,
  live,
  onOpen,
}: {
  session: Session;
  /** The class title, or `NO_DATA` while the class read has not answered. */
  title: string;
  roomName: string;
  teacherName: string;
  tone: string;
  dense?: boolean;
  dayStart: number;
  /** True only while the academy clock is inside this session, today. */
  live: boolean;
  onOpen: () => void;
}) {
  const start = toMinutes(session.startTime);
  const span = durationMinutes(session.startTime, session.endTime);
  // A malformed time cannot be placed on a minute grid. Skipping it is the only
  // honest option: inventing a position would put a real session at a wrong time.
  if (start === null || span === null) return null;

  const top = (start - dayStart) * PX_PER_MIN;
  const height = Math.max(span * PX_PER_MIN, 26);
  const cancelled = session.status === "cancelled";

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ top, height, animation: `phrase-in 400ms var(--ease-phrase) ${(start - dayStart) / 12}ms both` }}
      className={cn(
        "absolute inset-x-0.5 flex flex-col justify-start overflow-hidden rounded-lg border px-1.5 py-1 text-right transition-all duration-[var(--sixteenth)] hover:z-10 hover:brightness-125",
        tone,
        cancelled && "border-dashed opacity-55",
      )}
      title={`${title} · ${faTime(session.startTime)}–${faTime(session.endTime)} · ${roomName}`}
    >
      <span className="flex items-center gap-1">
        {live && <span className="ring-live block size-1.5 shrink-0 rounded-full bg-ok-400" />}
        <span className={cn("truncate text-[10.5px] font-medium leading-tight", cancelled && "line-through")}>{title}</span>
      </span>
      {!dense && height > 44 && (
        <>
          <span className="nums mt-0.5 truncate text-[9.5px] opacity-80">
            {faTime(session.startTime)}–{faTime(session.endTime)}
          </span>
          <span className="truncate text-[9.5px] opacity-70">{teacherName}</span>
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */
export function SchedulingView() {
  const { filter, navigate, openSheet } = useApp();
  const now = useAcademyNow();
  const todayIso = useMemo(() => isoFromAcademyDate(academyNow()), []);

  // Seeded from the deep link, not corrected after the first render: arriving on
  // `?filter=conflict` and reading a week only to throw it away and read today
  // would be a wasted round trip on every entry.
  const [mode, setMode] = useState<"week" | "day">(isFocusFilter(filter) ? "day" : "week");
  /** The date the window is anchored on — a real ISO date, never a weekday index. */
  const [anchor, setAnchor] = useState<string>(todayIso);
  const [roomFilter, setRoomFilter] = useState<string | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState<string | "all">("all");
  /**
   * An id, not a `Session`: the session on screen is always derived from the page
   * that is loaded, so a window change closes the drawer instead of showing a
   * session that is no longer in view (I13).
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** What the deep link asked for. Real state; no write is attached to it. */
  const [intent, setIntent] = useState<"conflict" | "new-slot" | null>(isFocusFilter(filter) ? filter : null);

  /*
    `filter=conflict` and `filter=new-slot` are produced by the dashboard's
    attention panels and by the command palette, and this view used to ignore
    both. They now move the calendar to today's day view, which is the part of the
    intent a read-only checkpoint can honour: resolving a conflict needs the
    domain's conflict engine and creating a slot needs the generation writes, and
    neither is wired here yet.
  */
  useEffect(() => {
    if (isFocusFilter(filter)) {
      setIntent(filter);
      setMode("day");
      setAnchor(todayIso);
      return;
    }
    setIntent(null);
  }, [filter, todayIso]);

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: anchor };
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 6) ?? start };
  }, [mode, anchor]);

  const sessions = useSessions({
    from,
    to,
    per_page: SESSIONS_PER_PAGE,
    roomId: roomFilter === "all" ? undefined : roomFilter,
    teacherId: teacherFilter === "all" ? undefined : teacherFilter,
  });
  const classes = useClasses({ per_page: SUPPORT_PER_PAGE });
  const rooms = useRooms({ per_page: SUPPORT_PER_PAGE });
  const teachers = useTeachers({ per_page: SUPPORT_PER_PAGE });

  // Indexes over the reads, named for what they are: the fixture helpers of the
  // same shape in `src/data/records.ts` are called `classById`/`roomById`/
  // `teacherById`, and a view that reads the domains must not be mistaken for one
  // that reaches for them.
  const classIndex = useMemo(() => new Map(classes.items.map((c) => [c.id, c])), [classes.items]);
  const roomIndex = useMemo(() => new Map(rooms.items.map((r) => [r.id, r])), [rooms.items]);
  const teacherIndex = useMemo(() => new Map(teachers.items.map((t) => [t.id, t])), [teachers.items]);
  /** A room's colour is its position in the loaded list, so no id is assumed. */
  const roomTone = useMemo(() => {
    const tones = new Map<string, string>();
    rooms.items.forEach((room, index) => tones.set(room.id, ROOM_TONES[index % ROOM_TONES.length]));
    return tones;
  }, [rooms.items]);

  const days = useMemo(() => (mode === "week" ? datesInRange(from, to) : [anchor]), [mode, from, to, anchor]);

  const sessionsByDay = useMemo(() => {
    const buckets = new Map<string, Session[]>();
    for (const day of days) buckets.set(day, []);
    for (const session of sessions.items) {
      buckets.get(session.date)?.push(session);
    }
    return buckets;
  }, [days, sessions.items]);

  /* The selected session is derived, so it can only be one this page holds. */
  const selected = useMemo(
    () => (selectedId === null ? undefined : sessions.items.find((session) => session.id === selectedId)),
    [selectedId, sessions.items],
  );

  /** True when the window holds more sessions than this page returned. */
  const truncated = sessions.total > sessions.items.length;
  const settled = !sessions.loading && sessions.error === null;
  const filtersActive = roomFilter !== "all" || teacherFilter !== "all";

  const todayCount = useMemo(
    () => sessions.items.filter((session) => session.date === todayIso).length,
    [sessions.items, todayIso],
  );
  const cancelledCount = useMemo(
    () => sessions.items.filter((session) => session.status === "cancelled").length,
    [sessions.items],
  );

  const bounds = useMemo(() => gridBounds(sessions.items), [sessions.items]);
  const gridHeight = (bounds.end - bounds.start) * PX_PER_MIN;
  const nowTop = (now - bounds.start) * PX_PER_MIN;

  const windowLabel = `${isoToJalaliDisplay(from, { day: "numeric", month: "short" })} – ${isoToJalaliDisplay(to, {
    day: "numeric",
    month: "short",
  })}`;

  const stats: StatDef[] = settled
    ? truncated
      ? [
          {
            label: "جلسات این بازه",
            value: faNum(sessions.total),
            tone: "warn",
            hint: `${faNum(sessions.items.length)} جلسه نمایش داده شده است`,
          },
        ]
      : [
          { label: "جلسات این بازه", value: faNum(sessions.total), hint: windowLabel },
          // Only offered when today is inside the window: a zero for a week the
          // user navigated away from would read as "nothing happens today".
          ...(days.includes(todayIso)
            ? [{ label: "جلسات امروز", value: faNum(todayCount), hint: isoToJalaliDisplay(todayIso, { weekday: "long" }) }]
            : []),
          {
            label: "لغو شده",
            value: faNum(cancelledCount),
            tone: cancelledCount > 0 ? ("warn" as Tone) : ("ok" as Tone),
            hint: "در همین بازه",
          },
        ]
    : [];

  const shift = (by: number) => {
    const next = addDays(anchor, by);
    if (next !== null) setAnchor(next);
  };

  const titleOf = (session: Session) => classIndex.get(session.classId)?.title ?? NO_DATA;
  const roomNameOf = (session: Session) => roomIndex.get(session.roomId)?.name ?? NO_DATA;
  const teacherNameOf = (session: Session) => teacherIndex.get(session.teacherId)?.name ?? NO_DATA;

  const selectedClass = selected ? classIndex.get(selected.classId) : undefined;
  const selectedRoom = selected ? roomIndex.get(selected.roomId) : undefined;

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="برنامه‌ریزی"
        description="تقویم عملیاتی آموزشگاه — جلسات واقعی کلاس‌ها در بازهٔ انتخابی، با اتاق و مدرس هر جلسه."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "attendance" })}>
              <CalendarDays className="size-3.5" /> حضور امروز
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("class")}>
              <Plus className="size-3.5" /> بازهٔ جدید
            </Button>
          </>
        }
      />

      {intent === "conflict" && (
        <Surface className="mt-5 border-info-400/20 bg-info-400/[0.04] p-4">
          <p className="text-[12px] leading-relaxed text-ink-200">
            تقویم روی امروز تمرکز داده شد. بررسی تعارض اتاق و مدرس کار موتور تعارض دامنه است و هنگام
            نوشتن جلسه انجام می‌شود؛ در این نسخه که تنها خواندن متصل است، به این تقویم وصل نیست. آنچه
            نمایش داده شده جلسات واقعی همین بازه است.
          </p>
        </Surface>
      )}
      {intent === "new-slot" && (
        <Surface className="mt-5 border-info-400/20 bg-info-400/[0.04] p-4">
          <p className="text-[12px] leading-relaxed text-ink-200">
            تقویم روی امروز تمرکز داده شد. «بازهٔ جدید» فرم برنامه‌ریزی کلاس را باز می‌کند؛ آن فرم هنوز
            به سرور متصل نیست و چیزی ذخیره نمی‌کند، و خود نیز همین را می‌گوید. زمان‌بندی خودکار جلسات
            روی یک بازهٔ تاریخ، نوشتن واقعی دامنه است و در این نسخه انجام نمی‌شود.
          </p>
        </Surface>
      )}

      {stats.length > 0 && <StatStrip className="mt-5" columns={truncated ? "lg:grid-cols-1" : "lg:grid-cols-3"} stats={stats} />}

      {truncated && (
        <Surface className="mt-4 flex items-start gap-3 border-warn-500/25 bg-warn-500/[0.04] p-3.5">
          <p className="text-[12px] leading-relaxed text-ink-100">
            این بازه {faNum(sessions.total)} جلسه دارد؛ {faNum(sessions.items.length)} جلسه نمایش داده
            شده است. تقویم کامل نیست و شمارش روزها نشان داده نمی‌شود.
          </p>
        </Surface>
      )}

      {/* Each supporting read owns its own failure: its message, its retry, and
          whatever it would have offered is withheld rather than shown empty. */}
      {classes.error !== null && (
        <ErrorState
          className="mt-4"
          title="کلاس‌ها خوانده نشد"
          description={classes.error.message}
          onRetry={classes.reload}
        />
      )}
      {rooms.error !== null && (
        <ErrorState className="mt-4" title="اتاق‌ها خوانده نشد" description={rooms.error.message} onRetry={rooms.reload} />
      )}
      {teachers.error !== null && (
        <ErrorState
          className="mt-4"
          title="مدرسین خوانده نشد"
          description={teachers.error.message}
          onRetry={teachers.reload}
        />
      )}

      <FilterBar
        className="mt-5"
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Segmented value={mode} onChange={setMode} options={[{ value: "week", label: "هفته" }, { value: "day", label: "روز" }]} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={mode === "week" ? "هفتهٔ بعد" : "روز بعد"}
                onClick={() => shift(mode === "week" ? 7 : 1)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-300 hover:bg-white/[0.05]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-28 text-center text-[12px] font-medium text-ink-50">{windowLabel}</span>
              <button
                type="button"
                aria-label={mode === "week" ? "هفتهٔ قبل" : "روز قبل"}
                onClick={() => shift(mode === "week" ? -7 : -1)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-300 hover:bg-white/[0.05]"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            {anchor !== todayIso && (
              <Button size="sm" variant="ghost" onClick={() => setAnchor(todayIso)}>
                امروز
              </Button>
            )}
          </div>
        }
        chips={
          <>
            {/* A failed read offers no choices: chips are the room read's. */}
            {rooms.error === null && (
              <>
                <Chip label="همهٔ اتاق‌ها" active={roomFilter === "all"} onClick={() => setRoomFilter("all")} />
                {rooms.items.map((room) => (
                  <Chip
                    key={room.id}
                    label={room.name}
                    active={roomFilter === room.id}
                    onClick={() => setRoomFilter(roomFilter === room.id ? "all" : room.id)}
                  />
                ))}
              </>
            )}
            {teachers.error === null && teachers.items.length > 0 && (
              <>
                <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
                <Chip label="همهٔ مدرسین" tone="violet" active={teacherFilter === "all"} onClick={() => setTeacherFilter("all")} />
                {teachers.items.map((teacher) => (
                  <Chip
                    key={teacher.id}
                    tone="violet"
                    label={teacher.name}
                    active={teacherFilter === teacher.id}
                    onClick={() => setTeacherFilter(teacherFilter === teacher.id ? "all" : teacher.id)}
                  />
                ))}
              </>
            )}
          </>
        }
      />

      {/* Calendar */}
      {sessions.loading ? (
        <LoadingState className="mt-5" label="در حال خواندن جلسات این بازه…" />
      ) : sessions.error !== null ? (
        <ErrorState
          className="mt-5"
          title="جلسات این بازه خوانده نشد"
          description={sessions.error.message}
          onRetry={sessions.reload}
        />
      ) : sessions.items.length === 0 ? (
        <EmptyState
          className="mt-5"
          title="جلسه‌ای در این بازه نیست"
          description={
            filtersActive
              ? `برای ${windowLabel} با فیلترهای اتاق یا مدرس، جلسه‌ای پیدا نشد.`
              : `برای ${windowLabel} جلسه‌ای ثبت نشده است.`
          }
          action={filtersActive ? "بازنشانی فیلترها" : undefined}
          onAction={
            filtersActive
              ? () => {
                  setRoomFilter("all");
                  setTeacherFilter("all");
                }
              : undefined
          }
        />
      ) : (
        <Surface className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className={cn("min-w-[680px]", mode === "day" && "min-w-0")}>
              {/* header — real dates, so the labels move with the window */}
              <div className="flex border-b border-white/[0.07]" style={{ paddingRight: 44 }}>
                {days.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      "flex-1 border-s border-white/[0.05] px-2 py-2.5 text-center first:border-s-0",
                      day === todayIso && "bg-gold-500/[0.05]",
                    )}
                  >
                    <div className={cn("text-[12px] font-medium", day === todayIso ? "text-gold-300" : "text-ink-200")}>
                      {isoToJalaliDisplay(day, { weekday: "long" })}
                    </div>
                    <div className="nums mt-0.5 text-[10px] text-ink-500">
                      {isoToJalaliDisplay(day, { day: "numeric", month: "short" })}
                    </div>
                    {/* A per-day count over a truncated page would be a partial
                        breakdown presented as a whole one, so it is suppressed. */}
                    {!truncated && (
                      <div className="nums mt-0.5 text-[10px] text-ink-500">
                        {faNum(sessionsByDay.get(day)?.length ?? 0)} جلسه
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* body */}
              <div className="relative flex" style={{ height: gridHeight }}>
                {/* hour rail */}
                <div className="relative w-11 shrink-0">
                  {bounds.hours.map((hour) => (
                    <span
                      key={hour}
                      className="nums absolute right-1 -translate-y-1/2 text-[10px] text-ink-500"
                      style={{ top: (hour * 60 - bounds.start) * PX_PER_MIN }}
                    >
                      {toFa(hour)}
                    </span>
                  ))}
                </div>
                {/* grid lines */}
                <div className="relative flex flex-1">
                  {bounds.hours.map((hour) => (
                    <span
                      key={hour}
                      className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.045]"
                      style={{ top: (hour * 60 - bounds.start) * PX_PER_MIN }}
                    />
                  ))}
                  {days.map((day) => (
                    <div
                      key={day}
                      className={cn("relative flex-1 border-s border-white/[0.05] first:border-s-0", day === todayIso && "bg-gold-500/[0.025]")}
                    >
                      {(sessionsByDay.get(day) ?? []).map((session) => {
                        const start = toMinutes(session.startTime);
                        const span = durationMinutes(session.startTime, session.endTime);
                        return (
                          <SessionBlock
                            key={session.id}
                            session={session}
                            title={titleOf(session)}
                            roomName={roomNameOf(session)}
                            teacherName={teacherNameOf(session)}
                            tone={roomTone.get(session.roomId) ?? UNKNOWABLE_TONE}
                            dense={mode === "week"}
                            dayStart={bounds.start}
                            live={
                              day === todayIso &&
                              session.status === "scheduled" &&
                              start !== null &&
                              span !== null &&
                              start <= now &&
                              now < start + span
                            }
                            onOpen={() => setSelectedId(session.id)}
                          />
                        );
                      })}
                      {day === todayIso && nowTop >= 0 && nowTop <= gridHeight && (
                        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                          <div className="relative h-px bg-gold-400/70">
                            <span className="absolute -top-[3px] right-0 size-[7px] rounded-full bg-gold-400" />
                            <span className="nums absolute -top-2 left-1 rounded bg-ink-950/80 px-1 text-[9px] text-gold-300">
                              {minutesToFaTime(now)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-ink-400">
            {rooms.items.map((room) => (
              <span key={room.id} className="flex items-center gap-1.5">
                <i className={cn("size-2 rounded-sm border", roomTone.get(room.id))} /> {room.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-sm border border-dashed border-white/25" /> لغو شده
            </span>
          </div>
        </Surface>
      )}

      {/* Session drawer — one derived session, never a stored one */}
      <Drawer
        open={selected !== undefined}
        onClose={() => setSelectedId(null)}
        kicker="جلسه"
        title={selected ? titleOf(selected) : ""}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              بستن
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (selected) navigate({ view: "classes", id: selected.classId });
                setSelectedId(null);
              }}
            >
              پروندهٔ کلاس
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={STATUS_TONE[selected.status]}
                label={SESSION_STATUS_LABEL[selected.status]}
                cancelled={selected.status === "cancelled"}
              />
              <StatusBadge tone="neutral" label={roomNameOf(selected)} glyph={false} />
              {selected.origin === "manual" && <StatusBadge tone="violet" label="دستی" glyph={false} />}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {(
                [
                  ["روز", isoToJalaliDisplay(selected.date, { weekday: "long", day: "numeric", month: "long" })],
                  ["ساعت", `${faTime(selected.startTime)} – ${faTime(selected.endTime)}`],
                  ["مدرس", teacherNameOf(selected)],
                  ["ساز", selectedClass ? instrumentName(selectedClass.instrument) : NO_DATA],
                  [
                    "هنرجویان",
                    selectedClass ? `${faNum(selectedClass.enrolled)} از ${faNum(selectedClass.capacity)}` : NO_DATA,
                  ],
                  ["اتاق", selectedRoom?.kind ?? NO_DATA],
                ] as [string, string][]
              ).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10.5px] text-ink-400">{key}</dt>
                  <dd className="mt-1 text-ink-50">{value}</dd>
                </div>
              ))}
            </dl>
            {selected.status === "cancelled" && selected.cancelReason && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="text-[12px] font-medium text-ink-100">دلیل لغو</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">{selected.cancelReason}</p>
              </div>
            )}
            {selected.notes && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="text-[12px] font-medium text-ink-100">یادداشت</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">{selected.notes}</p>
              </div>
            )}
            {selectedClass && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11.5px] text-ink-300">
                <InstrumentGlyph kind={selectedClass.instrument} className="size-4 text-gold-400" />
                {selectedClass.level} · {selectedClass.kind === "group" ? "گروهی" : "خصوصی"}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
