import { useCallback, useMemo, useState } from "react";
import { CalendarPlus, Download, LayoutGrid, MessageSquare, Music2, Pencil, Phone, Plus, Rows3, StickyNote, UserPlus, UserX, Wallet } from "lucide-react";
import type { InstrumentId } from "@/domains/instruments/types";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import { useAcademyNow } from "@/domains/shared/clock";
import { WEEKDAYS } from "@/domains/scheduling/weekdays";
import { paymentLabel, type PaymentStatus } from "@/lib/financeVocabulary";
import { studentStatusLabel, type ActivityEntry, type Student, type StudentStatus } from "@/domains/students/types";
import { useStudentList, useStudent } from "@/domains/students";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { getStudentRepository } from "@/domains/registry";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABEL, type AttendanceStatus } from "@/domains/attendance/types";
import { useAttendanceRecords } from "@/domains/attendance/useAttendance";
import { useClasses } from "@/domains/classes/useClasses";
import type { AcademyClass } from "@/domains/classes/types";
import { useEnrollments } from "@/domains/enrollments/useEnrollments";
import { useRooms } from "@/domains/rooms/useRooms";
import { addDays, isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { apiErrorFromThrown } from "@/api/errors";
import { NO_DATA, faNum, faPercent, faTime, faToman, parseTime } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, DataTable, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, Segmented, StatStrip, Tabs, type Column } from "@/components/ds/patterns";
import { StudentLearningPanel } from "@/domains/learning/StudentLearningPanel";
import { StudentProgressPanel } from "@/domains/progress/StudentProgressPanel";
import { academyIsoDate } from "@/views/relations/academyDay";
import { indexById } from "@/views/relations/indexById";
import { cn } from "@/utils/cn";

/**
 * Page sizes and the schedule window, stated rather than inherited.
 *
 * Every list this view reads carries an explicit page size: an unstated one is a
 * silently truncated page. The session read carries a date window on top of that
 * (`useSessions`), because a repository session list without one is not a read a
 * profile page may make — the demo seed alone holds a quarter of sessions.
 */
const RELATIONS_PER_PAGE = 200;
/** The attendance trail is shown newest-first and capped, not fetched whole. */
const ATTENDANCE_MARKS_PER_PAGE = 12;
/** How far ahead the profile looks for a class or a session. */
const SCHEDULE_WINDOW_DAYS = 28;
/** Columns of the weekly panel: today plus the six days after it. */
const WEEK_COLUMNS = 7;

/**
 * §30: never render a full national ID in a list/detail chrome. Only the last
 * four digits are shown; the full value stays in the domain layer.
 */
function maskNationalId(nationalId: string): string {
  const tail = nationalId.slice(-4);
  return `کد ملی ···${tail}`;
}

/**
 * Bar colour and height per status, for the mark chart below.
 *
 * The colours are the register's own vocabulary (`views/Attendance.tsx` maps the
 * same four statuses onto the same tones), so one status reads as one colour
 * across the product instead of one per view.
 */
const attendanceBar: Record<AttendanceStatus, string> = {
  present: "bg-ok-500/60",
  late: "bg-warn-500/60",
  absent: "bg-danger-500/50",
  excused: "bg-info-400/50",
};

/** Bar height per status: the chart's only encoding is "how full the bar is". */
const attendanceBarHeight: Record<AttendanceStatus, number> = {
  present: 44,
  late: 28,
  absent: 16,
  excused: 22,
};

const activityMeta: Record<ActivityEntry["kind"], { label: string; icon: typeof Music2; mark: string }> = {
  session: { label: "جلسه", icon: Music2, mark: "border-gold-500/25 bg-gold-500/[0.08] text-gold-400" },
  payment: { label: "پرداخت", icon: Wallet, mark: "border-ok-500/25 bg-ok-500/[0.08] text-ok-400" },
  note: { label: "یادداشت", icon: StickyNote, mark: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300" },
  enroll: { label: "ثبت‌نام", icon: UserPlus, mark: "border-info-400/25 bg-info-400/[0.08] text-info-400" },
  absence: { label: "غیبت", icon: UserX, mark: "border-warn-500/30 bg-warn-500/[0.08] text-warn-400" },
  message: { label: "پیام", icon: MessageSquare, mark: "border-white/[0.08] bg-white/[0.03] text-ink-300" },
};

/**
 * A session's state, read from the occurrence the repository returned.
 *
 * WHAT MAY BE DERIVED, AND WHAT MAY NOT
 *
 * `scheduled` / `cancelled` / `completed` are the session's own lifecycle — the
 * domain never infers `completed` from a clock, because a browser clock is
 * user-controlled and a past start time is not evidence that a class happened
 * (`domains/scheduling/types.ts`). So the label is the domain's own vocabulary,
 * and an occurrence whose window contains the academy's current minute is
 * «در حال برگزاری» — the same present-tense derivation the scheduling calendar
 * makes. A session whose time has passed with the register still saying
 * `scheduled` keeps saying «برنامهریزیشده»: «برگزار شد» would invent a fact.
 *
 * The legacy badge also read a `conflictWith` flag off the fixture template. The
 * repository's `Session` has no such field, conflicts belong to the domain's own
 * `checkConflicts`, and the scheduling calendar deliberately renders no conflict
 * badge on its rows — so there is none here either.
 */
function sessionBadge(session: Session, today: string, nowMinutes: number): { label: string; tone: Tone; live?: boolean; cancelled?: boolean } {
  if (session.status === "cancelled") {
    return { label: SESSION_STATUS_LABEL.cancelled, tone: "neutral", cancelled: true };
  }
  const start = parseTime(session.startTime);
  const end = parseTime(session.endTime);
  if (session.status === "scheduled" && session.date === today && start <= nowMinutes && nowMinutes < end) {
    return { label: "در حال برگزاری", tone: "ok", live: true };
  }
  return { label: SESSION_STATUS_LABEL[session.status], tone: session.status === "completed" ? "ok" : "gold" };
}

/** Chronological order, so "next" never depends on the repository's own sort. */
function byStart(a: Session, b: Session): number {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/**
 * The next class this student actually has: the earliest forthcoming occurrence
 * of a class they hold a seat in.
 *
 * Bounded twice — by the window the read was made with, and by the enrollment
 * relation rather than the class's denormalized `studentIds` (§9: the projection
 * is for display, Enrollment is the canonical Student↔Class link). Cancelled
 * occurrences are not upcoming classes, and an occurrence that already ended
 * today is not either. When nothing matches, the caller says so instead of
 * filling the slot from a fixture.
 */
function nextClassOf(
  sessions: readonly Session[],
  classIds: ReadonlySet<string>,
  today: string,
  nowMinutes: number,
): Session | undefined {
  return sessions
    .filter(
      (session) =>
        session.status === "scheduled" &&
        classIds.has(session.classId) &&
        (session.date > today || (session.date === today && parseTime(session.endTime) > nowMinutes)),
    )
    .sort(byStart)[0];
}

/** `count` academy days from `from`, inclusive, as ISO dates. */
function dayColumns(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index) ?? from);
}

