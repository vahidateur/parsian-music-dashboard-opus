import { useMemo, useState } from "react";
import { CalendarDays, MessageSquare, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { EntityExportButton } from "@/domains/export/EntityExportButton";
import type { InstrumentId } from "@/domains/instruments/types";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/domains/scheduling/weekdays";
import { studentStatusLabel, type StudentStatus } from "@/domains/students/types";
import type { Teacher } from "@/domains/teachers/types";
import type { AcademyClass } from "@/domains/classes/types";
import { useClasses } from "@/domains/classes/useClasses";
import type { Enrollment } from "@/domains/enrollments/types";
import { useEnrollments } from "@/domains/enrollments/useEnrollments";
import { useRooms } from "@/domains/rooms/useRooms";
import { addDays } from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { useStudentList } from "@/domains/students";
import { faNum, faPercent, faTime, NO_DATA } from "@/lib/format";
import { meanOf } from "@/lib/stats";
import { useApp } from "@/context/AppContext";
import { useAuth, useCan } from "@/domains/auth/AuthContext";
import { Button, InstrumentGlyph, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { ConfirmDialog } from "@/components/ds/confirm";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Avatar, Chip, FilterBar, ListRow, Meter, PageHeader, Panel, ProgressRing, SearchInput, StatStrip, Tabs } from "@/components/ds/patterns";
import { ErrorState } from "@/components/ds/states";
import { useTeachers, useTeacher } from "@/domains/teachers/useTeachers";
import { TeacherFormDialog } from "@/domains/teachers/TeacherFormDialog";
import { getTeacherRepository } from "@/domains/registry";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { apiErrorFromThrown } from "@/api/errors";
import { academyIsoDate, academyWeekdayIndex } from "@/views/relations/academyDay";
import { indexById } from "@/views/relations/indexById";
import { cn } from "@/utils/cn";

/**
 * EVERY LIST THIS VIEW READS IS BOUNDED, AND EVERY RELATION COMES FROM A DOMAIN.
 *
 * What the view used to render was the fixture layer: `students.filter((s) =>
 * s.teacherId === teacher.id)` for the roster, `weekSessions` for today and for
 * the weekly grid, `classById(...)` for a class title, `s.roomId.replace("r",
 * "اتاق ")` for a room name, and the fixture `classes[].waitlist` projection for
 * the capacity panel — plus two numbers nothing measured (`delta: 11`, «۵ کلاس
 * نیازمند جایگزین»).
 *
 * Each of those is now a repository read or a derivation from one:
 *
 *   - a teacher's CLASSES from `useClasses({ teacherId })` — the read that scopes
 *     the selected teacher, so the surface cannot resolve another teacher's rows;
 *   - a teacher's STUDENTS from Enrollment — the canonical Student↔Class link —
 *     intersected with the student rows the students repository returns. The
 *     fixture relation was `Student.teacherId`, a denormalized convenience field
 *     that a student enrolled with two teachers cannot express; st11 is enrolled
 *     in t1's piano class and `teacherId` says t8, so the fixture answer and the
 *     enrollment answer genuinely differ, and the enrollment answer is the true
 *     one;
 *   - TODAY'S CLASSES and the WEEKLY GRID from one windowed `useSessions` read
 *     (`from` / `to` / `per_page`), filtered to the selected teacher, with class
 *     titles and room names resolved from the class and room repositories;
 *   - the WAITLIST from enrollment rows whose status is `waitlist`, not from a
 *     class's projected count;
 *   - the academy's own day from `academyIsoDate` / `academyWeekdayIndex`, which
 *     read the one clock — the fixture `TODAY_INDEX` is a frozen column number.
 *
 * Empty, loading and unavailable stay three different things: every read passes
 * through the design system's in-flight marker, a failed read says so with a
 * retry, a truncated read states how much of itself it is showing, and an
 * unresolved class or room renders «—» rather than a guess.
 *
 * Demo mode is not special-cased anywhere here: it serves the seed through the
 * same hooks, and de-fixturing means re-pointing the read, not removing the data.
 */

/** Rows per relation read. Stated, never inherited from the API default. */
const RELATIONS_PER_PAGE = 200;

const BLOCKS = ["صبح", "ظهر", "عصر", "شب"];

const statusMeta: Record<Teacher["status"], { label: string; tone: "ok" | "warn" | "violet" | "neutral" }> = {
  active: { label: "فعال", tone: "ok" },
  "absent-tomorrow": { label: "غیبت فردا", tone: "warn" },
  "light-load": { label: "ظرفیت آزاد", tone: "violet" },
  inactive: { label: "غیرفعال", tone: "neutral" },
};

/**
 * The student statuses' own vocabulary. The roster used to answer the question
 * with two cases — `at-risk` and «everything else is فعال» — which labelled a
 * paused or waitlisted student as active.
 */
const studentStatusTone: Record<StudentStatus, Tone> = {
  active: "ok",
  "at-risk": "warn",
  paused: "neutral",
  waitlist: "violet",
};

/**
 * A read that returned fewer rows than it counted: the panel says how much of
 * itself it is showing instead of passing a page off as the whole set.
 */
function partialNote(name: string, shown: number, total: number): string | null {
  return total > shown ? `${name}: ${faNum(shown)} ردیف از ${faNum(total)}` : null;
}

/** Joins the honest caveats of a panel into one line, and nothing when there are none. */
const notesOf = (notes: readonly (string | null)[]): string =>
  notes.filter((note): note is string => Boolean(note)).join(" · ");

/** Chronological order, so «ترتیب اجرا از صبح تا شب» does not depend on the repository's sort. */
function byStartTime(a: Session, b: Session): number {
  return a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id);
}

