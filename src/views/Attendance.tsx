/**
 * Attendance — a window of real sessions, one derived register, three real writes.
 *
 * WHAT CHANGED IN M5
 *
 * This view used to render `src/data/records.ts`: `todayAttendance` (nine
 * registers keyed by session ids `g7`–`g15` that match no session the scheduling
 * domain has ever produced), `attendanceTrend` and `attendanceByDay` (two charts
 * whose numbers nobody computed), a hardcoded 92٪ "نرخ حضور امروز" against an
 * 89٪ "میانگین ماه", a per-instrument breakdown, and a «ثبت نهایی» button that
 * flipped local state, stamped a hardcoded recorder name and announced a save.
 * Attendance has had a complete domain since M1 — repository, derived roster,
 * append-only corrections, 79 frozen tests — and the view simply did not use it
 * (H1b, I12).
 *
 * WHAT IT READS NOW
 *
 *   1. `useSessions` over a bounded window, from the academy's own clock.
 *   2. `useSessionAttendance(selectedSessionId)` — the register for ONE session:
 *      the roster derived from active Enrollment at that session's date, joined
 *      with whatever marks exist, in a single repository pass.
 *   3. `list({ status: "absent", since, until })` — the window's recorded
 *      absences, filtered by the repository so the count is exact.
 *   4. `list({ since, until })` — every mark in the window, whatever its status.
 *   5. `listCorrections({ per_page })` — the append-only trail, newest first,
 *      never fetched whole.
 *   6–8. classes, teachers and students, only to resolve ids a record carries
 *      into the names a user reads.
 *
 * Every one of those states an explicit `per_page`, which
 * `architectureBoundaries.test.ts` enforces at the call site.
 *
 * WHAT IT WRITES
 *
 * `record` (one mark), `bulkRecord` (one atomic register save) and `correct`
 * (a stated-reason change plus one immutable history entry). Those are the only
 * three verbs the repository has: there is no `update` and no `delete`, so this
 * view offers no control that removes a mark, restores a previous one or edits a
 * correction — a control whose operation cannot run is removed rather than
 * disabled (M2).
 *
 * WHAT IT DELIBERATELY DOES NOT SHOW
 *
 * No attendance rate, no trend, no per-day chart, no per-instrument breakdown and
 * no per-student longitudinal figure. Each of those needs a read the domain does
 * not expose: a rate over one session is a sample of one, a trend needs a window
 * of registers this view would have to fetch session by session, and a student's
 * long-term presence is an academy-wide aggregation that belongs to a reporting
 * domain which does not exist yet. Rendering a number anyway is what the fixture
 * did, and it is the specific dishonesty E-1 names (I16 stays OPEN globally).
 *
 * THE IDENTITY GUARD (I13, mitigated here, still OPEN upstream)
 *
 * `useSessionAttendance` does not retract the register it committed when the
 * selected session changes, so there is a frame in which the previous session's
 * roster is on screen under the new id — the frame in which marks could be taken
 * against the wrong session. The fix belongs in the hook (3C in
 * `docs/engineering/OPEN_ITEMS.md`), which M5 was not authorised to touch, so the
 * view refuses to render or write over a register that answers for a different
 * session than the one selected. The defect stays OPEN; this is a guard, not a
 * cure.
 */
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, History, Users } from "lucide-react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { Button, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import {
  ListRow,
  PageHeader,
  Panel,
  Segmented,
  StatStrip,
  Tabs,
  type StatDef,
} from "@/components/ds/patterns";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { useApp } from "@/context/AppContext";
import {
  ATTENDANCE_ERRORS,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionInput,
} from "@/domains/attendance/types";
import {
  useAttendanceCorrections,
  useAttendanceRecords,
  useSessionAttendance,
} from "@/domains/attendance/useAttendance";
import { useAuth, useCan } from "@/domains/auth/AuthContext";
import { useClasses } from "@/domains/classes/useClasses";
import { getAttendanceRepository } from "@/domains/registry";
import { addDays, isoToJalaliDisplay, weekdayIndex } from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { academyIsoDate } from "@/views/relations/academyDay";
import { useAcademyNow } from "@/domains/shared/clock";
import { useStudentList } from "@/domains/students/useStudents";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { NO_DATA, faNum, faTime } from "@/lib/format";
import { CorrectMarkDialog } from "./attendance/CorrectMarkDialog";
import { RegisterPanel } from "./attendance/RegisterPanel";

