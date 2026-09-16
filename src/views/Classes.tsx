import { useMemo, useState } from "react";
import { Archive, CalendarDays, Pencil, Plus, UserPlus, Users } from "lucide-react";
import type { InstrumentId } from "@/domains/instruments/types";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/domains/scheduling/weekdays";
import type { AcademyClass } from "@/domains/classes/types";
import type { Enrollment } from "@/domains/enrollments/types";
import { useEnrollments } from "@/domains/enrollments/useEnrollments";
import { useRooms } from "@/domains/rooms/useRooms";
import type { Room } from "@/domains/rooms/types";
import { addDays, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { useStudentList } from "@/domains/students";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { faNum, faPercent, faTime, faToman, NO_DATA } from "@/lib/format";
import { meanOf, ratioPct, topBy } from "@/lib/stats";
import { useApp } from "@/context/AppContext";
import { Button, InstrumentGlyph, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, Segmented, StatStrip } from "@/components/ds/patterns";
import { ErrorState } from "@/components/ds/states";
import { useClasses } from "@/domains/classes/useClasses";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { EnrollmentDialog } from "@/domains/enrollments/EnrollmentDialog";
import { getClassRepository } from "@/domains/registry";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { apiErrorFromThrown } from "@/api/errors";
import { academyIsoDate, academyWeekdayIndex } from "@/views/relations/academyDay";
import { indexById } from "@/views/relations/indexById";
import { paymentBadge } from "./Students";
import { cn } from "@/utils/cn";

/**
 * WHAT A CLASS READ FROM THE FIXTURE, AND WHAT IT READS NOW.
 *
 * The class surface used to render the fixture layer: `teacherById(c.teacherId)`
 * for the instructor, `rooms.find(...)` for the studio, `students.filter((s) =>
 * c.studentIds.includes(s.id))` for the roster, `weekSessions.filter(...)` for
 * the weekly panel, and the fixture `rooms` array for the studio list. Each of
 * those is now a repository read:
 *
 *   - the instructor name from `useTeachers`, once, indexed with `indexById`;
 *   - the studio name, kind and capacity from `useRooms` — the same rows the
 *     rooms panel draws, so a renamed room reads the same in both places;
 *   - the ROSTER from Enrollment, the canonical Student↔Class relation (§9):
 *     `AcademyClass.studentIds` is a denormalized projection, so it cannot
 *     express a seat that was released and re-taken, and it is never read here.
 *     Seat counts, the waitlist and the capacity meter are the same relation's
 *     answer, which is why they move when an enrollment write lands;
 *   - the weekly panel from one windowed `useSessions({ classId, from, to })`
 *     read over the Sat→Fri week containing the academy's own day, with each
 *     column a real date rather than a frozen weekday index.
 *
 * WHAT DELIBERATELY DID NOT CHANGE: `attendanceAvg`, `termProgress`, `tuition`,
 * `capacity` and the room's own `occupancy` are fields of the rows the
 * repositories serve. They are not relations, nothing here may re-derive them,
 * and no contract exists that would answer them differently. The two numbers
 * that were NOT row fields — the trend deltas on seat occupancy and average
 * attendance — are gone, because nothing in this build measured a change.
 *
 * Empty, loading and unavailable stay three different things; a read that
 * returned fewer rows than it counted says «N ردیف از M» instead of passing a
 * page off as the whole set; and an unresolved teacher or room renders «—».
 * Demo mode is not special-cased: it serves the seed through the same hooks.
 */

/** Rows per relation read. Stated, never inherited from the API default. */
const RELATIONS_PER_PAGE = 200;

/** A class's own fill, from the seat counts the enrollment relation reports. */
const fullness = (seats: number, capacity: number) => (capacity > 0 ? Math.round((seats / capacity) * 100) : 0);

/** A read that returned fewer rows than it counted. */
function partialNote(name: string, shown: number, total: number): string | null {
  return total > shown ? `${name}: ${faNum(shown)} ردیف از ${faNum(total)}` : null;
}

/** Joins the honest caveats of a panel into one line, and nothing when there are none. */
const notesOf = (notes: readonly (string | null)[]): string =>
  notes.filter((note): note is string => Boolean(note)).join(" · ");

/** Seat holders and waiters per class, from enrollment rows. */
function seatsByClass(enrollments: readonly Enrollment[], status: Enrollment["status"]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of enrollments) {
    if (row.status !== status) continue;
    counts.set(row.classId, (counts.get(row.classId) ?? 0) + 1);
  }
  return counts;
}