/**
 * The students holding a seat in a class of each teacher — the ENROLLMENT
 * relation, not `Student.teacherId` and not `AcademyClass.studentIds`.
 *
 * A student enrolled in two of a teacher's classes counts once; a student whose
 * class row is outside the loaded page is not counted at all (the caller states
 * that the page was partial rather than inventing a member).
 */
function membersByTeacher(
  enrollments: readonly Enrollment[],
  classIndex: ReadonlyMap<string, AcademyClass>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const teacherId = classIndex.get(enrollment.classId)?.teacherId;
    if (!teacherId) continue;
    const members = map.get(teacherId) ?? new Set<string>();
    members.add(enrollment.studentId);
    map.set(teacherId, members);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Availability grid — rhythm of a week                                */
/* ------------------------------------------------------------------ */
function AvailabilityGrid({ data, compact, todayIndex }: { data: number[][]; compact?: boolean; todayIndex: number }) {
  return (
    <div className="flex gap-1.5" dir="rtl">
      <div className="flex flex-col justify-around pl-1 text-[9px] text-ink-500">
        {BLOCKS.map((b) => (
          <span key={b} className={cn(compact && "leading-[14px]")}>{b}</span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {data.map((day, di) => (
          <div key={di} className="flex flex-col gap-1">
            {day.map((v, bi) => (
              <span
                key={bi}
                title={`${WEEKDAYS[di]} · ${BLOCKS[bi]} · ${v === 1 ? "پر" : v === 2 ? "خارج از دسترس" : "آزاد"}`}
                className={cn(
                  "block rounded-[3px]",
                  compact ? "h-3.5" : "h-4",
                  v === 1 ? "bg-gold-500/70" : v === 2 ? "bg-white/[0.03]" : "bg-ok-500/25",
                  // The academy's own weekday, not the fixture's frozen column.
                  di === todayIndex && "ring-1 ring-inset ring-white/15",
                )}
                style={{ animation: `fade-in 300ms var(--ease-legato) ${(di * 4 + bi) * 12}ms both` }}
              />
            ))}
            <span className={cn("mt-0.5 text-center text-[9px]", di === todayIndex ? "text-gold-400" : "text-ink-500")}>{WEEKDAYS_SHORT[di]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher card                                                        */
/* ------------------------------------------------------------------ */
function TeacherCard({
  t,
  studentCount,
  todayIndex,
  onOpen,
}: {
  t: Teacher;
  /**
   * Members from the enrollment relation, or `null` when the relation reads did
   * not cover the whole set — the card then shows «—» instead of a number it
   * cannot stand behind.
   */
  studentCount: number | null;
  todayIndex: number;
  onOpen: () => void;
}) {
  const meta = statusMeta[t.status];
  return (
    <button type="button" onClick={onOpen} className="surface group flex flex-col gap-4 p-4 text-right transition-all hover:border-white/[0.14] hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <Avatar name={t.name} size="md" ring={meta.tone} photoMediaId={t.photoMediaId} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-50">{t.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-300">
            <InstrumentGlyph kind={t.instrument} className="size-3.5 text-gold-400" />
            <span className="truncate">{t.title}</span>
          </div>
        </div>
        <StatusBadge tone={meta.tone} label={meta.label} className="shrink-0" />
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing value={t.utilization} size={52} tone={t.utilization < 60 ? "violet" : t.utilization > 90 ? "warn" : "gold"}>
          <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(t.utilization)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex justify-between text-[11.5px]">
            <span className="text-ink-400">بار کاری</span>
            <span className="nums text-ink-100">{faNum(t.weeklyHours)} از {faNum(t.contractHours)} ساعت</span>
          </div>
          <Meter value={t.weeklyHours} max={t.contractHours} tone={t.utilization < 60 ? "violet" : "gold"} />
          <div className="flex justify-between text-[11.5px]">
            <span className="text-ink-400">هنرجو</span>
            <span className="nums text-ink-100">{studentCount === null ? NO_DATA : `${faNum(studentCount)} نفر`}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.05] pt-3">
        <AvailabilityGrid data={t.availability} todayIndex={todayIndex} compact />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher workspace                                                   */
/* ------------------------------------------------------------------ */
function TeacherDetail({ teacher, onEdit }: { teacher: Teacher; onEdit: () => void }) {
  const { navigate, notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();
  const mayWrite = useCan("teachers.write");
  const [tab, setTab] = useState<"today" | "week" | "students" | "load">("today");
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Deleting a teacher is a real write, and the repository is the one that
   * decides whether it is allowed: a teacher still attached to classes is
   * refused (`TEACHER_HAS_CLASSES`) rather than orphaning them, and the refusal
   * is shown in the dialog that asked for it. Their login account — if the
   * academy gave them one — is closed by the same write, because a person who no
   * longer teaches here cannot keep signing in.
   */
  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await getTeacherRepository().delete(teacher.id);
      notify({
        tone: "success",
        title: `${teacher.name} حذف شد`,
        detail: "پروندهٔ مدرس و حساب ورود او از سامانه برداشته شد؛ سوابق جلسات و حضور و غیاب باقی می‌مانند.",
      });
      setConfirmDelete(false);
      navigate({ view: "teachers" });
    } catch (cause) {
      setDeleteError(apiErrorFromThrown(cause).message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Deactivation is reversible and non-destructive: the teacher keeps their
   * history but is excluded from new class assignment.
   */
  const toggleActive = async () => {
    const inactive = teacher.status === "inactive";
    setStatusBusy(true);
    try {
      const repository = getTeacherRepository();
      if (inactive) await repository.update(teacher.id, { status: "active" });
      else await repository.deactivate(teacher.id);
      notify({
        tone: "success",
        title: inactive ? `${teacher.name} فعال شد` : `${teacher.name} غیرفعال شد`,
        detail: inactive ? "برای تخصیص کلاس در دسترس است." : "از تخصیص کلاس‌های جدید کنار گذاشته شد؛ کلاس‌های قبلی دست‌نخورده‌اند.",
      });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setStatusBusy(false);
    }
  };
  const meta = statusMeta[teacher.status];

  /**
   * The academy's own day and the two windows it anchors, read once per render
   * from the one clock. The week runs شنبه → جمعه like `class.days`, the seeded
   * recurrence and the weekday columns all do, so a column is a real date
   * instead of a frozen fixture index.
   */
  const today = academyIsoDate();
  const todayIndex = academyWeekdayIndex();
  const weekStart = addDays(today, -todayIndex) ?? today;
  const weekEnd = addDays(weekStart, WEEKDAYS.length - 1) ?? weekStart;

  /* ---------------- relation reads ----------------
    The classes read carries `teacherId`: it is the read that scopes everything
    selected-teacher-dependent on this page, and `useClasses` answers a changed
    key with an empty page and an in-flight marker rather than with the previous
    key's rows.

    THE STUDENTS READ IS DELIBERATELY NOT TEACHER-SCOPED (CP3)

    `useStudentList` is the one list hook without the render-time query-identity
    invariant (`domains/shared/useResource.ts` documents it; the hook predates it
    — OPEN_ITEMS I13): after a params change it can commit one frame carrying the
    previous query's rows with `loading === false`. Fixing the shared hook is a
    separate issue and explicitly not part of M7, so this surface guards at the
    call site instead:

      - the params do not vary with the selected teacher, so the key never
        changes and a "previous query" cannot exist here;
      - membership comes from the enrollment relation, which is scoped by the
        key-safe classes read, and rows are resolved BY ID from it — the read
        can never offer a student as a member of this teacher;
      - `TeacherDetail` is mounted under a consumer-local identity key
        (`key={detail.id}` below), so a teacher change starts this hook's state
        at an empty page with `loading === true` rather than reusing it.

    Together those three make a teacher switch unable to show the previous
    teacher's students or count, in every frame — without touching the hook.
  */
  const classes = useClasses({ teacherId: teacher.id, per_page: RELATIONS_PER_PAGE });
  const enrollments = useEnrollments({ per_page: RELATIONS_PER_PAGE });
  const rooms = useRooms({ per_page: RELATIONS_PER_PAGE });
  const sessions = useSessions({ teacherId: teacher.id, from: weekStart, to: weekEnd, per_page: RELATIONS_PER_PAGE });
  const studentRows = useStudentList({ per_page: RELATIONS_PER_PAGE });

  const classIndex = useMemo(() => indexById(classes.items), [classes.items]);
  const roomIndex = useMemo(() => indexById(rooms.items), [rooms.items]);
  const studentIndex = useMemo(() => indexById(studentRows.students), [studentRows.students]);

  /* ---------------- derived ---------------- */
  const activeEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "active"), [enrollments.items]);
  const waitlistedEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "waitlist"), [enrollments.items]);

  /** Seat holders per class, from Enrollment — not from the class's projection. */
  const seatsByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of activeEnrollments) counts.set(enrollment.classId, (counts.get(enrollment.classId) ?? 0) + 1);
    return counts;
  }, [activeEnrollments]);

  /** The teacher's members: a seat in a class this teacher teaches. */
  const memberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const enrollment of activeEnrollments) if (classIndex.has(enrollment.classId)) ids.add(enrollment.studentId);
    return ids;
  }, [activeEnrollments, classIndex]);

  const myStudents = useMemo(
    () => studentRows.students.filter((row) => memberIds.has(row.id)),
    [studentRows.students, memberIds],
  );

  /** The class titles each member holds a seat in, for the row's own line. */
  const classesByStudent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const enrollment of activeEnrollments) {
      const klass = classIndex.get(enrollment.classId);
      if (!klass) continue;
      const titles = map.get(enrollment.studentId) ?? [];
      if (!titles.includes(klass.title)) titles.push(klass.title);
      map.set(enrollment.studentId, titles);
    }
    return map;
  }, [activeEnrollments, classIndex]);

  /** A member the students read did not return is reported, never silently dropped. */
  const missingMembers = useMemo(
    () => [...memberIds].filter((id) => !studentIndex.has(id)).length,
    [memberIds, studentIndex],
  );
  const waitingHere = useMemo(
    () => waitlistedEnrollments.filter((row) => classIndex.has(row.classId)).length,
    [waitlistedEnrollments, classIndex],
  );

  const mySessions = useMemo(
    () => sessions.items.filter((row) => row.teacherId === teacher.id),
    [sessions.items, teacher.id],
  );
  const todaySessions = useMemo(
    () => mySessions.filter((row) => row.date === today).sort(byStartTime),
    [mySessions, today],
  );
  const weekByDay = useMemo(
    () =>
      WEEKDAYS.map((_, day) => {
        const date = addDays(weekStart, day) ?? weekStart;
        return mySessions.filter((row) => row.date === date);
      }),
    [mySessions, weekStart],
  );
  const weekRows = useMemo(() => weekByDay.flat(), [weekByDay]);
  const weekCount = weekRows.filter((row) => row.status !== "cancelled").length;
  const weekCancelled = weekRows.length - weekCount;

  /**
   * Whether each read covered the whole set it counted. A partial page still
   * renders what it holds — it just may not present a number or a total as if it
   * had counted everything.
   */
  const classesComplete = classes.total === classes.items.length;
  const enrollmentsComplete = enrollments.total === enrollments.items.length;
  const studentsComplete = studentRows.total === studentRows.students.length;
  const relationsComplete = classesComplete && enrollmentsComplete && studentsComplete;

  const roomNameOf = (roomId: string) => roomIndex.get(roomId)?.name ?? NO_DATA;
  const classTitleOf = (classId: string) => classIndex.get(classId)?.title ?? NO_DATA;
  const seatsLabelOf = (classId: string) =>
    relationsComplete ? `${faNum(seatsByClass.get(classId) ?? 0)} هنرجو` : NO_DATA;

  const sessionNote = partialNote("جلسه‌ها", sessions.items.length, sessions.total);
  const relationNote = notesOf([
    partialNote("کلاس‌ها", classes.items.length, classes.total),
    partialNote("ثبت‌نام‌ها", enrollments.items.length, enrollments.total),
    partialNote("هنرجویان", studentRows.students.length, studentRows.total),
  ]);
  const missingNote = missingMembers > 0 ? `${faNum(missingMembers)} هنرجو در خواندن هنرجویان یافت نشد` : null;

  /**
   * Half-read relations would print «—» where a class title lives and an empty
   * timetable that is not empty. Waiting is what the reads report honestly, and a
   * read that FAILED says so: an empty answer and an unavailable one are
   * different facts.
   */
  const relationsLoading =
    classes.loading || enrollments.loading || rooms.loading || sessions.loading || studentRows.loading;
  const relationsError = classes.error ?? enrollments.error ?? rooms.error ?? sessions.error ?? studentRows.error;
  const reloadRelations = () => {
    classes.reload();
    enrollments.reload();
    rooms.reload();
    sessions.reload();
    studentRows.reload();
  };

  if (relationsLoading) return <LoadingState className="py-32" label="در حال خواندن برنامه و رابطه‌های این مدرس…" />;
  if (relationsError)
    return (
      <EmptyState
        className="py-32"
        title="خواندن رابطه‌های این مدرس ناموفق بود"
        description={relationsError.message}
        action="تلاش دوباره"
        onAction={reloadRelations}
      />
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "مدرسین", onClick: () => navigate({ view: "teachers" }) }, { label: teacher.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={teacher.name} size="md" ring={meta.tone} photoMediaId={teacher.photoMediaId} />
            {teacher.name}
            <StatusBadge tone={meta.tone} label={meta.label} />
          </span>
        }
        description={teacher.bio}
        meta={
          <>
            <span>{teacher.title}</span>
            <span className="nums" dir="ltr">{teacher.phone}</span>
            <span>همکاری از {teacher.since}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "messages" })}>
              <MessageSquare className="size-3.5" /> پیام
            </Button>
            <Button size="sm" variant="subtle" onClick={() => navigate({ view: "schedule", filter: `teacher:${teacher.id}` })}>
              <CalendarDays className="size-3.5" /> برنامهٔ کامل
            </Button>
            <Button size="sm" variant="subtle" onClick={onEdit}>
              <Pencil className="size-3.5" /> ویرایش
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void toggleActive()} disabled={statusBusy}>
              <UserX className="size-3.5" />
              {teacher.status === "inactive" ? "فعال‌سازی" : "غیرفعال‌سازی"}
            </Button>
            {mayWrite && (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger-400 hover:text-danger-400"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 className="size-3.5" /> حذف مدرس
              </Button>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        busy={deleting}
        error={deleteError}
        title={`حذف ${teacher.name}`}
        description="حذف، پروندهٔ مدرس را برمی‌دارد. اگر فقط می‌خواهید دیگر کلاس جدید به او اختصاص نیابد، غیرفعال‌سازی همان کار را بدون از بین بردن سابقه انجام می‌دهد."
        consequences={[
          "پروندهٔ مدرس از فهرست مدرسین برداشته می‌شود.",
          "حساب ورود او (در صورت وجود) بسته می‌شود.",
          "کلاسی که هنوز به این مدرس اختصاص دارد، حذف را متوقف می‌کند — نخست کلاس را واگذار کنید.",
          "جلسات، حضور و غیاب و سوابق مالی گذشته حذف نمی‌شوند.",
        ]}
        confirmLabel="حذف قطعی"
        onConfirm={() => void remove()}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Surface className="flex items-center gap-4 p-4">
          <ProgressRing value={teacher.utilization} size={56} tone={teacher.utilization < 60 ? "violet" : "gold"}>
            <span className="nums text-[11px] font-semibold text-ink-50">{faPercent(teacher.utilization)}</span>
          </ProgressRing>
          <div>
            <div className="text-[11.5px] text-ink-300">بهره‌وری</div>
            <div className="nums mt-0.5 text-[12.5px] text-ink-100">{faNum(teacher.weeklyHours)}/{faNum(teacher.contractHours)} ساعت</div>
          </div>
        </Surface>
        {[
          // The member count is the enrollment relation's answer. The teacher
          // record's own `students` field is a stored scalar with no writer, and
          // it is not the relation this page can stand behind.
          {
            label: "هنرجویان",
            value: relationsComplete ? faNum(myStudents.length) : NO_DATA,
            hint: relationsComplete ? "با ثبت‌نام فعال در کلاس‌های این مدرس" : "خواندن کامل نبود",
          },
          { label: "حضور کلاس‌ها", value: faPercent(teacher.attendanceRate), hint: "میانگین دوره" },
          { label: "ماندگاری هنرجو", value: faPercent(teacher.retention), hint: "۱۲ ماه گذشته" },
        ].map((s) => (
          <Surface key={s.label} className="flex flex-col justify-center gap-1.5 p-4">
            <div className="text-[11.5px] text-ink-300">{s.label}</div>
            <div className="nums text-xl font-semibold leading-none text-ink-50">{s.value}</div>
            <div className="text-[11px] text-ink-400">{s.hint}</div>
          </Surface>
        ))}
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "امروز", count: todaySessions.length },
          { value: "week", label: "برنامهٔ هفته" },
          // A partial read withholds the count rather than printing a lower bound
          // as if it were the roster.
          { value: "students", label: "هنرجویان", count: relationsComplete ? myStudents.length : undefined },
          { value: "load", label: "بار کاری و دسترسی" },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "today" && (
          <Panel title={`کلاس‌های امروز · ${WEEKDAYS[todayIndex]}`} kicker="ترتیب اجرا از صبح تا شب">
            {todaySessions.length === 0 ? (
              <EmptyState title="امروز کلاسی ندارد" description="این مدرس امروز در برنامهٔ آموزشگاه کلاسی ثبت نکرده است." />
            ) : (
              <>
                <ul className="space-y-2">
                  {todaySessions.map((row) => (
                    <ListRow
                      key={row.id}
                      lead={<span className="nums w-11 shrink-0 text-[13px] font-medium text-ink-100">{faTime(row.startTime)}</span>}
                      // A class row outside the loaded page prints «—»: the fixture
                      // resolver used to answer this question with a name of its own.
                      title={classTitleOf(row.classId)}
                      meta={`${roomNameOf(row.roomId)} · ${seatsLabelOf(row.classId)}`}
                      end={
                        <StatusBadge
                          tone={row.status === "cancelled" ? "neutral" : row.status === "completed" ? "ok" : "gold"}
                          label={SESSION_STATUS_LABEL[row.status]}
                        />
                      }
                      onClick={() => navigate({ view: "classes", id: row.classId })}
                    />
                  ))}
                </ul>
                {sessionNote && (
                  <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">{sessionNote}</p>
                )}
              </>
            )}
          </Panel>
        )}

        {tab === "week" && (
          <Panel title="برنامهٔ هفتگی" kicker="ستون‌ها از راست: شنبه تا جمعه">
            <div className="grid grid-cols-7 gap-2">
              {weekByDay.map((day, di) => (
                <div key={di} className={cn("rounded-xl border p-2", di === todayIndex ? "border-gold-500/30 bg-gold-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]")}>
                  <div className={cn("mb-2 text-center text-[10.5px]", di === todayIndex ? "font-medium text-gold-300" : "text-ink-400")}>{WEEKDAYS_SHORT[di]}</div>
                  <div className="space-y-1">
                    {day.length === 0 && <div className="py-2 text-center text-[9px] text-ink-600">—</div>}
                    {day.map((row) => (
                      <div
                        key={row.id}
                        className={cn(
                          "rounded-md border border-white/[0.07] bg-ink-800/70 px-1 py-1 text-center",
                          row.status === "cancelled" && "opacity-50",
                        )}
                        title={`${classTitleOf(row.classId)}${row.status === "cancelled" ? " · لغو شده" : ""}`}
                      >
                        <div className="nums text-[9.5px] text-ink-100">{faTime(row.startTime)}</div>
                        <div className="truncate text-[8.5px] text-ink-400">{roomNameOf(row.roomId)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11.5px] text-ink-300">
              مجموع <span className="nums text-ink-100">{faNum(weekCount)}</span> جلسه در هفتهٔ جاری
              {weekCancelled > 0 && <> · <span className="nums text-ink-100">{faNum(weekCancelled)}</span> لغو‌شده</>}
            </p>
            {sessionNote && <p className="mt-2 text-[11px] text-ink-400">{sessionNote}</p>}
          </Panel>
        )}

        {tab === "students" && (
          <Panel title="هنرجویان این مدرس" action="همهٔ هنرجویان" onAction={() => navigate({ view: "students" })}>
            {myStudents.length === 0 ? (
              /*
                Three different facts, three different panels: nobody holds a
                seat with this teacher; members exist but the students read did
                not return them; or the reads themselves were partial (the note
                below). Collapsing the middle case into the first would report a
                read that did not happen as a roster that does not exist.
              */
              missingMembers > 0 ? (
                <EmptyState
                  title="فهرست هنرجویان این مدرس خوانده نشد"
                  description={`${faNum(missingMembers)} هنرجو در خواندن هنرجویان یافت نشد؛ عضویت آن‌ها از ثبت‌نام کلاس‌ها می‌آید.`}
                />
              ) : (
                <EmptyState title="هنرجویی تخصیص نیافته" description="هنوز هنرجویی در کلاس‌های این مدرس ثبت‌نام فعال ندارد." />
              )
            ) : (
              <ul className="space-y-2">
                {myStudents.map((student) => {
                  const titles = classesByStudent.get(student.id) ?? [];
                  return (
                    <ListRow
                      key={student.id}
                      lead={<Avatar name={student.name} size="sm" ring={studentStatusTone[student.status]} photoMediaId={student.photoMediaId} />}
                      title={student.name}
                      meta={[`${instrumentName(student.instrument)} · ${student.level}`, titles.join("، ")]
                        .filter(Boolean)
                        .join(" · ")}
                      end={
                        <>
                          <Meter value={student.attendance} tone={student.attendance < 70 ? "warn" : "ok"} size="sm" label={faPercent(student.attendance)} className="hidden w-24 sm:flex" />
                          <StatusBadge tone={studentStatusTone[student.status]} label={studentStatusLabel[student.status]} />
                        </>
                      }
                      onClick={() => navigate({ view: "students", id: student.id })}
                    />
                  );
                })}
              </ul>
            )}
            {(relationNote || missingNote) && (
              <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
                {notesOf([relationNote || null, missingNote])}
              </p>
            )}
          </Panel>
        )}

        {tab === "load" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="در دسترس بودن" kicker="سبز: آزاد · طلایی: پر · خاکستری: خارج از دسترس">
              <AvailabilityGrid data={teacher.availability} todayIndex={todayIndex} />
              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-3 text-[11px] text-ink-400">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok-500/25" /> آزاد</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-gold-500/70" /> پر</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-white/[0.06]" /> خارج از دسترس</span>
              </div>
            </Panel>
            <Panel title="تحلیل بار کاری">
              <ul className="space-y-3">
                {[
                  { label: "ساعات هفتگی", value: teacher.weeklyHours, max: teacher.contractHours, tone: "gold" as const, text: `${faNum(teacher.weeklyHours)} از ${faNum(teacher.contractHours)}` },
                  { label: "بهره‌وری", value: teacher.utilization, max: 100, tone: teacher.utilization < 60 ? ("violet" as const) : ("ok" as const), text: faPercent(teacher.utilization) },
                  { label: "نرخ حضور کلاس‌ها", value: teacher.attendanceRate, max: 100, tone: "ok" as const, text: faPercent(teacher.attendanceRate) },
                ].map((r, i) => (
                  <li key={r.label}>
                    <div className="mb-1.5 flex justify-between text-[11.5px]">
                      <span className="text-ink-200">{r.label}</span>
                      <span className="nums text-ink-400">{r.text}</span>
                    </div>
                    <Meter value={r.value} max={r.max} tone={r.tone} delay={i * 80} />
                  </li>
                ))}
              </ul>
              {teacher.utilization < 60 && (
                <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
                  <div className="text-[10.5px] font-medium text-violet-300">فرصت</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-100">
                    {faNum(teacher.contractHours - teacher.weeklyHours)} ساعت ظرفیت آزاد در هفته.
                    {/*
                      The waitlist claim is the ENROLLMENT relation's, and it is only
                      made when it holds: the copy used to assert that «لیست انتظار
                      {ساز}» could move here whether or not anyone was waiting.
                    */}
                    {waitingHere > 0 && ` ${faNum(waitingHere)} نفر در لیست انتظار کلاس‌های این مدرس هستند.`}
                  </p>
                  <Button
                    size="sm"
                    variant="subtle"
                    className="mt-3"
                    onClick={() =>
                      notify({
                        tone: "info",
                        // The suggestion writes nothing anywhere; what it says about
                        // itself may only name demo mode where demo mode is what ran.
                        title: demoEnvironment ? "پیشنهاد فقط در دمو نمایش داده شد" : "ارسال پیشنهاد انجام نشد",
                        detail: "ارسال به برنامه‌ریزی به سرور نیاز دارد.",
                      })
                    }
                  >
                    پیشنهاد بازهٔ جدید
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */
function TeachersRoster({ teachers, onAdd }: { teachers: Teacher[]; onAdd: () => void }) {
  const { filter, navigate, notify } = useApp();
  let user: any = null;
  try { user = useAuth().user; } catch { user = null; }
  const canWriteTeachers = useCan("teachers.write") || !user;
  const [query, setQuery] = useState("");
  const [inst, setInst] = useState<InstrumentId | "all">("all");
  // Filter chips enumerate the live instrument catalogue, so an academy's own
  // instruments are filterable and a deactivated one stops offering itself.
  const instrumentFilters = useInstrumentCatalog().filter((i) => i.active);
  const [only, setOnly] = useState<"all" | "absent-tomorrow" | "low-utilization">(
    filter === "absent-tomorrow" ? "absent-tomorrow" : filter === "low-utilization" ? "low-utilization" : "all",
  );

  /* The academy's own day, and the read window it anchors. */
  const today = academyIsoDate();
  const todayIndex = academyWeekdayIndex();
  const tomorrow = addDays(today, 1) ?? today;

  /* ---------------- relation reads ----------------
    Three bounded reads carry every number below: today's and tomorrow's
    occurrences from `useSessions` (windowed, scoped per teacher at render), and
    the class + enrollment rows the capacity panel and the card counts derive
    from. None of them changes with a selected teacher, so there is no key to
    go stale.
  */
  const sessions = useSessions({ from: today, to: tomorrow, per_page: RELATIONS_PER_PAGE });
  const classes = useClasses({ per_page: RELATIONS_PER_PAGE });
  const enrollments = useEnrollments({ per_page: RELATIONS_PER_PAGE });

  const classIndex = useMemo(() => indexById(classes.items), [classes.items]);
  const activeEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "active"), [enrollments.items]);
  const waitlistedEnrollments = useMemo(() => enrollments.items.filter((row) => row.status === "waitlist"), [enrollments.items]);

  const members = useMemo(() => membersByTeacher(activeEnrollments, classIndex), [activeEnrollments, classIndex]);
  const waiting = useMemo(() => membersByTeacher(waitlistedEnrollments, classIndex), [waitlistedEnrollments, classIndex]);
  const relationsComplete =
    classes.total === classes.items.length && enrollments.total === enrollments.items.length;
  const sessionsComplete = sessions.total === sessions.items.length;

  const list = useMemo(
    () =>
      teachers.filter(
        (t) =>
          (inst === "all" || t.instrument === inst) &&
          (only === "all" || (only === "absent-tomorrow" ? t.status === "absent-tomorrow" : t.utilization < 60)) &&
          (query === "" || t.name.includes(query) || t.title.includes(query)),
      ),
    [teachers, inst, only, query],
  );

  /**
   * Who is teaching today, from today's own session rows — the record's
   * `todayClasses` field is a stored list with no writer, and it used to answer
   * this question with fixture session ids that match no repository row.
   * Cancelled occurrences are not classes anyone teaches.
   */
  const teachingToday = useMemo(() => {
    const roster = new Set(teachers.map((t) => t.id));
    const ids = new Set<string>();
    for (const row of sessions.items) {
      if (row.date !== today || row.status === "cancelled") continue;
      if (roster.has(row.teacherId)) ids.add(row.teacherId);
    }
    return ids;
  }, [sessions.items, today, teachers]);

  /** Tomorrow's occurrences whose teacher is on record as absent. */
  const absentTomorrow = useMemo(
    () => new Set(teachers.filter((t) => t.status === "absent-tomorrow").map((t) => t.id)),
    [teachers],
  );
  const uncoveredTomorrow = useMemo(
    () =>
      sessions.items.filter((row) => row.date === tomorrow && row.status !== "cancelled" && absentTomorrow.has(row.teacherId))
        .length,
    [sessions.items, tomorrow, absentTomorrow],
  );

  const rosterLoading = sessions.loading || classes.loading || enrollments.loading;
  const rosterError = sessions.error ?? classes.error ?? enrollments.error;
  const reloadRelations = () => {
    sessions.reload();
    classes.reload();
    enrollments.reload();
  };

  if (rosterLoading) return <LoadingState className="py-32" label="در حال خواندن برنامهٔ مدرسین…" />;
  if (rosterError)
    return (
      <ErrorState
        className="py-32"
        title="خواندن برنامه‌ها و رابطه‌های مدرسین ناموفق بود"
        description={rosterError.message}
        onRetry={reloadRelations}
      />
    );

  // `null` while the academy has no teachers: an average over nothing is not
  // 0٪, and inline it evaluated to NaN and rendered as «NaN٪».
  const avgUtil = meanOf(teachers, (t) => t.utilization);
  const freeHours = teachers.reduce((a, b) => a + Math.max(0, b.contractHours - b.weeklyHours), 0);

  return (
    <div>
      <PageHeader
        kicker="افراد"
        title="مدرسین"
        description="بار کاری، در دسترس بودن و کیفیت عملیاتی هر مدرس در یک نگاه."
        actions={
          <>
            <EntityExportButton
              entity="teachers"
              filters={{
                ...(query ? { search: query } : {}),
                ...(inst !== "all" ? { instrument: inst } : {}),
              }}
            />
            <Button size="sm" variant="subtle" onClick={() => notify({ tone: "info", title: "درخواست در دسترس بودن", detail: "ارسال فرم به مدرسین به سرور پیام‌رسان نیاز دارد." })}>
              <UserCheck className="size-3.5" /> درخواست ساعات آزاد
            </Button>
            {canWriteTeachers && (
              <Button size="sm" variant="primary" onClick={onAdd}>
                <Plus className="size-3.5" /> افزودن مدرس
              </Button>
            )}
          </>
        }
      />

      <StatStrip
        stats={[
          {
            label: "مدرس فعال",
            value: faNum(teachers.length),
            // Both halves of this hint are repository rows; the count is withheld
            // when the read did not cover the day it counted.
            hint: sessionsComplete
              ? `${faNum(teachingToday.size)} نفر امروز کلاس دارند`
              : "برنامهٔ امروز کامل خوانده نشد",
          },
          // No trend delta: `delta: 11` asserted a change in average utilisation
          // that nothing in this build measured.
          { label: "بهره‌وری میانگین", value: faPercent(avgUtil), tone: "gold" },
          { label: "ظرفیت آزاد هفتگی", value: `${faNum(freeHours)} ساعت`, tone: "violet", hint: "قابل تخصیص به لیست انتظار", onClick: () => setOnly("low-utilization") },
          {
            label: "غیبت فردا",
            value: faNum(absentTomorrow.size),
            tone: "warn",
            hint: sessionsComplete
              ? uncoveredTomorrow > 0
                ? `${faNum(uncoveredTomorrow)} جلسهٔ فردا با مدرس غایب`
                : "جلسه‌ای فردا با مدرس غایب ثبت نشده"
              : "برنامهٔ فردا کامل خوانده نشد",
            onClick: () => setOnly("absent-tomorrow"),
          },
        ]}
      />

      <FilterBar
        className="mt-5"
        search={<SearchInput value={query} onChange={setQuery} placeholder="جستجوی نام یا تخصص مدرس…" />}
        chips={
          <>
            <Chip label="همه" active={only === "all" && inst === "all"} onClick={() => { setOnly("all"); setInst("all"); }} />
            <Chip label="ظرفیت آزاد" active={only === "low-utilization"} onClick={() => setOnly("low-utilization")} />
            <Chip label="غیبت فردا" active={only === "absent-tomorrow"} onClick={() => setOnly("absent-tomorrow")} />
            <span className="mx-1 h-6 w-px shrink-0 self-center bg-white/[0.08]" />
            {instrumentFilters.map((i) => (
              <Chip key={i.id} tone="violet" label={i.name} active={inst === i.id} count={teachers.filter((t) => t.instrument === i.id).length} onClick={() => setInst(inst === i.id ? "all" : i.id)} />
            ))}
          </>
        }
      />

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState title="مدرسی پیدا نشد" description="فیلترها را تغییر دهید تا نتایج بیشتری ببینید." action="بازنشانی" onAction={() => { setOnly("all"); setInst("all"); setQuery(""); }} />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <TeacherCard
                key={t.id}
                t={t}
                // The enrollment relation's distinct members, or «—» when the page
                // it was counted from was partial.
                studentCount={relationsComplete ? (members.get(t.id)?.size ?? 0) : null}
                todayIndex={todayIndex}
                onOpen={() => navigate({ view: "teachers", id: t.id })}
              />
            ))}
          </div>
        )}
      </div>

      <Panel className="mt-5" title="تخصیص ظرفیت" kicker="مدرسین با ظرفیت آزاد در برابر لیست انتظار سازها">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teachers
            .filter((t) => t.utilization < 60)
            .map((t) => (
              <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={t.name} size="sm" photoMediaId={t.photoMediaId} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink-50">{t.name}</div>
                    <div className="text-[11px] text-ink-400">{instrumentName(t.instrument)}</div>
                  </div>
                </div>
                <div className="nums mt-3 text-[11.5px] text-ink-300">
                  {faNum(t.contractHours - t.weeklyHours)} ساعت آزاد ·{" "}
                  {/* Distinct students queued in this teacher's classes, from
                      enrollment rows — the fixture used the class row's own
                      `waitlist` projection, which no enrollment write updates. */}
                  {relationsComplete ? `${faNum(waiting.get(t.id)?.size ?? 0)} نفر در انتظار` : `${NO_DATA} نفر در انتظار`}
                </div>
                <Meter value={t.weeklyHours} max={t.contractHours} tone="violet" className="mt-2" />
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function TeachersView() {
  const { detailId, navigate, notify } = useApp();
  let user: any = null;
  try { user = useAuth().user; } catch { user = null; }
  const canWriteTeachers = useCan("teachers.write") || !user;
  const demoEnvironment = useIsDemoEnvironment();
  // Repository-backed: loading reflects a real read, not a timer.
  // I16: list view keeps per_page 200 ceiling; detail/deep-link uses authoritative get(id)
  const { items: teachers, loading, error, reload } = useTeachers({ per_page: RELATIONS_PER_PAGE });
  const { teacher: detailTeacher, loading: detailLoading, error: detailError, reload: reloadDetail } = useTeacher(
    detailId ?? undefined,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | undefined>(undefined);

  const savedToast = (saved: Teacher, mode: "create" | "edit") =>
    notify({
      tone: "success",
      title: mode === "create" ? `${saved.name} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
      // The write is real in every environment, so the confirmation may only
      // call it demo data where it actually is one. In an EMPTY environment
      // these are the academy's own records (H3).
      detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
    });

  const dialog = (
    <TeacherFormDialog open={formOpen} teacher={editing} onClose={() => setFormOpen(false)} onSaved={savedToast} />
  );

  const detailFromList = detailId ? teachers.find((t) => t.id === detailId) : undefined;
  const detail = detailTeacher ?? detailFromList;

  if (detailId) {
    if (detailLoading || loading) return <LoadingState className="py-32" label="در حال آماده‌سازی میز کار مدرسین…" />;
    if (detailError) {
      if (detailError.kind === "not_found") {
        return (
          <EmptyState
            className="py-32"
            title="مدرس یافت نشد"
            description="این پیوند به مدرسی اشاره دارد که دیگر وجود ندارد."
            action="بازگشت به فهرست"
            onAction={() => navigate({ view: "teachers" })}
          />
        );
      }
      return (
        <ErrorState
          className="py-32"
          title="بارگذاری پروندهٔ مدرس ناموفق بود"
          description={detailError.message}
          onRetry={reloadDetail}
        />
      );
    }
    if (!detail) {
      return (
        <EmptyState
          className="py-32"
          title="مدرس یافت نشد"
          description="این پیوند به مدرسی اشاره دارد که دیگر وجود ندارد."
          action="بازگشت به فهرست"
          onAction={() => navigate({ view: "teachers" })}
        />
      );
    }
    return (
      <>
        {/*
          CONSUMER-LOCAL IDENTITY KEY (CP3)

          The detail's reads and its local state belong to ONE teacher. Keying the
          instance by the teacher id makes a switch a fresh mount, which is what
          keeps the students read — the one list hook without the shared
          render-time key invariant — from ever handing this surface a previous
          query's page. It is deliberately not an ancestor remount: the route and
          the view do not change identity, this instance does, and the enrollment
          scoping above holds even if this key is ever dropped.
        */}
        <TeacherDetail
          key={detail.id}
          teacher={detail}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
          }}
        />
        {dialog}
      </>
    );
  }

  if (loading) return <LoadingState className="py-32" label="در حال آماده‌سازی میز کار مدرسین…" />;
  if (error)
    return (
      <ErrorState className="py-32" title="بارگذاری مدرسین ناموفق بود" description={error.message} onRetry={reload} />
    );

  return (
    <>
      <TeachersRoster
        teachers={teachers}
        onAdd={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
      />
      {dialog}
    </>
  );
}