/**
 * Page sizes, stated rather than inherited.
 *
 * A session window is a week or a day of one academy, and the record lists are
 * bounded by the same window; 200 is far above either, and the view says plainly
 * when a page was not enough instead of letting the truncation pass for a total.
 * Corrections are the one list that grows without bound, so its page is smaller
 * and its truncation is reported the same way.
 */
const SESSIONS_PER_PAGE = 200;
const SUPPORT_PER_PAGE = 200;
const RECORDS_PER_PAGE = 200;
const CORRECTIONS_PER_PAGE = 50;

/** Saturday-first week start, using the domain's own weekday convention. */
function startOfWeek(iso: string): string {
  const index = weekdayIndex(iso);
  if (index === null) return iso;
  return addDays(iso, -index) ?? iso;
}

/**
 * The window's two ends as the ISO-8601 instants the repository's `since` /
 * `until` bounds expect. Both ends are inclusive, so the last day of a week is
 * read to its final millisecond rather than to its midnight — a mark taken at
 * 21:00 on Friday belongs to that week.
 */
function windowInstants(from: string, to: string): { since: string; until: string } {
  return { since: `${from}T00:00:00.000Z`, until: `${to}T23:59:59.999Z` };
}

/** The day of an ISO timestamp, as the user reads it. Only the day is a fact. */
function dayOf(iso: string): string {
  const display = isoToJalaliDisplay(iso.slice(0, 10), { day: "numeric", month: "short" });
  return display.length > 0 ? display : NO_DATA;
}

const SESSION_TONE: Record<Session["status"], Tone> = {
  scheduled: "gold",
  cancelled: "neutral",
  completed: "ok",
};