function CapacityDots({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  return (
    <span className="flex items-center gap-1" title={`${enrolled} از ${capacity}`}>
      {Array.from({ length: capacity }).map((_, i) => (
        <span
          key={i}
          className={cn("block size-1.5 rounded-full", i < enrolled ? "bg-gold-500" : "bg-white/[0.12]")}
          style={{ animation: `fade-in 300ms var(--ease-legato) ${i * 45}ms both` }}
        />
      ))}
    </span>
  );
}

/** Chronological order within a day, so the week reads like a timetable. */
function byStart(a: Session, b: Session): number {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id);
}

/* ------------------------------------------------------------------ */
function ClassCard({
  c,
  seats,
  waiting,
  teacherName,
  roomName,
  onOpen,
}: {
  c: AcademyClass;
  /** Seat holders from the enrollment relation, or `null` when the read was partial. */
  seats: number | null;
  waiting: number | null;
  teacherName: string;
  roomName: string;
  onOpen: () => void;
}) {
  const pct = seats === null ? null : fullness(seats, c.capacity);
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-4 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/[0.07] text-gold-400">
          <InstrumentGlyph kind={c.instrument} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{c.title}</div>
          <div className="mt-1 truncate text-[11.5px] text-ink-300">
            {c.level} · {c.kind === "group" ? "گروهی" : "خصوصی"}
          </div>
        </div>
        {waiting !== null && waiting > 0 && <StatusBadge tone="violet" label={`${faNum(waiting)} در انتظار`} glyph={false} />}
      </div>

      {/* schedule rhythm — the class row's own recurrence, not a session list */}
      <div className="flex items-center gap-1.5">
        {WEEKDAYS_SHORT.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex h-6 flex-1 items-center justify-center rounded-md text-[10px]",
              c.days.includes(i) ? "bg-gold-500/15 font-medium text-gold-300" : "bg-white/[0.03] text-ink-600",
            )}
          >
            {d}
          </span>
        ))}
        <span className="nums mr-1 shrink-0 text-[11.5px] text-ink-200">{faTime(c.time)}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-ink-400">ظرفیت</span>
            <span className="nums text-ink-100">{seats === null ? `${NO_DATA} از ${faNum(c.capacity)}` : `${faNum(seats)} از ${faNum(c.capacity)}`}</span>
          </div>
          <Meter value={pct ?? 0} tone={pct !== null && pct >= 90 ? "warn" : pct !== null && pct >= 60 ? "gold" : "violet"} />
        </div>
        {seats === null ? <span className="nums text-[11px] text-ink-500">{NO_DATA}</span> : <CapacityDots enrolled={seats} capacity={c.capacity} />}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 text-ink-400">
          <Avatar name={teacherName} size="xs" />
          <span className="truncate">{teacherName}</span>
        </span>
        <span className="shrink-0 text-ink-400">{roomName}</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