/**
 * A class's own weekly recurrence, in the product's weekday vocabulary.
 *
 * `class.days` is written in the domain's Saturday-first convention, which is
 * also `WEEKDAYS`' order; the class row is the repository's, so this labels data
 * rather than asserting a schedule.
 */
function recurrenceLabel(klass: AcademyClass | undefined): string {
  if (!klass) return NO_DATA;
  const days = klass.days.map((index) => WEEKDAYS[index]).filter(Boolean);
  if (days.length === 0) return NO_DATA;
  return `${days.join(" و ")} · ${faTime(klass.time)}`;
}

const statusTone: Record<StudentStatus, Tone> = { active: "ok", "at-risk": "warn", paused: "neutral", waitlist: "violet" };
const paymentTone: Record<PaymentStatus, Tone> = { paid: "ok", due: "warn", overdue: "danger" };

export function paymentBadge(p: PaymentStatus) {
  return <StatusBadge tone={paymentTone[p]} label={paymentLabel[p]} />;
}

/* ------------------------------------------------------------------ */
/* Student card                                                        */
/* ------------------------------------------------------------------ */
function StudentCard({ s, teacherName, onOpen }: { s: Student; teacherName: string; onOpen: () => void }) {
  const remaining = s.sessionsTotal - s.sessionsUsed;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface group flex flex-col gap-4 p-4 text-right transition-all duration-[var(--sixteenth)] hover:border-white/[0.14] hover:bg-white/[0.02]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={s.name} size="md" ring={statusTone[s.status]} photoMediaId={s.photoMediaId} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{s.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-300">
            <InstrumentGlyph kind={s.instrument} className="size-3.5 text-gold-400" />
            {instrumentName(s.instrument)}
            <span className="text-ink-600">·</span>
            <span className="truncate">{s.level}</span>
          </div>
        </div>
        <StatusBadge tone={statusTone[s.status]} label={studentStatusLabel[s.status]} className="shrink-0" />
      </div>

      {s.status === "waitlist" ? (
        <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-[11.5px] text-violet-200">
          در انتظار بازهٔ خالی · ثبت {s.since}
        </p>
      ) : (
        <div className="grid grid-cols-3 items-end gap-3">
          <div>
            <div className="text-[10.5px] text-ink-400">جلسات</div>
            <div className="nums mt-1 text-sm font-semibold text-ink-50">
              {faNum(remaining)}
              <span className="text-[11px] font-normal text-ink-400"> از {faNum(s.sessionsTotal)}</span>
            </div>
            <Meter value={s.sessionsUsed} max={s.sessionsTotal} tone="neutral" size="sm" className="mt-1.5" />
          </div>
          <div>
            <div className="text-[10.5px] text-ink-400">حضور</div>
            <div className={cn("nums mt-1 text-sm font-semibold", s.attendance < 70 ? "text-warn-400" : "text-ink-50")}>{faPercent(s.attendance)}</div>
            <Meter value={s.attendance} tone={s.attendance < 70 ? "warn" : "ok"} size="sm" className="mt-1.5" />
          </div>
          <div>
            <div className="text-[10.5px] text-ink-400">پیشرفت</div>
            <div className="nums mt-1 text-sm font-semibold text-ink-50">{faPercent(s.progress)}</div>
            <Meter value={s.progress} tone="gold" size="sm" className="mt-1.5" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
        <span className="truncate text-[11px] text-ink-400">مدرس: {teacherName}</span>
        {paymentBadge(s.payment)}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Student detail workspace                                            */
/* ------------------------------------------------------------------ */
type DetailTab = "overview" | "learning" | "schedule" | "attendance" | "finance" | "notes" | "activity";

function StudentDetail({
  student,
  teacherNameOf,
  onEdit,
}: {
  student: Student;
  /** Teacher names from the repository read the list already made. */
  teacherNameOf: (teacherId: string) => string;
  onEdit: () => void;
}) {
  const { navigate, notify, openSheet } = useApp();
  const [statusBusy, setStatusBusy] = useState(false);

  /**
   * Pause/resume a student. This is a real repository write: if it fails the
   * user is told, and nothing claims success (§37).
   */
  const toggleStatus = async () => {
    const next = student.status === "paused" ? "active" : "paused";
    setStatusBusy(true);
    try {
      await getStudentRepository().update(student.id, { status: next });
      notify({
        tone: "success",
        title: next === "paused" ? `${student.name} متوقف شد` : `${student.name} فعال شد`,
        detail: "وضعیت در پروندهٔ هنرجو به‌روزرسانی شد.",
      });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setStatusBusy(false);
    }
  };
  const now = useAcademyNow();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [actFilter, setActFilter] = useState<ActivityEntry["kind"] | "all">("all");

  /**
   * The academy's own day, read once per render from the one clock
   * (`views/relations/academyDay.ts`). It anchors the session window and marks
   * today's column; the fixture's frozen `TODAY_INDEX` used to stand in for it.
   */
  const today = academyIsoDate();
  const windowEnd = addDays(today, SCHEDULE_WINDOW_DAYS - 1) ?? today;
  const weekEnd = addDays(today, WEEK_COLUMNS - 1) ?? today;

  /* ---------------- relation reads ---------------- */
  /*
    Every relation this profile shows, read from the domain that owns it:

      - the teacher name from `teachers` (once, in the list shell above);
      - the student's classes from `enrollments` — the canonical Student↔Class
        link — resolved against `classes`;
      - the timetable and the next class from `sessions`, over a dated window;
      - room names from `rooms`;
      - the attendance trail from `attendanceRecords`.

    All of them are bounded, none of them reads the demo store or a fixture
    collection, and each one is a real repository read in both environments
    (`demo` serves the seed through the same hooks — de-fixturing is re-pointing
    the read, not removing the demo data).
  */
  const enrollments = useEnrollments({ studentId: student.id, per_page: RELATIONS_PER_PAGE });
  const classes = useClasses({ per_page: RELATIONS_PER_PAGE });
  const rooms = useRooms({ per_page: RELATIONS_PER_PAGE });
  const sessions = useSessions({ from: today, to: windowEnd, per_page: RELATIONS_PER_PAGE });
  const marks = useAttendanceRecords({ studentId: student.id, per_page: ATTENDANCE_MARKS_PER_PAGE });

  const classIndex = useMemo(() => indexById(classes.items), [classes.items]);
  const roomIndex = useMemo(() => indexById(rooms.items), [rooms.items]);
  const roomNameOf = useCallback((roomId: string) => roomIndex.get(roomId)?.name ?? NO_DATA, [roomIndex]);

  /* ---------------- derived ---------------- */
  /** The classes the student holds a seat in — Enrollment's answer, not a projection. */
  const activeEnrollments = useMemo(
    () => enrollments.items.filter((enrollment) => enrollment.status === "active"),
    [enrollments.items],
  );
  const waitlistedEnrollments = useMemo(
    () => enrollments.items.filter((enrollment) => enrollment.status === "waitlist"),
    [enrollments.items],
  );
  const activeClassIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.classId)),
    [activeEnrollments],
  );

  /** The one windowed session read, filtered to the student's own classes. */
  const mySessions = useMemo(
    () => sessions.items.filter((session) => activeClassIds.has(session.classId)),
    [sessions.items, activeClassIds],
  );
  const nextClass = useMemo(
    () => nextClassOf(sessions.items, activeClassIds, today, now),
    [sessions.items, activeClassIds, today, now],
  );
  const nextClassRow = nextClass ? classIndex.get(nextClass.classId) : undefined;
  const thisWeekSessions = useMemo(
    () => mySessions.filter((session) => session.date >= today && session.date <= weekEnd),
    [mySessions, today, weekEnd],
  );
  /** Oldest first, so the chart reads right-to-left like the panel says it does. */
  const marksOldestFirst = useMemo(() => [...marks.items].reverse(), [marks.items]);
  const shownStatuses = useMemo(
    () => ATTENDANCE_STATUSES.filter((status) => marksOldestFirst.some((mark) => mark.status === status)),
    [marksOldestFirst],
  );

  const remaining = student.sessionsTotal - student.sessionsUsed;
  const visibleActivity = actFilter === "all" ? student.activity : student.activity.filter((a) => a.kind === actFilter);

  /**
   * A profile drawn from half-read relations would print «—» where a teacher's
   * name lives, and an empty timetable that is not empty. Both are worse than
   * waiting, and waiting is what the reads report honestly: `loading` is derived
   * from the query, not from a timer. A read that FAILED says so — an empty
   * answer and an unavailable one are different facts, and this page may not
   * present the second as the first.
   */
  const relationsLoading =
    enrollments.loading || classes.loading || rooms.loading || sessions.loading || marks.loading;
  const relationsError = enrollments.error ?? classes.error ?? rooms.error ?? sessions.error ?? marks.error;
  const reloadRelations = () => {
    enrollments.reload();
    classes.reload();
    rooms.reload();
    sessions.reload();
    marks.reload();
  };

  if (relationsLoading) return <LoadingState className="py-32" label="در حال خواندن پرونده و رابطه‌های آن…" />;
  if (relationsError)
    return (
      <EmptyState
        className="py-32"
        title="خواندن اطلاعات پرونده ناموفق بود"
        description={relationsError.message}
        action="تلاش دوباره"
        onAction={reloadRelations}
      />
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "هنرجویان", onClick: () => navigate({ view: "students" }) }, { label: student.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={student.name} size="md" ring={statusTone[student.status]} photoMediaId={student.photoMediaId} />
            {student.name}
            <StatusBadge tone={statusTone[student.status]} label={studentStatusLabel[student.status]} />
          </span>
        }
        description={`${instrumentName(student.instrument)} · ${student.level} · مدرس: ${teacherNameOf(student.teacherId)}`}
        meta={
          <>
            <span className="nums">{faNum(student.age)} ساله</span>
            {/* §9/§30: the national ID is a domain identifier, shown masked by
                default so it is not casually exposed on screen or in screenshots. */}
            <span className="nums" dir="ltr" title="کد ملی">{maskNationalId(student.nationalId)}</span>
            <span className="nums" dir="ltr">{student.phone}</span>
            {student.guardian && <span>ولی: {student.guardian}</span>}
            <span>عضو از {student.since}</span>
            <span>آخرین حضور: {student.lastSeen}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: `تماس با ${student.name}`, detail: "یادداشت تماس در پرونده ثبت می‌شود." })}>
              <Phone className="size-3.5" /> تماس
            </Button>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "messages" })}>
              <MessageSquare className="size-3.5" /> پیام
            </Button>
            <Button size="sm" variant="subtle" onClick={onEdit}>
              <Pencil className="size-3.5" /> ویرایش
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void toggleStatus()} disabled={statusBusy}>
              <UserX className="size-3.5" />
              {student.status === "paused" ? "فعال‌سازی" : "توقف موقت"}
            </Button>
            <Button size="sm" variant="primary" onClick={() => openSheet("payment")}>
              <Wallet className="size-3.5" /> ثبت پرداخت
            </Button>
          </>
        }
      />

      {/* Summary rail — the answer before the detail */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={(student.sessionsUsed / Math.max(student.sessionsTotal, 1)) * 100} size={56} tone={remaining <= 2 ? "warn" : "gold"}>
            <span className="nums text-sm font-semibold text-ink-50">{faNum(remaining)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-[11.5px] text-ink-300">جلسات باقی‌مانده</div>
            <div className="nums mt-0.5 text-[13px] text-ink-100">از {faNum(student.sessionsTotal)} جلسه</div>
            {remaining <= 3 && remaining > 0 && <div className="mt-1 text-[11px] text-warn-400">نزدیک به پایان دوره</div>}
          </div>
        </Surface>
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={student.attendance} size={56} tone={student.attendance < 70 ? "warn" : "ok"}>
            <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(student.attendance)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-[11.5px] text-ink-300">نرخ حضور</div>
            <div className="mt-0.5 text-[13px] text-ink-100">{student.attendance < 70 ? "کمتر از حد انتظار" : "وضعیت مطلوب"}</div>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-4">
          <div className="text-[11.5px] text-ink-300">وضعیت مالی</div>
          <div className="flex items-center gap-2">{paymentBadge(student.payment)}</div>
          <div className="nums text-[12.5px] text-ink-100">{student.balance > 0 ? `${faToman(student.balance)} مانده` : "بدون بدهی"}</div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-4">
          <div className="text-[11.5px] text-ink-300">پیشرفت دوره</div>
          <div className="nums text-lg font-semibold leading-none text-ink-50">{faPercent(student.progress)}</div>
          <Meter value={student.progress} tone="gold" />
        </Surface>
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "نمای کلی" },
          { value: "learning", label: "مسیر یادگیری" },
          { value: "schedule", label: "برنامه", count: thisWeekSessions.length },
          { value: "attendance", label: "حضور و غیاب" },
          { value: "finance", label: "مالی" },
          { value: "notes", label: "یادداشت‌ها", count: student.notes.length },
          { value: "activity", label: "فعالیت", count: student.activity.length },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/*
              «کلاس بعدی» is DERIVED, not stored: the earliest forthcoming
              occurrence of a class the student is actively enrolled in, from the
              windowed session read. The fixture's `student.nextClass` object
              (a day, a time and a room nothing could confirm) is gone, and so is
              the panel's silent fallback to it — when the window holds no
              session, the panel says which of the two honest reasons applies.
            */}
            <Panel title="کلاس بعدی" className="lg:col-span-1">
              {nextClass ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink-50">
                    <InstrumentGlyph kind={nextClassRow?.instrument ?? student.instrument} className="size-4 text-gold-400" />
                    <span className="truncate">{nextClassRow?.title ?? NO_DATA}</span>
                  </div>
                  <div className="nums mt-2 text-[13px] text-ink-200">
                    {isoToJalaliDisplay(nextClass.date, { weekday: "long", day: "numeric", month: "long" })} · {faTime(nextClass.startTime)}–{faTime(nextClass.endTime)}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-400">
                    {roomNameOf(nextClass.roomId)} · {teacherNameOf(nextClass.teacherId)}
                  </div>
                  <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => navigate({ view: "schedule" })}>
                    <CalendarPlus className="size-3.5" /> مشاهده در تقویم
                  </Button>
                </div>
              ) : activeClassIds.size === 0 ? (
                <EmptyState title="کلاسی برنامه‌ریزی نشده" description="این هنرجو هنوز در کلاس فعالی ثبت نشده است." action="برنامه‌ریزی کلاس" onAction={() => openSheet("class")} />
              ) : (
                <EmptyState
                  title="جلسه‌ای در پیش نیست"
                  description={`کلاس‌های فعال این هنرجو در ${faNum(SCHEDULE_WINDOW_DAYS)} روز آینده جلسه‌ای در تقویم ندارند.`}
                  action="برنامه‌ریزی کلاس"
                  onAction={() => openSheet("class")}
                />
              )}
            </Panel>

            {/*
              The fixture-driven "مهارت‌ها" meter that used to sit here has been
              removed. It rendered `student.skills` — static seed numbers — under
              the caption "ارزیابی مدرس", i.e. it presented invented values as a
              teacher's assessment (§38).

              Real, teacher-recorded progress lives on the «مسیر یادگیری» tab,
              derived from the immutable ProgressEvent log. It is deliberately
              NOT duplicated here: a second surface would drift from the log.
            */}

            <Panel
              title="آخرین فعالیت‌ها"
              className="lg:col-span-1"
              action="همهٔ فعالیت‌ها"
              onAction={() => setTab("activity")}
            >
              <ol className="space-y-3">
                {student.activity.slice(0, 3).map((a, i) => {
                  const meta = activityMeta[a.kind];
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border", meta.mark)}>
                        <meta.icon className="size-3.5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] leading-relaxed text-ink-100">{a.text}</div>
                        <div className="mt-0.5 text-[10.5px] text-ink-500">{a.date}</div>
                      </div>
                    </li>
                  );
                })}
                {student.activity.length === 0 && <EmptyState title="فعالیتی ثبت نشده" description="اولین جلسهٔ هنرجو در اینجا نمایش داده می‌شود." />}
              </ol>
            </Panel>
          </div>
        )}

        {/*
          The weekly panel is a DATED window of the center's own calendar: today
          plus six days, every column a real academy day and every row a session
          the scheduling repository returned for a class this student is enrolled
          in. It used to be the fixture's seven-row template — `weekSessions` from
          `@/data/records`, grouped by weekday index and marked with `TODAY_INDEX`
          — a schedule that rendered the same on every day of the year and
          belonged to no one in particular.

          The second panel used to carry TWO claims with no source at all: a
          preferred window («عصرها بعد از ۱۶:۰۰» — no student record has one) and
          the fixture's `nextClass`. It now lists what is actually known: the
          student's enrollments, resolved to classes, with the waitlist state the
          enrollment contract really maintains.
        */}
        {tab === "schedule" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="برنامهٔ هفتگی"
              kicker={`جلسه‌های ثبت‌شدهٔ مرکز برای کلاس‌های این هنرجو — ${isoToJalaliDisplay(today, { day: "numeric", month: "short" })} تا ${isoToJalaliDisplay(weekEnd, { day: "numeric", month: "short" })}`}
              className="lg:col-span-2"
            >
              {thisWeekSessions.length === 0 ? (
                <EmptyState
                  title="جلسه‌ای در این هفته ثبت نشده"
                  description={
                    activeClassIds.size === 0
                      ? "این هنرجو هنوز در کلاس فعالی ثبت نشده است."
                      : "برای کلاس‌های فعال این هنرجو در ۷ روز آینده جلسه‌ای در تقویم مرکز نیست."
                  }
                  action="برنامه‌ریزی کلاس"
                  onAction={() => openSheet("class")}
                />
              ) : (
                <ol className="space-y-5">
                  {dayColumns(today, WEEK_COLUMNS).map((date) => {
                    const daySessions = thisWeekSessions.filter((session) => session.date === date);
                    if (!daySessions.length) return null;
                    return (
                      <li key={date}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className={cn("text-[11.5px] font-medium", date === today ? "text-gold-300" : "text-ink-400")}>
                            {isoToJalaliDisplay(date, { weekday: "long", day: "numeric", month: "long" })}
                          </span>
                          {date === today && <StatusBadge tone="gold" label="امروز" glyph={false} />}
                          <span className="h-px flex-1 bg-white/[0.06]" aria-hidden />
                        </div>
                        <ul className="space-y-2">
                          {daySessions.map((session) => {
                            const klass = classIndex.get(session.classId);
                            const badge = sessionBadge(session, today, now);
                            return (
                              <li key={session.id}>
                                <button
                                  type="button"
                                  onClick={() => navigate({ view: "schedule" })}
                                  className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 text-right transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                                >
                                  <span className="nums w-12 shrink-0 text-sm font-medium text-ink-100">{faTime(session.startTime)}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <InstrumentGlyph kind={klass?.instrument ?? student.instrument} className="size-4 text-gold-400" />
                                      <span className="truncate text-[13px] font-medium text-ink-50">{klass?.title ?? NO_DATA}</span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11px] text-ink-400">
                                      {faTime(session.startTime)}–{faTime(session.endTime)} · {roomNameOf(session.roomId)} · {teacherNameOf(session.teacherId)}
                                    </span>
                                  </span>
                                  <StatusBadge tone={badge.tone} label={badge.label} live={badge.live} cancelled={badge.cancelled} className="shrink-0" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
            <Panel title="کلاس‌های فعال" kicker="از ثبت‌نام‌های همین هنرجو">
              {activeEnrollments.length === 0 && waitlistedEnrollments.length === 0 ? (
                <EmptyState
                  title="ثبت‌نام فعالی ثبت نشده"
                  description="این هنرجو هنوز در هیچ کلاسی جا نگرفته است."
                  action="ثبت‌نام در کلاس"
                  onAction={() => openSheet("class")}
                />
              ) : (
                <ul className="space-y-2">
                  {activeEnrollments.map((enrollment) => {
                    const klass = classIndex.get(enrollment.classId);
                    return (
                      <li key={enrollment.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-50">
                          <InstrumentGlyph kind={klass?.instrument ?? student.instrument} className="size-4 text-gold-400" />
                          <span className="truncate">{klass?.title ?? NO_DATA}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-ink-400">
                          {teacherNameOf(klass?.teacherId ?? "")} · {recurrenceLabel(klass)}
                        </div>
                      </li>
                    );
                  })}
                  {waitlistedEnrollments.map((enrollment) => {
                    const klass = classIndex.get(enrollment.classId);
                    return (
                      <li key={enrollment.id} className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] font-medium text-ink-100">{klass?.title ?? NO_DATA}</span>
                          <StatusBadge tone="violet" label="لیست انتظار" glyph={false} />
                        </div>
                        <div className="mt-1 text-[11px] text-violet-200">جا نگرفته است — منتظر بازهٔ خالی</div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button size="sm" variant="subtle" className="mt-4 w-full" onClick={() => openSheet("class")}>
                <CalendarPlus className="size-3.5" /> جابه‌جایی یا جلسهٔ جدید
              </Button>
            </Panel>
          </div>
        )}

        {tab === "activity" && (
          <Panel
            title="تاریخچهٔ کامل فعالیت"
            kicker="جلسات، پرداخت‌ها، یادداشت‌ها و پیام‌ها — در یک جریان"
            action="ثبت یادداشت"
            onAction={() => notify({ tone: "info", title: "ثبت یادداشت نیازمند سرور است", detail: "یادداشت‌ها هنوز ذخیره نمی‌شوند." })}
          >
            {student.activity.length > 0 && (
              <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-0.5">
                <Chip label="همه" active={actFilter === "all"} onClick={() => setActFilter("all")} />
                {(Object.keys(activityMeta) as ActivityEntry["kind"][]).map((k) => (
                  <Chip
                    key={k}
                    label={activityMeta[k].label}
                    tone={k === "absence" ? "gold" : "violet"}
                    active={actFilter === k}
                    count={student.activity.filter((a) => a.kind === k).length}
                    onClick={() => setActFilter(actFilter === k ? "all" : k)}
                  />
                ))}
              </div>
            )}
            {visibleActivity.length === 0 ? (
              <EmptyState title="فعالیتی با این فیلتر پیدا نشد" description="فیلتر را تغییر دهید یا فعالیت جدیدی ثبت کنید." />
            ) : (
              <ol className="space-y-1">
                {visibleActivity.map((a, i) => {
                  const meta = activityMeta[a.kind];
                  return (
                    <li key={i} className="relative flex gap-3.5">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", meta.mark)}>
                        <meta.icon className="size-3.5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1 pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] leading-relaxed text-ink-100">{a.text}</span>
                          <span className="text-[10px] text-ink-500">{meta.label}</span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-ink-500">{a.date}</div>
                      </div>
                      {i < visibleActivity.length - 1 && <span className="absolute right-4 top-9 h-[calc(100%-30px)] w-px bg-white/[0.07]" aria-hidden />}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        )}

        {/*
          Every column here is an ATTENDANCE RECORD the repository returned for
          this student — status, day and all. The panel it replaces drew twelve
          bars from `(i * 7 + student.attendance) % 10`: a series nothing ever
          recorded, labelled «جلسهٔ ۱…۱۲», with a three-colour legend and a
          caption «۱۲ جلسهٔ اخیر» describing sessions that did not exist. A demo
          academy has no attendance rows at all (the register writes them), so
          the honest rendering of an empty trail is the empty state below.
        */}
        {tab === "attendance" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="رکوردهای حضور"
              className="lg:col-span-2"
              kicker={
                marks.items.length === 0
                  ? "از دفتر حضور آموزشگاه"
                  : `از دفتر حضور آموزشگاه — آخرین ${faNum(marks.items.length)} رکورد از ${faNum(marks.total)} رکورد، از راست قدیمی به جدید`
              }
            >
              {marksOldestFirst.length === 0 ? (
                <EmptyState
                  title="رکورد حضوری ثبت نشده"
                  description="دفتر حضور آموزشگاه برای این هنرجو رکوردی ندارد. نرخ حضور زیر از پروندهٔ هنرجو است، نه از دفتر."
                  action="رفتن به حضور و غیاب"
                  onAction={() => navigate({ view: "attendance" })}
                />
              ) : (
                <>
                  <div className="flex items-end gap-1.5">
                    {marksOldestFirst.map((mark, index) => (
                      <div
                        key={mark.id}
                        className="flex flex-1 flex-col items-center gap-1.5"
                        title={`${ATTENDANCE_STATUS_LABEL[mark.status]} — ${isoToJalaliDisplay(mark.recordedAt.slice(0, 10), { day: "numeric", month: "long" })}`}
                      >
                        <div
                          className={cn("w-full rounded-md", attendanceBar[mark.status])}
                          style={{ height: attendanceBarHeight[mark.status], animation: `grow-y 400ms var(--ease-phrase) ${index * 40}ms both`, transformOrigin: "bottom" }}
                        />
                        <span className="nums text-[9px] text-ink-500">{isoToJalaliDisplay(mark.recordedAt.slice(0, 10), { day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                  {/*
                    The legend names only the statuses actually on screen: a
                    legend row for a mark this student has never been given
                    describes nothing.
                  */}
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
                    {shownStatuses.map((status) => (
                      <span key={status} className="flex items-center gap-1.5">
                        <i className={cn("size-2 rounded-sm", attendanceBar[status])} /> {ATTENDANCE_STATUS_LABEL[status]}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Panel>
            <Panel title="خلاصه">
              <ul className="space-y-2.5 text-[12.5px]">
                <li className="flex justify-between"><span className="text-ink-300">نرخ حضور</span><span className="nums text-ink-50">{faPercent(student.attendance)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">جلسات برگزارشده</span><span className="nums text-ink-50">{faNum(student.sessionsUsed)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">جلسات باقی‌مانده</span><span className="nums text-ink-50">{faNum(remaining)}</span></li>
                <li className="flex justify-between"><span className="text-ink-300">آخرین حضور</span><span className="text-ink-50">{student.lastSeen}</span></li>
              </ul>
              {student.attendance < 70 && (
                <div className="mt-4 rounded-xl border border-warn-500/25 bg-warn-500/[0.06] p-3 text-[11.5px] leading-relaxed text-warn-400">
                  نرخ حضور ثبت‌شده در پروندهٔ هنرجو کمتر از ۷۰٪ است؛ دفتر حضور آموزشگاه جزئیات را نشان می‌دهد.
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "finance" && (
          <Panel title="سوابق مالی" action="مشاهده در بخش مالی" onAction={() => navigate({ view: "finance" })}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">وضعیت جاری</div>
                <div className="mt-2">{paymentBadge(student.payment)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">مانده حساب</div>
                <div className="nums mt-2 text-sm font-semibold text-ink-50">{student.balance > 0 ? faToman(student.balance) : "۰ تومان"}</div>
              </div>
              {/*
                The tuition is the student's OWN enrollment plan — the per-term
                snapshot `Enrollment.pricingPlan`, which the enrollment domain
                already keeps as a contract. This card used to render the literal
                `3_600_000`: the tuition of fixture class `cl1`, charged to every
                student on every profile regardless of what they were enrolled in
                (or whether they were enrolled at all).
              */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] text-ink-400">شهریهٔ دوره</div>
                {activeEnrollments.length === 0 ? (
                  <>
                    <div className="nums mt-2 text-sm font-semibold text-ink-100">{NO_DATA}</div>
                    <div className="mt-1 text-[11px] text-ink-400">ثبت‌نامی برای محاسبهٔ شهریه وجود ندارد</div>
                  </>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {activeEnrollments.map((enrollment) => (
                      <li key={enrollment.id} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                        <span className="truncate text-ink-300">{classIndex.get(enrollment.classId)?.title ?? NO_DATA}</span>
                        <span className="nums shrink-0 font-semibold text-ink-50">{faToman(enrollment.pricingPlan.amount, true)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {student.activity.filter((a) => a.kind === "payment").map((a, i) => (
                <ListRow key={i} title={a.text} meta={a.date} end={<StatusBadge tone="ok" label="ثبت‌شده" />} />
              ))}
              {student.activity.filter((a) => a.kind === "payment").length === 0 && (
                <EmptyState title="پرداختی ثبت نشده" description="اولین پرداخت این هنرجو هنوز ثبت نشده است." action="ثبت پرداخت" onAction={() => openSheet("payment")} />
              )}
            </ul>
          </Panel>
        )}

        {tab === "learning" && (
          <div className="space-y-4">
            {/*
              Real placement + derived content access (LearningRepository).
              The previous hardcoded six-step ladder and the fixture-driven
              `levelStep` no longer decide what a student can see.
            */}
            <StudentLearningPanel studentId={student.id} studentName={student.name} />

            {/*
              Repertoire, practice history, analytics and recommendations, all
              computed from the immutable progress log. Rendered in the teacher
              role: this is the staff-facing workspace.
            */}
            <StudentProgressPanel studentId={student.id} studentName={student.name} role="teacher" />
          </div>
        )}

        {tab === "notes" && (
          <Panel title="یادداشت‌های مدرس و پذیرش" action="افزودن یادداشت" onAction={() => notify({ tone: "info", title: "ثبت یادداشت نیازمند سرور است", detail: "یادداشت‌ها هنوز ذخیره نمی‌شوند." })}>
            {student.notes.length === 0 ? (
              <EmptyState title="یادداشتی ثبت نشده" description="یادداشت‌های مدرس دربارهٔ پیشرفت و نیازهای هنرجو اینجا جمع می‌شود." action="افزودن یادداشت" onAction={() => notify({ tone: "info", title: "ثبت یادداشت نیازمند سرور است" })} />
            ) : (
              <ul className="space-y-3">
                {student.notes.map((n, i) => (
                  <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-gold-400">{n.by}</span>
                      <span className="text-ink-500">{n.date}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-100">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Students view                                                       */
/* ------------------------------------------------------------------ */
export function StudentsView() {
  const { filter, detailId, navigate, notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StudentStatus | "all">((filter as StudentStatus) ?? "all");
  const [instrument, setInstrument] = useState<InstrumentId | "all">("all");
  // Filter chips enumerate the live instrument catalogue, so an academy's own
  // instruments are filterable and a deactivated one stops offering itself.
  const instrumentFilters = useInstrumentCatalog().filter((i) => i.active);
  const [layout, setLayout] = useState<"cards" | "table">("cards");

  // Repository-backed: the view no longer imports the student fixture. Loading
  // state is the repository's real state, not a simulated delay.
  //
  // I16: detail/deep-link resolution must NOT rely on scanning a capped list.
  // `per_page: 200` is the list ceiling; an entity beyond it would be reported
  // as not-found. The owning repository already exposes `get(id)` which is the
  // authoritative single-record lookup. `useStudent(detailId)` is that lookup
  // with loading/error/not-found distinguishable.
  const { students, loading, error, reload } = useStudentList({ per_page: 200 });
  const { student: detailStudent, loading: detailLoading, error: detailError, reload: reloadDetail } = useStudent(
    detailId ?? undefined,
  );

  /**
   * The teacher relation, read once for the whole surface.
   *
   * A student row carries `teacherId`, and the name behind it belongs to the
   * teacher repository — the fixture's `teacherById` resolver answered that
   * lookup from `@/data/records` before. One bounded read serves the cards, the
   * table column and the profile header, because all three render inside this
   * component.
   *
   * `indexById` answers `undefined` for an id outside the loaded page, and the
   * honest rendering of an unknown name is `NO_DATA` («—»), never an invented
   * one. A FAILED teacher read is not a failed student list: the records the
   * repository did return still render, and the names it could not resolve say
   * so.
   */
  const teachers = useTeachers({ per_page: RELATIONS_PER_PAGE });
  const teachersById = useMemo(() => indexById(teachers.items), [teachers.items]);
  const teacherNameOf = useCallback(
    (teacherId: string) => teachersById.get(teacherId)?.name ?? NO_DATA,
    [teachersById],
  );

  // Create/edit are driven by one dialog; `editing` distinguishes the modes.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  /**
   * One confirmation for both places the dialog is mounted (list and detail),
   * so the copy cannot drift between them again — the duplicated literal is how
   * the demo label survived review in the first place.
   *
   * The dialog awaited a real repository write before calling this, so the only
   * environment-dependent part is the label: in an EMPTY environment these are
   * the academy's own students, not demo data (H3).
   */
  const savedToast = (saved: Student, mode: "create" | "edit") =>
    notify({
      tone: "success",
      title: mode === "create" ? `${saved.name} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
      detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
    });

  const list = useMemo(
    () =>
      students.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (instrument === "all" || s.instrument === instrument) &&
          (query === "" || s.name.includes(query) || instrumentName(s.instrument).includes(query)),
      ),
    [students, status, instrument, query],
  );

  // Stats are derived from the loaded dataset — never hardcoded totals.
  const stats = useMemo(
    () => ({
      active: students.filter((s) => s.status === "active").length,
      atRisk: students.filter((s) => s.status === "at-risk").length,
      waitlist: students.filter((s) => s.status === "waitlist").length,
      paused: students.filter((s) => s.status === "paused").length,
    }),
    [students],
  );

  // I16: list view still uses capped list; detail view uses authoritative get(id)
  const detailFromList = detailId ? students.find((s) => s.id === detailId) : undefined;
  // Prefer authoritative detail when available, fall back to list entry for backwards compat
  const detail = detailStudent ?? detailFromList;

  // When a deep-link is active, resolution is independent of the 200-row ceiling
  if (detailId) {
    if (detailLoading || teachers.loading) return <LoadingState className="py-32" label="در حال باز کردن پروندهٔ هنرجویان…" />;
    if (detailError) {
      if (detailError.kind === "not_found") {
        return (
          <EmptyState
            className="py-32"
            title="هنرجو یافت نشد"
            description="این پیوند به هنرجویی اشاره دارد که دیگر وجود ندارد."
            action="بازگشت به فهرست"
            onAction={() => navigate({ view: "students" })}
          />
        );
      }
      return (
        <ErrorState
          className="py-32"
          title="بارگذاری پروندهٔ هنرجو ناموفق بود"
          description={detailError.message}
          onRetry={reloadDetail}
        />
      );
    }
    if (!detail) {
      return (
        <EmptyState
          className="py-32"
          title="هنرجو یافت نشد"
          description="این پیوند به هنرجویی اشاره دارد که دیگر وجود ندارد."
          action="بازگشت به فهرست"
          onAction={() => navigate({ view: "students" })}
        />
      );
    }
    return (
      <>
        <StudentDetail
          student={detail}
          teacherNameOf={teacherNameOf}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
          }}
        />
        <StudentFormDialog
          open={formOpen}
          student={editing}
          onClose={() => setFormOpen(false)}
          onSaved={savedToast}
        />
      </>
    );
  }

  // List view: existing behavior and pagination remain unchanged
  if (loading || teachers.loading) return <LoadingState className="py-32" label="در حال باز کردن پروندهٔ هنرجویان…" />;
  if (error)
    return (
      <EmptyState
        className="py-32"
        title="بارگذاری هنرجویان ناموفق بود"
        description={error.message}
        action="تلاش دوباره"
        onAction={reload}
      />
    );

  const columns: Column<Student>[] = [
    {
      key: "name",
      header: "هنرجو",
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={s.name} size="sm" ring={statusTone[s.status]} photoMediaId={s.photoMediaId} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink-50">{s.name}</div>
            <div className="truncate text-[11px] text-ink-400">{s.level}</div>
          </div>
        </div>
      ),
    },
    { key: "instrument", header: "ساز", cell: (s) => <span className="text-ink-200">{instrumentName(s.instrument)}</span>, hideBelow: "sm" },
    { key: "teacher", header: "مدرس", cell: (s) => <span className="text-ink-300">{teacherNameOf(s.teacherId)}</span>, hideBelow: "md" },
    {
      key: "sessions",
      header: "جلسات",
      cell: (s) => <span className="nums text-ink-200">{s.sessionsTotal ? `${faNum(s.sessionsTotal - s.sessionsUsed)} / ${faNum(s.sessionsTotal)}` : "—"}</span>,
      hideBelow: "md",
    },
    {
      key: "attendance",
      header: "حضور",
      cell: (s) => (s.sessionsTotal ? <Meter value={s.attendance} tone={s.attendance < 70 ? "warn" : "ok"} size="sm" label={faPercent(s.attendance)} className="w-24" /> : <span className="text-ink-500">—</span>),
      hideBelow: "lg",
    },
    { key: "payment", header: "مالی", cell: (s) => paymentBadge(s.payment) },
    { key: "status", header: "وضعیت", cell: (s) => <StatusBadge tone={statusTone[s.status]} label={studentStatusLabel[s.status]} />, align: "end" },
  ];

  return (
    <div>
      <PageHeader
        kicker="افراد"
        title="هنرجویان"
        description="پروندهٔ کامل هنرجویان، وضعیت حضور، پیشرفت و مالی — همه در یک نما."
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "خروجی CSV نیازمند سرور است", detail: "تولید فایل در سرور انجام می‌شود و در دمو فعال نیست." })}>
              <Download className="size-3.5" /> خروجی
            </Button>
            <Button size="sm" variant="primary" onClick={openCreate}>
              <Plus className="size-3.5" /> افزودن هنرجو
            </Button>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "هنرجوی فعال", value: faNum(stats.active), hint: "وضعیت فعال", onClick: () => setStatus("active") },
          { label: "در معرض ریزش", value: faNum(stats.atRisk), tone: "warn", hint: "بیش از ۲ هفته غیبت", onClick: () => setStatus("at-risk") },
          { label: "لیست انتظار", value: faNum(stats.waitlist), tone: "violet", hint: "نیازمند تماس", onClick: () => setStatus("waitlist") },
          { label: "متوقف‌شده", value: faNum(stats.paused), hint: "بدون جلسهٔ فعال" },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی نام هنرجو یا ساز…" />}
        trailing={
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              { value: "cards", label: <LayoutGrid className="size-3.5" />, hint: "نمای کارت" },
              { value: "table", label: <Rows3 className="size-3.5" />, hint: "نمای جدول" },
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={status === "all"} count={students.length} onClick={() => setStatus("all")} />
            {(Object.keys(studentStatusLabel) as StudentStatus[]).map((k) => (
              <Chip key={k} label={studentStatusLabel[k]} active={status === k} count={students.filter((s) => s.status === k).length} onClick={() => setStatus(k)} />
            ))}
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            <Chip label="همهٔ سازها" tone="violet" active={instrument === "all"} onClick={() => setInstrument("all")} />
            {instrumentFilters.map((i) => (
              <Chip key={i.id} tone="violet" label={i.name} active={instrument === i.id} count={students.filter((s) => s.instrument === i.id).length} onClick={() => setInstrument(i.id)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState
            title="هنرجویی با این فیلترها پیدا نشد"
            description="می‌توانید فیلترها را بازنشانی کنید یا هنرجوی جدیدی ثبت کنید."
            action="بازنشانی فیلترها"
            onAction={() => {
              setQuery("");
              setStatus("all");
              setInstrument("all");
            }}
          />
        ) : layout === "cards" ? (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <StudentCard key={s.id} s={s} teacherName={teacherNameOf(s.teacherId)} onOpen={() => navigate({ view: "students", id: s.id })} />
            ))}
          </div>
        ) : (
          <Surface className="p-2 sm:p-4">
            <DataTable rows={list} columns={columns} caption="فهرست هنرجویان" onRowClick={(s) => navigate({ view: "students", id: s.id })} />
          </Surface>
        )}
      </div>

      <StudentFormDialog
        open={formOpen}
        student={editing}
        onClose={() => setFormOpen(false)}
        onSaved={savedToast}
      />
    </div>
  );
}