/* ------------------------------------------------------------------ */
export function AttendanceView() {
  const { filter, navigate, notify } = useApp();
  const { user } = useAuth();

  /**
   * Permission AND principal.
   *
   * `attendance.write` is the RBAC answer; `recordedByUserId` is required by the
   * repository and is provenance, not authorization — but a mark attributed to
   * nobody is a mark the audit trail cannot answer for, so with no signed-in user
   * the write controls are absent rather than present-and-refused.
   */
  const recorderId = user?.id ?? null;
  const canWrite = useCan("attendance.write") && recorderId !== null;

  const now = useAcademyNow();
  const todayIso = useMemo(() => academyIsoDate(), [now]);

  /**
   * `filter=pending` arrives from the command palette («ثبت حضور و غیاب امروز») and
   * from the dashboard's attention panel. What this view can honour is the "today"
   * half of it: the window narrows to the academy's own current day. Which
   * sessions still have no register is NOT guessed here — knowing it would mean a
   * register read per session, and a badge derived from anything less would be a
   * fabricated state. The note below says so plainly, the way the scheduling view
   * says what its own deep links cannot do yet (E-1).
   */
  const [mode, setMode] = useState<"week" | "day">(filter === "pending" ? "day" : "week");
  const [anchor, setAnchor] = useState<string>(todayIso);
  const [tab, setTab] = useState<"register" | "absentees" | "history">("register");
  /**
   * An id, not a `Session` and not a register: both are derived from what is
   * loaded, so a window change cannot leave the previous window's session open
   * here or hand a write a target the user can no longer see (I13).
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [correcting, setCorrecting] = useState<{ record: AttendanceRecord; studentName: string } | null>(null);

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: anchor };
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 6) ?? start };
  }, [mode, anchor]);

  /* ---------------- reads ---------------- */
  const sessions = useSessions({ from, to, per_page: SESSIONS_PER_PAGE });
  const classes = useClasses({ per_page: SUPPORT_PER_PAGE });
  const teachers = useTeachers({ per_page: SUPPORT_PER_PAGE });
  const students = useStudentList({ per_page: SUPPORT_PER_PAGE });

  const { since, until } = useMemo(() => windowInstants(from, to), [from, to]);
  /** Every mark recorded inside the window, whatever its status. */
  const windowRecords = useAttendanceRecords({ since, until, per_page: RECORDS_PER_PAGE });
  /** Absences only, filtered by the repository so the count is exact. */
  const absentRecords = useAttendanceRecords({ status: "absent", since, until, per_page: RECORDS_PER_PAGE });
  /** The append-only correction trail, newest first, never fetched whole. */
  const corrections = useAttendanceCorrections({ per_page: CORRECTIONS_PER_PAGE });

  // Indexes over the reads, named for what they are: the fixture helpers of the
  // same shape in `src/data/records.ts` are called `classById`/`teacherById`, and
  // a view that reads the domains must not be mistaken for one that reaches for
  // them.
  const classIndex = useMemo(() => new Map(classes.items.map((row) => [row.id, row])), [classes.items]);
  const teacherIndex = useMemo(() => new Map(teachers.items.map((row) => [row.id, row])), [teachers.items]);
  const studentIndex = useMemo(() => new Map(students.students.map((row) => [row.id, row])), [students.students]);

  /**
   * The selected session, or the first one the window read returned.
   *
   * Auto-selecting is what makes the register the page's subject rather than a
   * second click away; deriving it from the loaded list is what stops a window
   * change leaving a session open that the user can no longer see.
   */
  const selected = useMemo(
    () => sessions.items.find((session) => session.id === selectedId) ?? sessions.items[0],
    [sessions.items, selectedId],
  );
  const selectedSessionId = selected?.id;
  const register = useSessionAttendance(selectedSessionId);
  const attendance = register.attendance;

  /**
   * The register on screen must be the selected session's. See the file header:
   * the hook does not retract a committed register, and a write aimed at
   * `attendance.sessionId` while the user is looking at another session is the
   * one mistake here that writes a falsehood into a real record.
   */
  const registerMatches = attendance !== undefined && selectedSessionId !== undefined && attendance.sessionId === selectedSessionId;

  /* ---------------- derived ---------------- */
  const titleOf = useCallback(
    (session: Session | undefined) => (session ? (classIndex.get(session.classId)?.title ?? NO_DATA) : NO_DATA),
    [classIndex],
  );
  const teacherNameOf = useCallback(
    (session: Session | undefined) => (session ? (teacherIndex.get(session.teacherId)?.name ?? NO_DATA) : NO_DATA),
    [teacherIndex],
  );
  const studentNameOf = useCallback(
    (studentId: string) => studentIndex.get(studentId)?.name ?? NO_DATA,
    [studentIndex],
  );

  const windowLabel = `${isoToJalaliDisplay(from, { day: "numeric", month: "short" })} – ${isoToJalaliDisplay(to, {
    day: "numeric",
    month: "short",
  })}`;

  const sessionsTruncated = sessions.total > sessions.items.length;
  const absentTruncated = absentRecords.total > absentRecords.items.length;
  const recordsTruncated = windowRecords.total > windowRecords.items.length;
  const correctionsTruncated = corrections.total > corrections.items.length;

  /**
   * A refusal is announced in `danger` with the repository's own sentence.
   *
   * Not a paraphrase and not a generic «خطا»: the domain's messages say which rule
   * was hit («برای این هنرجو در این جلسه حضور و غیاب ثبت شده است. برای تغییر، از
   * اصلاح استفاده کنید.»), and replacing them would trade an answer for an
   * apology (§37).
   */
  const writeRefused = useCallback(
    (title: string) => (cause: unknown) => {
      notify({ tone: "danger", title, detail: apiErrorFromThrown(cause).message });
    },
    [notify],
  );

  /** Re-read the register after a write, so what appears is the repository's answer. */
  const reread = useCallback(() => register.reload(), [register]);

  /* ---------------- writes ---------------- */

  /** One mark for one student who has no record yet. */
  const recordMark = useCallback(
    async (studentId: string, studentName: string, status: AttendanceStatus) => {
      // No register, no principal, no permission: no write is attempted at all.
      if (!registerMatches || attendance === undefined || recorderId === null || !canWrite) return;
      const session = selected;
      setBusyStudentId(studentId);
      try {
        await getAttendanceRepository().record({
          sessionId: attendance.sessionId,
          studentId,
          status,
          recordedByUserId: recorderId,
        });
        reread();
        notify({
          tone: "success",
          title: `${ATTENDANCE_STATUS_LABEL[status]} ثبت شد`,
          detail: `${studentName} در ${titleOf(session)} — یک رکورد نوشته شد. چیزی حذف نشد و اطلاع‌رسانی انجام نشد.`,
        });
      } catch (cause) {
        writeRefused("ثبت حضور انجام نشد")(cause);
      } finally {
        setBusyStudentId(null);
      }
    },
    [attendance, canWrite, notify, recorderId, registerMatches, reread, selected, titleOf, writeRefused],
  );

  /**
   * One atomic register save for the students who have no record yet.
   *
   * The payload is built from the register the repository itself derived, minus
   * everyone who already has a mark: `bulkRecord` validates every entry before
   * writing any of them, so sending an already-marked student would refuse the
   * whole save. When nobody is left to submit, nothing is sent and the
   * confirmation says so in `info` — a success toast for a write that did not
   * happen is the exact defect H2 exists for.
   */
  const bulkPresent = useCallback(async () => {
    if (!registerMatches || attendance === undefined || recorderId === null || !canWrite) return;
    const unmarked = attendance.roster.filter((row) => row.record === undefined);
    if (unmarked.length === 0) {
      notify({
        tone: "info",
        title: "چیزی برای ثبت گروهی نیست",
        detail:
          "همهٔ هنرجویان این فهرست رکورد دارند و هیچ رکوردی نوشته نشد. برای تغییر یک وضعیت از اصلاح استفاده کنید.",
      });
      return;
    }
    setBulkBusy(true);
    try {
      const created = await getAttendanceRepository().bulkRecord({
        sessionId: attendance.sessionId,
        entries: unmarked.map((row) => ({ studentId: row.student.studentId, status: "present" as const })),
        recordedByUserId: recorderId,
      });
      reread();
      notify({
        tone: "success",
        // Count-based, and about the records that exist: the retracted claim this
        // replaces («همه حاضر ثبت شدند») described a page-wide sweep nobody could
        // verify, and would still be true of a register that was already complete.
        title: `${faNum(created.length)} حضور ثبت شد`,
        detail: `${faNum(created.length)} رکورد «حاضر» در ${titleOf(selected)} نوشته شد و ثبت‌کنندهٔ آن‌ها ${
          user?.name ?? NO_DATA
        } است. رکوردی جایگزین نشد و اطلاع‌رسانی انجام نشد.`,
      });
    } catch (cause) {
      writeRefused("ثبت گروهی انجام نشد")(cause);
    } finally {
      setBulkBusy(false);
    }
  }, [attendance, canWrite, notify, recorderId, registerMatches, reread, selected, titleOf, user, writeRefused]);

  /**
   * The correction verb, handed to the dialog.
   *
   * The dialog owns the draft and the presence check; this owns the principal and
   * the announcement. `changedByUserId` never comes from the form.
   */
  const submitCorrection = useCallback(
    async (id: string, input: Omit<CorrectionInput, "changedByUserId">) => {
      if (recorderId === null) {
        // Unreachable from the register — the control that opens this dialog is
        // only rendered for a user who may write — and refused rather than
        // attributed to nobody.
        throw new ApiError({
          kind: "validation",
          code: ATTENDANCE_ERRORS.RECORDER_REQUIRED,
          message: "ثبت‌کنندهٔ حضور و غیاب مشخص نیست.",
        });
      }
      const corrected = await getAttendanceRepository().correct(id, {
        ...input,
        changedByUserId: recorderId,
      });
      reread();
      notify({
        tone: "success",
        title: "وضعیت اصلاح شد",
        detail: `${studentNameOf(corrected.studentId)} — وضعیت رکورد به «${
          ATTENDANCE_STATUS_LABEL[corrected.status]
        }» تغییر کرد و یک سابقهٔ اصلاح به تاریخچه اضافه شد. رکوردی حذف نشد و اطلاع‌رسانی انجام نشد.`,
      });
      return corrected;
    },
    [notify, recorderId, reread, studentNameOf],
  );

  const shift = (by: number) => {
    const next = addDays(anchor, by);
    if (next !== null) setAnchor(next);
  };

  const stats: StatDef[] = [
    {
      label: "جلسات این بازه",
      value: faNum(sessions.total),
      hint: sessionsTruncated ? `${faNum(sessions.items.length)} جلسه نمایش داده شده است` : windowLabel,
      ...(sessionsTruncated ? { tone: "warn" as Tone } : {}),
    },
    {
      label: "فهرست حاضران",
      // The register's own counts, and only when it answers for the session on
      // screen: a count from another session's register is a count of nothing
      // the user can see.
      value: registerMatches && attendance ? `${faNum(attendance.recorded)} از ${faNum(attendance.expected)}` : NO_DATA,
      hint: selected ? titleOf(selected) : "جلسه‌ای انتخاب نشده",
      ...(registerMatches && attendance && attendance.recorded === attendance.expected && attendance.expected > 0
        ? { tone: "ok" as Tone }
        : {}),
    },
    {
      label: "غیبت‌های این بازه",
      value: faNum(absentRecords.total),
      hint: absentTruncated ? `${faNum(absentRecords.items.length)} مورد نمایش داده شده است` : "رکوردهای «غایب»، از انبار دامنه",
      ...(absentRecords.total > 0 ? { tone: "warn" as Tone } : {}),
    },
    { label: "سابقهٔ اصلاحات", value: faNum(corrections.total), hint: "کل تاریخچهٔ تغییرناپذیر" },
  ];

  return (
    <div>
      <PageHeader
        kicker="عملیات"
        title="حضور و غیاب"
        description="فهرست حاضران هر جلسه از دامنهٔ حضور و غیاب خوانده می‌شود: ثبت برای هر هنرجو، ثبت گروهی برای ثبت‌نشده‌ها، و اصلاح با دلیل. هیچ نرخ، روند یا الگویی که از داده استخراج نشده باشد نمایش داده نمی‌شود."
        actions={
          <>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "week", label: "هفته" },
                { value: "day", label: "روز" },
              ]}
            />
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-ink-900/60 p-0.5">
              <button
                type="button"
                aria-label="بازهٔ پیشین"
                onClick={() => shift(mode === "week" ? -7 : -1)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-300 hover:bg-white/[0.05]"
              >
                <ChevronRight className="size-4" />
              </button>
              <Button size="sm" variant="subtle" onClick={() => setAnchor(todayIso)}>
                امروز
              </Button>
              <button
                type="button"
                aria-label="بازهٔ پسین"
                onClick={() => shift(mode === "week" ? 7 : 1)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-300 hover:bg-white/[0.05]"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
            <span className="min-w-28 text-center text-[12px] font-medium text-ink-50">{windowLabel}</span>
          </>
        }
      />

      <StatStrip className="mt-5" stats={stats} />

      {filter === "pending" && (
        <Surface className="mt-4 flex items-start gap-3 border-info-400/25 bg-info-400/[0.04] p-3.5">
          <p className="text-[12px] leading-relaxed text-ink-100">
            «ثبت حضور و غیاب امروز» این بازه را به روز جاری آموزشگاه محدود می‌کند.
            اینکه کدام جلسه‌ها هنوز فهرست حاضرانشان نوشته نشده است از این صفحه
            قابل اعلام نیست: دانستنش یک خوانش فهرست برای هر جلسه می‌خواهد و هر
            شمارشی که از کمتر از آن ساخته شود وضعیت ساختگی است. وضعیت ثبت هر جلسه
            از فهرست حاضران همان جلسه خوانده می‌شود و با باز کردن جلسه دیده
            می‌شود.
          </p>
        </Surface>
      )}

      {sessionsTruncated && (
        <Surface className="mt-4 flex items-start gap-3 border-warn-500/25 bg-warn-500/[0.04] p-3.5">
          <p className="text-[12px] leading-relaxed text-ink-100">
            این بازه {faNum(sessions.total)} جلسه دارد؛ {faNum(sessions.items.length)} جلسه نمایش داده
            شده است. فهرست کامل نیست و شمارش‌های این بازه کامل نشان داده نمی‌شوند.
          </p>
        </Surface>
      )}

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "register", label: "فهرست حاضران", count: sessions.total },
          { value: "absentees", label: "غایبان", count: absentRecords.total },
          { value: "history", label: "تاریخچه", count: corrections.total },
        ]}
      />

      <div key={tab} className="mt-5 animate-phrase-in">
        {tab === "register" && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* the window's sessions — the only way to choose a register */}
            <div className="space-y-3">
              <Panel title="جلسات این بازه" kicker={windowLabel} aside={<ClipboardList className="size-4 text-gold-400" />}>
                {sessions.loading ? (
                  <LoadingState label="در حال خواندن جلسات این بازه…" />
                ) : sessions.error !== null ? (
                  <ErrorState
                    title="جلسات این بازه خوانده نشد"
                    description={sessions.error.message}
                    onRetry={sessions.reload}
                  />
                ) : sessions.items.length === 0 ? (
                  <EmptyState
                    title="جلسه‌ای در این بازه نیست"
                    description={`برای ${windowLabel} جلسه‌ای در برنامهٔ این آموزشگاه ثبت نشده است. با تغییر بازه یا ساختن جلسه در برنامه‌ریزی، فهرست حاضران اینجا خوانده می‌شود.`}
                    action="رفتن به برنامه‌ریزی"
                    onAction={() => navigate({ view: "schedule" })}
                  />
                ) : (
                  <ul className="stagger space-y-2">
                    {sessions.items.map((session) => (
                      <ListRow
                        key={session.id}
                        active={session.id === selected?.id}
                        onClick={() => setSelectedId(session.id)}
                        lead={<span className="nums shrink-0 text-[12px] text-ink-200">{faTime(session.startTime)}</span>}
                        title={titleOf(session)}
                        meta={`${teacherNameOf(session)} · ${faTime(session.startTime)}–${faTime(session.endTime)} · ${dayOf(session.date)}`}
                        end={
                          <StatusBadge
                            tone={SESSION_TONE[session.status]}
                            label={SESSION_STATUS_LABEL[session.status]}
                            cancelled={session.status === "cancelled"}
                          />
                        }
                      />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {/* the register — one derived session, one derived register */}
            <div className="space-y-3">
              {classes.error !== null && (
                <ErrorState className="mt-4" title="کلاس‌ها خوانده نشد" description={classes.error.message} onRetry={classes.reload} />
              )}
              {teachers.error !== null && (
                <ErrorState className="mt-4" title="مدرسین خوانده نشد" description={teachers.error.message} onRetry={teachers.reload} />
              )}
              {students.error !== null && (
                <ErrorState className="mt-4" title="هنرجویان خوانده نشد" description={students.error.message} onRetry={students.reload} />
              )}

              {selected === undefined ? (
                <EmptyState
                  title="جلسه‌ای انتخاب نشده"
                  description="از فهرست کنار، یک جلسه را باز کنید تا فهرست حاضران واقعی آن از دامنه خوانده شود."
                />
              ) : register.loading && attendance === undefined ? (
                /*
                  Nothing has answered yet and something is in flight. This branch is
                  deliberately narrower than "loading or no data": a read that failed
                  leaves `attendance` undefined and `loading` false, and must reach
                  the error branch below rather than spin forever. A spinner that
                  never stops is a claim that an answer is on its way.
                */
                <LoadingState label="در حال خواندن فهرست حاضران همین جلسه…" />
              ) : register.error !== null && !register.loading ? (
                <ErrorState
                  title="فهرست حاضران خوانده نشد"
                  description={register.error.message}
                  onRetry={register.reload}
                />
              ) : !registerMatches ? (
                /*
                  The identity guard's render branch (I13, mitigated in the view):
                  `useSessionAttendance` does not retract the register it committed
                  when the selected session changes, so for one frame the previous
                  session's roster would sit on screen under the new id — the frame
                  in which marks could be taken against the wrong session. A
                  register that answers for another session is withheld, not
                  rendered, and no write control is offered over it. The hook is
                  untouched; the defect stays OPEN upstream.
                */
                <LoadingState label="در حال خواندن فهرست حاضران همین جلسه…" />
              ) : (
                <RegisterPanel
                  session={selected}
                  attendance={attendance}
                  classTitle={titleOf(selected)}
                  teacherName={teacherNameOf(selected)}
                  canWrite={canWrite}
                  recorderName={user?.name ?? ""}
                  busyStudentId={busyStudentId}
                  bulkBusy={bulkBusy}
                  onRecord={(studentId, studentName, status) => void recordMark(studentId, studentName, status)}
                  onBulkPresent={bulkPresent}
                  onCorrect={(record, studentName) => setCorrecting({ record, studentName })}
                  onOpenStudent={(studentId) => navigate({ view: "students", id: studentId })}
                  onOpenSchedule={() => navigate({ view: "schedule" })}
                />
              )}
            </div>
          </div>
        )}

        {tab === "absentees" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="غیبت‌های ثبت‌شده در این بازه"
              className="lg:col-span-2"
              kicker={`${windowLabel} — رکوردهایی با وضعیت «غایب» که در این بازه ثبت شده‌اند، از انبار دامنه.`}
              aside={<Users className="size-4 text-warn-400" />}
            >
              {absentRecords.loading ? (
                <LoadingState label="در حال خواندن غیبت‌های ثبت‌شده…" />
              ) : absentRecords.error !== null ? (
                <ErrorState
                  title="غیبت‌ها خوانده نشد"
                  description={absentRecords.error.message}
                  onRetry={absentRecords.reload}
                />
              ) : absentRecords.items.length === 0 ? (
                <EmptyState
                  title="در این بازه غیبتی ثبت نشده است"
                  description="هیچ رکوردی با وضعیت «غایب» در این بازه وجود ندارد. این یک نتیجهٔ واقعی از انبار دامنه است، نه فهرستی که هنوز خوانده نشده باشد."
                />
              ) : (
                <>
                  {absentTruncated && (
                    <p className="mb-3 rounded-xl border border-warn-500/25 bg-warn-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-ink-200">
                      {faNum(absentRecords.total)} رکورد غیبت در این بازه ثبت شده است و{" "}
                      {faNum(absentRecords.items.length)} مورد نمایش داده شده است؛ این فهرست کامل نیست.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {absentRecords.items.map((record) => {
                      /*
                        The row's only action is the truthful one it always had:
                        opening that student's real profile. The «پیگیری» button M2
                        removed announced that the student and their guardian had
                        been notified, and nothing was sent — there is no messaging
                        provider, no delivery channel and no guardian principal in
                        the product. A false claim about contacting a minor's
                        guardian is the worst-shaped fake success here, so the
                        control stays gone rather than reworded (H2).
                      */
                      return (
                        <ListRow
                          key={record.id}
                          onClick={() => navigate({ view: "students", id: record.studentId })}
                          lead={<StatusBadge tone="danger" label={ATTENDANCE_STATUS_LABEL[record.status]} />}
                          title={studentNameOf(record.studentId)}
                          meta={`ثبت‌شده در ${dayOf(record.recordedAt)} · شناسهٔ رکورد ${record.id}`}
                          end={<ChevronLeft className="size-4 text-ink-500" />}
                        />
                      );
                    })}
                  </ul>
                </>
              )}
            </Panel>

            <Panel title="چه چیزی اینجا نیست" kicker="مرزهای صادقانهٔ این صفحه">
              <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-ink-300">
                <li>
                  نرخ بلندمدت حضور هر هنرجو نمایش داده نمی‌شود: این صفحه رکوردهای
                  یک بازه را می‌خواند و یک نرخ چند‌هفته‌ای نیاز به خوانشی دارد که
                  دامنه ارائه نمی‌کند.
                </li>
                <li>
                  جلسه‌هایی که فهرست حاضرانشان نوشته نشده است شمارش نمی‌شوند، چون
                  دانستنش یک خوانش فهرست برای هر جلسه می‌خواهد.
                </li>
                <li>
                  هیچ پیامی به مدرس، هنرجو یا سرپرست ارسال نمی‌شود؛ این آموزشگاه
                  هیچ کانال پیامی ندارد.
                </li>
              </ul>
            </Panel>
          </div>
        )}

        {tab === "history" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="رکوردهای ثبت‌شده در این بازه"
              kicker={`${windowLabel} — هر رکورد حضور و غیاب، با وضعیت و ثبت‌کنندهٔ آن.`}
              aside={<ClipboardList className="size-4 text-gold-400" />}
            >
              {windowRecords.loading ? (
                <LoadingState label="در حال خواندن رکوردها…" />
              ) : windowRecords.error !== null ? (
                <ErrorState
                  title="رکوردها خوانده نشد"
                  description={windowRecords.error.message}
                  onRetry={windowRecords.reload}
                />
              ) : windowRecords.items.length === 0 ? (
                <EmptyState
                  title="در این بازه رکوردی ثبت نشده است"
                  description="هیچ نشانی نوشته نشده است. با باز کردن یک جلسه از فهرست حاضران می‌توان اولین رکورد را ثبت کرد."
                  action="رفتن به فهرست حاضران"
                  onAction={() => setTab("register")}
                />
              ) : (
                <>
                  {recordsTruncated && (
                    <p className="mb-3 rounded-xl border border-warn-500/25 bg-warn-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-ink-200">
                      {faNum(windowRecords.total)} رکورد در این بازه ثبت شده است و {faNum(windowRecords.items.length)}{" "}
                      مورد نمایش داده شده است؛ این فهرست کامل نیست.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {windowRecords.items.map((record) => (
                      <li
                        key={record.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate({ view: "students", id: record.studentId })}
                            className="block truncate text-[12.5px] font-medium text-ink-50 hover:text-gold-300"
                          >
                            {studentNameOf(record.studentId)}
                          </button>
                          <div className="truncate text-[11px] text-ink-400">
                            {dayOf(record.recordedAt)} · شناسهٔ جلسه {record.sessionId}
                          </div>
                        </div>
                        <StatusBadge tone={record.status === "absent" ? "danger" : record.status === "late" ? "warn" : record.status === "excused" ? "info" : "ok"} label={ATTENDANCE_STATUS_LABEL[record.status]} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel
              title="سابقهٔ اصلاحات"
              kicker="تاریخچهٔ تغییرناپذیر: هر اصلاح یک رکورد تازه اضافه می‌کند و هیچ‌کدام ویرایش یا پاک نمی‌شوند."
              aside={<History className="size-4 text-violet-400" />}
            >
              {corrections.loading ? (
                <LoadingState label="در حال خواندن سابقهٔ اصلاحات…" />
              ) : corrections.error !== null ? (
                <ErrorState
                  title="سابقهٔ اصلاحات خوانده نشد"
                  description={corrections.error.message}
                  onRetry={corrections.reload}
                />
              ) : corrections.items.length === 0 ? (
                <EmptyState
                  title="هیچ اصلاحی ثبت نشده است"
                  description="تاریخچه خالی است. وقتی وضعیت یک رکورد با دلیل اصلاح شود، یک سابقهٔ تغییرناپذیر اینجا اضافه می‌شود."
                />
              ) : (
                <>
                  {correctionsTruncated && (
                    <p className="mb-3 rounded-xl border border-warn-500/25 bg-warn-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-ink-200">
                      {faNum(corrections.total)} اصلاح در تاریخچه است و {faNum(corrections.items.length)} مورد نمایش
                      داده شده است؛ این فهرست کامل نیست.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {corrections.items.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-ink-50">{studentNameOf(entry.studentId)}</span>
                          <span className="shrink-0 text-ink-400">
                            {ATTENDANCE_STATUS_LABEL[entry.previousStatus]} ← {ATTENDANCE_STATUS_LABEL[entry.newStatus]}
                          </span>
                        </div>
                        <div className="mt-1 text-ink-300">
                          دلیل: {entry.reason} · {dayOf(entry.changedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        )}
      </div>

      <CorrectMarkDialog
        open={correcting !== null}
        // The dialog renders nothing while closed, so these are only read when a
        // record is actually being corrected.
        record={correcting?.record ?? EMPTY_RECORD}
        studentName={correcting?.studentName ?? ""}
        onSubmit={submitCorrection}
        onRejected={writeRefused("اصلاح انجام نشد")}
        onWritten={() => reread()}
        onClose={() => setCorrecting(null)}
      />
    </div>
  );
}

/**
 * The dialog's `record` prop is non-optional because a correction is always about
 * a real record; while it is closed there is none, and it renders nothing. This
 * placeholder exists to keep that contract instead of widening the prop to
 * `undefined` and teaching the form to handle a record that cannot be corrected.
 */
const EMPTY_RECORD: AttendanceRecord = {
  id: "",
  sessionId: "",
  studentId: "",
  status: "present",
  recordedAt: "",
  recordedByUserId: "",
  updatedAt: "",
};