function ClassDetail({
  c,
  teacherName,
  onEdit,
  onEnroll,
  onArchived,
}: {
  c: AcademyClass;
  /** Resolved by the shell from the teachers repository; «—» when it does not. */
  teacherName: string;
  onEdit: () => void;
  onEnroll: () => void;
  onArchived: () => void;
}) {
  const { navigate, notify } = useApp();
  const [archiveBusy, setArchiveBusy] = useState(false);

  /**
   * The academy's own day, and the week it anchors: شنبه → جمعه, the same
   * Saturday-first week `class.days`, the recurrence and the weekday columns
   * use. The fixture's `weekSessions` had no dates at all — its "week" was a row
   * template that rendered identically on every day of the year.
   */
  const today = academyIsoDate();
  const weekStart = addDays(today, -academyWeekdayIndex()) ?? today;
  const weekEnd = addDays(weekStart, WEEKDAYS.length - 1) ?? weekStart;

  /* ---------------- relation reads ----------------
    Every one of them is bounded, and the two that answer "what is in THIS
    class" carry `classId`/`from`/`to` so the reads are scoped rather than
    filtered from a global page.

    The students read is deliberately NOT class-scoped, for the reason CP3
    documented for the teacher surface: `useStudentList` is the one list hook
    without the render-time query-identity invariant (OPEN_ITEMS I13), so this
    surface keeps its key constant, takes membership from the key-safe
    enrollment read, resolves rows BY ID from it, and mounts under the class's
    own identity key (see `ClassesView`) — a class switch can therefore never
    show the previous class's roster.
  */
  const enrollments = useEnrollments({ classId: c.id, per_page: RELATIONS_PER_PAGE });
  const rooms = useRooms({ per_page: RELATIONS_PER_PAGE });
  const sessions = useSessions({ classId: c.id, from: weekStart, to: weekEnd, per_page: RELATIONS_PER_PAGE });
  const studentRows = useStudentList({ per_page: RELATIONS_PER_PAGE });

  const roomIndex = useMemo(() => indexById(rooms.items), [rooms.items]);
  const studentIndex = useMemo(() => indexById(studentRows.students), [studentRows.students]);

  const activeEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "active"), [enrollments.items]);
  const waitlistedEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "waitlist"), [enrollments.items]);

  const memberIds = useMemo(() => new Set(activeEnrollments.map((row) => row.studentId)), [activeEnrollments]);
  const roster = useMemo(
    () => studentRows.students.filter((row) => memberIds.has(row.id)),
    [studentRows.students, memberIds],
  );
  /** A member the students read did not return is reported, never silently dropped. */
  const missingMembers = useMemo(() => [...memberIds].filter((id) => !studentIndex.has(id)).length, [memberIds, studentIndex]);
  const mySessions = useMemo(
    () => sessions.items.filter((row) => row.classId === c.id).sort(byStart),
    [sessions.items, c.id],
  );

  /**
   * Whether each read covered the whole set it counted. A partial page still
   * renders what it holds — it may not present a count as if it had counted.
   */
  const enrollmentsComplete = enrollments.total === enrollments.items.length;
  const studentsComplete = studentRows.total === studentRows.students.length;
  const seats = activeEnrollments.length;
  const waiting = waitlistedEnrollments.length;
  const pct = fullness(seats, c.capacity);

  /**
   * A member is "not found" only when the students read actually covered the
   * set it counted. On a partial page a missing row may simply be outside the
   * page, which the panel says instead — that is a different fact.
   */
  const missing = studentsComplete ? missingMembers : 0;

  const room = roomIndex.get(c.roomId);
  const sessionNote = partialNote("جلسه‌ها", sessions.items.length, sessions.total);
  const relationNote = notesOf([
    partialNote("ثبت‌نام‌ها", enrollments.items.length, enrollments.total),
    partialNote("هنرجویان", studentRows.students.length, studentRows.total),
    partialNote("اتاق‌ها", rooms.items.length, rooms.total),
  ]);
  const missingNote = missing > 0 ? `${faNum(missing)} هنرجو در خواندن هنرجویان یافت نشد` : null;

  /** Archive is non-destructive: history and enrollments are preserved. */
  const archive = async () => {
    setArchiveBusy(true);
    try {
      await getClassRepository().archive(c.id);
      notify({ tone: "success", title: `${c.title} بایگانی شد`, detail: "کلاس از فهرست فعال حذف شد اما سوابق آن باقی می‌ماند." });
      onArchived();
    } catch (cause) {
      notify({ tone: "danger", title: "بایگانی انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setArchiveBusy(false);
    }
  };

  const relationsLoading = enrollments.loading || rooms.loading || sessions.loading || studentRows.loading;
  const relationsError = enrollments.error ?? rooms.error ?? sessions.error ?? studentRows.error;
  const reloadRelations = () => {
    enrollments.reload();
    rooms.reload();
    sessions.reload();
    studentRows.reload();
  };

  if (relationsLoading) return <LoadingState className="py-32" label="در حال خواندن ثبت‌نام‌ها و برنامهٔ این کلاس…" />;
  if (relationsError)
    return (
      <EmptyState
        className="py-32"
        title="خواندن اطلاعات این کلاس ناموفق بود"
        description={relationsError.message}
        action="تلاش دوباره"
        onAction={reloadRelations}
      />
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "کلاس‌ها", onClick: () => navigate({ view: "classes" }) }, { label: c.title }]}
        kicker={instrumentName(c.instrument)}
        title={c.title}
        description={`${c.kind === "group" ? "کلاس گروهی" : "کلاس خصوصی"} · ${c.level} · ${faNum(c.duration)} دقیقه در هر جلسه`}
        meta={
          <>
            <span>{c.days.map((d) => WEEKDAYS[d]).join(" و ")} · {faTime(c.time)}</span>
            {/* A room or teacher outside the read is «—», never an invented name. */}
            <span>{room ? `${room.name} — ${room.kind}` : NO_DATA}</span>
            <span>مدرس: {teacherName}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "attendance" })}>
              <Users className="size-3.5" /> حضور و غیاب
            </Button>
            <Button size="sm" variant="subtle" onClick={onEdit}>
              <Pencil className="size-3.5" /> ویرایش
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void archive()} disabled={archiveBusy || c.status === "archived"}>
              <Archive className="size-3.5" /> {c.status === "archived" ? "بایگانی‌شده" : "بایگانی"}
            </Button>
            <Button size="sm" variant="primary" onClick={onEnroll}>
              <UserPlus className="size-3.5" /> ثبت‌نام هنرجو
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Surface className="flex items-center gap-4 p-5">
          <ProgressRing value={pct} size={64} tone={pct >= 90 ? "warn" : "gold"}>
            <span className="nums text-[13px] font-semibold text-ink-50">{faPercent(pct)}</span>
          </ProgressRing>
          <div>
            <div className="text-[11.5px] text-ink-300">اشغال ظرفیت</div>
            <div className="nums mt-1 text-[13px] text-ink-100">
              {enrollmentsComplete ? `${faNum(seats)} از ${faNum(c.capacity)} صندلی` : `${NO_DATA} از ${faNum(c.capacity)} صندلی`}
            </div>
            {waiting > 0 && <div className="mt-1 text-[11px] text-violet-300">{faNum(waiting)} نفر در لیست انتظار</div>}
          </div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-5">
          <div className="text-[11.5px] text-ink-300">میانگین حضور</div>
          <div className="nums text-xl font-semibold leading-none text-ink-50">{faPercent(c.attendanceAvg)}</div>
          <Meter value={c.attendanceAvg} tone={c.attendanceAvg >= 90 ? "ok" : "warn"} />
        </Surface>
        <Surface className="flex flex-col justify-center gap-2 p-5">
          <div className="text-[11.5px] text-ink-300">پیشرفت دوره</div>
          <div className="nums text-xl font-semibold leading-none text-ink-50">{faPercent(c.termProgress)}</div>
          <Meter value={c.termProgress} tone="gold" />
          <div className="nums text-[11px] text-ink-400">شهریه: {faToman(c.tuition)}</div>
        </Surface>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Panel
          title="هنرجویان کلاس"
          className="lg:col-span-2"
          aside={<span className="nums text-[11px] text-ink-400">{enrollmentsComplete ? `${faNum(roster.length)} نفر` : NO_DATA}</span>}
        >
          {roster.length === 0 ? (
            /*
              Three different facts, three different panels: no active seat in
              this class; seats exist but the students read did not return them;
              or the reads were partial (the note below). The middle case must
              not be reported as an empty class.
            */
            missing > 0 ? (
              <EmptyState
                title="فهرست هنرجویان این کلاس خوانده نشد"
                description={`${faNum(missing)} هنرجو در خواندن هنرجویان یافت نشد؛ عضویت آن‌ها از ثبت‌نام کلاس می‌آید.`}
              />
            ) : (
              <EmptyState title="هنوز هنرجویی ثبت‌نام نکرده" description="ظرفیت این کلاس کامل خالی است." action="افزودن هنرجو" onAction={onEnroll} />
            )
          ) : (
            <ul className="space-y-2">
              {roster.map((s) => (
                <ListRow
                  key={s.id}
                  lead={<Avatar name={s.name} size="sm" />}
                  title={s.name}
                  meta={`${s.level} · حضور ${faPercent(s.attendance)}`}
                  end={paymentBadge(s.payment)}
                  onClick={() => navigate({ view: "students", id: s.id })}
                />
              ))}
              {Array.from({ length: Math.max(0, c.capacity - roster.length) }).map((_, i) => (
                <li key={`empty-${i}`} className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.07] px-3.5 py-3 text-[12px] text-ink-500">
                  <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-white/[0.1]">
                    <Plus className="size-3.5" />
                  </span>
                  صندلی خالی
                </li>
              ))}
            </ul>
          )}
          {(relationNote || missingNote) && (
            <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">{notesOf([relationNote || null, missingNote])}</p>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="جلسات هفته">
            {mySessions.length === 0 ? (
              <EmptyState title="جلسه‌ای در این هفته نیست" />
            ) : (
              <ul className="space-y-2">
                {mySessions.map((row) => {
                  const day = weekdayIndex(row.date);
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px]">
                      <span className="text-ink-100">{day === null ? NO_DATA : WEEKDAYS[day]}</span>
                      <span className="nums text-ink-300">{faTime(row.startTime)}–{faTime(row.endTime)}</span>
                      {row.status === "cancelled" ? (
                        <StatusBadge tone="neutral" label={SESSION_STATUS_LABEL.cancelled} cancelled />
                      ) : row.status === "completed" ? (
                        <StatusBadge tone="ok" label={SESSION_STATUS_LABEL.completed} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {sessionNote && <p className="mt-3 text-[11px] text-ink-400">{sessionNote}</p>}
            <Button size="sm" variant="subtle" className="mt-3 w-full" onClick={() => navigate({ view: "schedule" })}>
              <CalendarDays className="size-3.5" /> مشاهده در تقویم
            </Button>
          </Panel>
          {waiting > 0 && (
            <Panel title="لیست انتظار" kicker={`${faNum(waiting)} نفر منتظر بازهٔ خالی`}>
              {/*
                There is no "new slot suggestion" to record — nothing in the
                product persists one and nothing routes to scheduling — so the
                button no longer claims either (H2). It now performs the only
                truthful action available: opening the schedule, where a free
                slot can actually be looked for. Real session generation
                (`previewGeneration` / `generateSessions`) has since landed with
                M4's scheduling wiring — in the schedule view's «تولید جلسات»
                dialog (`src/views/scheduling/GenerateSessionsDialog.tsx`), not
                here. This button still only navigates, and still claims nothing.
              */}
              <Button size="sm" variant="subtle" className="w-full" onClick={() => navigate({ view: "schedule" })}>
                <CalendarDays className="size-3.5" /> بررسی در برنامه‌ریزی
              </Button>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The roster: classes as cards, and the academy's own rooms           */
/* ------------------------------------------------------------------ */
function ClassesRoster({
  classes,
  teacherIndex,
  onAdd,
}: {
  classes: AcademyClass[];
  teacherIndex: ReadonlyMap<string, { name: string }>;
  onAdd: () => void;
}) {
  const { navigate } = useApp();
  const [query, setQuery] = useState("");
  const [inst, setInst] = useState<InstrumentId | "all">("all");
  // Filter chips enumerate the live instrument catalogue, so an academy's own
  // instruments are filterable and a deactivated one stops offering itself.
  const instrumentFilters = useInstrumentCatalog().filter((i) => i.active);
  const [kind, setKind] = useState<"all" | "group" | "private">("all");
  const [sort, setSort] = useState<"fullness" | "waitlist">("fullness");

  /*
    Two bounded reads carry the numbers that are RELATIONS rather than row
    fields: the seats each class holds (Enrollment) and the studios the academy
    actually has (Room). Neither changes with a filter, so there is no key to go
    stale; both are stated with an explicit page size.
  */
  const enrollments = useEnrollments({ per_page: RELATIONS_PER_PAGE });
  const rooms = useRooms({ per_page: RELATIONS_PER_PAGE });

  const seats = useMemo(() => seatsByClass(enrollments.items, "active"), [enrollments.items]);
  const waiting = useMemo(() => seatsByClass(enrollments.items, "waitlist"), [enrollments.items]);
  const roomIndex = useMemo(() => indexById(rooms.items), [rooms.items]);

  /** A partial enrollment page cannot answer "how many seats does this class hold". */
  const enrollmentsComplete = enrollments.total === enrollments.items.length;
  const seatsOf = (id: string) => (enrollmentsComplete ? (seats.get(id) ?? 0) : null);
  const waitingOf = (id: string) => (enrollmentsComplete ? (waiting.get(id) ?? 0) : null);

  const list = useMemo(() => {
    const out = classes.filter(
      (c) =>
        (inst === "all" || c.instrument === inst) &&
        (kind === "all" || c.kind === kind) &&
        (query === "" || c.title.includes(query) || (teacherIndex.get(c.teacherId)?.name.includes(query) ?? false)),
    );
    return out.sort((a, b) =>
      sort === "fullness"
        ? fullness(seats.get(b.id) ?? 0, b.capacity) - fullness(seats.get(a.id) ?? 0, a.capacity)
        : (waiting.get(b.id) ?? 0) - (waiting.get(a.id) ?? 0),
    );
  }, [classes, inst, kind, query, sort, teacherIndex, seats, waiting]);

  const relationsLoading = enrollments.loading || rooms.loading;
  const relationsError = enrollments.error ?? rooms.error;
  const reloadRelations = () => {
    enrollments.reload();
    rooms.reload();
  };

  if (relationsLoading) return <LoadingState className="py-32" label="در حال خواندن ثبت‌نام‌ها و اتاق‌ها…" />;
  if (relationsError)
    return (
      <ErrorState
        className="py-32"
        title="خواندن ثبت‌نام‌ها و اتاق‌های آموزشگاه ناموفق بود"
        description={relationsError.message}
        onRetry={reloadRelations}
      />
    );

  const totalSeats = classes.reduce((a, b) => a + b.capacity, 0);
  const taken = enrollmentsComplete ? classes.reduce((a, b) => a + (seats.get(b.id) ?? 0), 0) : null;
  const queue = enrollmentsComplete ? classes.reduce((a, b) => a + (waiting.get(b.id) ?? 0), 0) : null;
  // Derived from the live rows, never hardcoded: in an environment with no
  // classes there is no occupancy ratio, no average attendance and no "most
  // waitlisted" class. Each of those has to read as absent («—», no hint)
  // rather than as 0٪, «NaN٪» or the name of a record that does not exist.
  const mostWaitlisted =
    enrollmentsComplete && queue !== null && queue > 0 ? topBy(classes, (c) => waiting.get(c.id) ?? 0, (c) => (waiting.get(c.id) ?? 0) > 0) : null;
  const pageNote = notesOf([
    partialNote("ثبت‌نام‌ها", enrollments.items.length, enrollments.total),
    partialNote("اتاق‌ها", rooms.items.length, rooms.total),
  ]);

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="کلاس‌ها"
        description="هر کلاس یک واحد زندهٔ آموزشگاه است — ظرفیت، ریتم هفتگی و کیفیت حضور آن را اینجا ببینید."
        actions={
          <Button size="sm" variant="primary" onClick={onAdd}>
            <Plus className="size-3.5" /> کلاس جدید
          </Button>
        }
      />

      <StatStrip
        stats={[
          { label: "کلاس فعال", value: faNum(classes.length), hint: `${faNum(classes.filter((c) => c.kind === "group").length)} گروهی · ${faNum(classes.filter((c) => c.kind === "private").length)} خصوصی` },
          // No trend delta: `delta: 3.4` asserted a change in seat occupancy that
          // nothing in this build measured.
          {
            label: "اشغال صندلی",
            value: taken === null ? NO_DATA : faPercent(ratioPct(taken, totalSeats)),
            hint: taken === null ? "خواندن کامل نبود" : `${faNum(taken)} از ${faNum(totalSeats)}`,
          },
          {
            label: "لیست انتظار",
            value: queue === null ? NO_DATA : faNum(queue),
            tone: "violet",
            hint: mostWaitlisted ? `بیشترین: ${mostWaitlisted.title}` : undefined,
          },
          // The average is over the rows' own `attendanceAvg`; the fabricating
          // `delta: 2.1` beside it is gone.
          { label: "میانگین حضور", value: faPercent(meanOf(classes, (c) => c.attendanceAvg)) },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی کلاس یا مدرس…" />}
        trailing={
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: "fullness", label: "پرترین" },
              { value: "waitlist", label: "لیست انتظار" },
            ]}
          />
        }
        chips={
          <>
            <Chip label="همه" active={kind === "all" && inst === "all"} onClick={() => { setKind("all"); setInst("all"); }} />
            <Chip label="گروهی" active={kind === "group"} count={classes.filter((c) => c.kind === "group").length} onClick={() => setKind(kind === "group" ? "all" : "group")} />
            <Chip label="خصوصی" active={kind === "private"} count={classes.filter((c) => c.kind === "private").length} onClick={() => setKind(kind === "private" ? "all" : "private")} />
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {instrumentFilters.map((i) => (
              <Chip key={i.id} tone="violet" label={i.name} active={inst === i.id} count={classes.filter((c) => c.instrument === i.id).length} onClick={() => setInst(inst === i.id ? "all" : i.id)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState title="کلاسی پیدا نشد" description="با این فیلترها کلاسی وجود ندارد." action="بازنشانی" onAction={() => { setInst("all"); setKind("all"); setQuery(""); }} />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <ClassCard
                key={c.id}
                c={c}
                seats={seatsOf(c.id)}
                waiting={waitingOf(c.id)}
                teacherName={teacherIndex.get(c.teacherId)?.name ?? NO_DATA}
                roomName={roomIndex.get(c.roomId)?.name ?? NO_DATA}
                onOpen={() => navigate({ view: "classes", id: c.id })}
              />
            ))}
          </div>
        )}
      </div>

      <Panel className="mt-5" title="اتاق‌ها" kicker="ظرفیت فیزیکی آموزشگاه و میزان استفاده از آن">
        {rooms.items.length === 0 ? (
          <EmptyState title="اتاقی ثبت نشده" description="هنوز اتاقی برای آموزشگاه ثبت نشده است." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.items.map((r: Room, i: number) => (
              <div key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-50">{r.name}</span>
                  <span className="nums text-[11px] text-ink-400">{faNum(r.capacity)} نفر</span>
                </div>
                <div className="mt-1 text-[11px] text-ink-400">{r.kind}</div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-ink-400">اشغال</span>
                  <span className="nums text-ink-100">{faPercent(r.occupancy)}</span>
                </div>
                <Meter value={r.occupancy} tone={r.occupancy < 65 ? "violet" : "gold"} className="mt-1.5" delay={i * 70} />
              </div>
            ))}
          </div>
        )}
        {pageNote && <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">{pageNote}</p>}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ClassesView() {
  const { detailId, navigate, notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();
  // Repository-backed. Archived classes are excluded by the repository unless
  // explicitly requested.
  const { items: classes, loading, error, reload } = useClasses({ per_page: RELATIONS_PER_PAGE });
  /*
    The instructor names are a relation: the class row carries `teacherId`, and
    the person is a row in the teachers repository. One bounded read serves the
    cards, the search box and the detail header, indexed once.
  */
  const teachers = useTeachers({ per_page: RELATIONS_PER_PAGE });
  const teacherIndex = useMemo(() => indexById(teachers.items), [teachers.items]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyClass | undefined>(undefined);
  const [enrollFor, setEnrollFor] = useState<string | undefined>(undefined);

  const detail = detailId ? classes.find((c) => c.id === detailId) : undefined;

  const dialogs = (
    <>
      <ClassFormDialog
        open={formOpen}
        academyClass={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `${saved.title} ساخته شد` : `${saved.title} به‌روزرسانی شد`,
            // The dialog awaited a real repository write, so the confirmation
            // may only name it demo data where it is demo data. In an EMPTY
            // environment these are the academy's own classes (H3).
            detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
          })
        }
      />
      <EnrollmentDialog
        open={enrollFor !== undefined}
        classId={enrollFor}
        onClose={() => setEnrollFor(undefined)}
        onEnrolled={(enrollment) =>
          notify({
            tone: "success",
            title: enrollment.status === "waitlist" ? "به لیست انتظار افزوده شد" : "ثبت‌نام انجام شد",
            detail: "ظرفیت کلاس به‌روزرسانی شد.",
          })
        }
      />
    </>
  );

  if (loading || teachers.loading) return <LoadingState className="py-32" label="در حال چیدن کلاس‌ها…" />;
  if (error || teachers.error) {
    const failure = error ?? teachers.error!;
    return (
      <ErrorState
        className="py-32"
        title={error ? "بارگذاری کلاس‌ها ناموفق بود" : "بارگذاری مدرسین ناموفق بود"}
        description={failure.message}
        onRetry={() => {
          reload();
          teachers.reload();
        }}
      />
    );
  }
  if (detail)
    return (
      <>
        {/*
          CONSUMER-LOCAL IDENTITY KEY (CP3/CP4)

          This detail's reads and its local state belong to ONE class, and it
          uses the un-keyed `useStudentList`. Keying the instance by the class
          id makes a switch a fresh mount, so the roster read can never hand this
          surface another class's page.
        */}
        <ClassDetail
          key={detail.id}
          c={detail}
          teacherName={teacherIndex.get(detail.teacherId)?.name ?? NO_DATA}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
          }}
          onEnroll={() => setEnrollFor(detail.id)}
          onArchived={() => navigate({ view: "classes" })}
        />
        {dialogs}
      </>
    );

  return (
    <>
      <ClassesRoster
        classes={classes}
        teacherIndex={teacherIndex}
        onAdd={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
      />
      {dialogs}
    </>
  );
}
