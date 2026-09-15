/**
 * Compensation — the make-up lessons a cancelled PRIVATE lesson left behind, and
 * the three decisions that settle them.
 *
 * WHAT THIS SURFACE IS
 *
 * A cancelled lesson creates no debt on its own. Somebody looks at it and decides
 * the student is still owed a lesson, and that decision is what this screen
 * records: the obligation (`required`), the make-up (one real session, therefore
 * `scheduled`), and the final decision that it happened (`completed`). Those three
 * words are DERIVED on every read by `domains/compensation/derive.ts` from the
 * current state of the rows involved — never stored, and never recomputed here.
 *
 * WHAT IT DOES NOT DO, AND WHY THAT IS THE POINT
 *
 * The whole rulebook lives in `src/domains/compensation/`: private-class
 * eligibility (`kind === "private"`, not "one student happens to be enrolled"), the
 * frozen affected student, the one-live-make-up refusal, the terminal refusal, the
 * lifetime uniqueness of the (original, student) pair, the serialized booking
 * section, the reschedule LINEAGE and the C-2 roster disclosure. This view
 * implements none of it:
 *
 *   - it never decides eligibility. Candidate rows are the domain's exported
 *     predicate (`isCompensableOriginal` / `isCompensableClass`) applied to
 *     scheduling rows, and the repository re-decides on the write;
 *   - it never picks the affected student. The id it sends comes from the
 *     scheduling domain's derived roster for the chosen session's date, and the
 *     repository refuses a payload that names anyone else;
 *   - it never resolves the make-up. The session an action targets is
 *     `currentAttempt.sessionId` — the EFFECTIVE session, i.e. the end of the
 *     booking's reschedule chain. `bookedSessionId` is displayed as history and is
 *     NEVER an action target, because a moved booking's first row is cancelled by
 *     design (C-1.1), and cancelling or moving THAT row would be wrong;
 *   - it writes no status. `scheduled` is the calendar's, `completed` is the
 *     ledger's decision, and the screen only reports what came back;
 *   - it claims nothing it did not do: a success toast is written from the record
 *     the repository returned, no notification is claimed (the product has no
 *     provider), and a refusal is shown in the repository's own sentence.
 *
 * THE READS, AND WHAT EACH IS FOR
 *
 *   1. the unfiltered ledger page — the table's rows, the search, the tab
 *      filtering, and the list of originals that may no longer be offered as
 *      candidates. `total` comes from the repository, so a truncated page is
 *      announced rather than passed off as the whole list;
 *   2. four one-row reads for the summary (`required` / `scheduled` /
 *      `completed` / `needsAttention`). The repository filters and counts, so the
 *      strip is EXACT even when the table's page is not: a summary derived from
 *      the visible page would under-report the moment an academy outgrew it;
 *   3. the cancelled private lessons, in a stated window, for the registration
 *      dialog;
 *   4. per-selection reads while a dialog or the drawer needs them: the original
 *      session and the effective make-up session, each BY ID (`useSessionRow`).
 *
 * WHY THE BY-ID READ EXISTS
 *
 * The read model carries the make-up session's ID and STATE but not its date, room
 * or teacher, and there is no windowed list read that can promise to contain an
 * arbitrary booking — a make-up booked outside the window would be reported as
 * missing, which is a lie about a row that exists. A read of one id has no such
 * failure mode. It is a view-local reader with NO rule in it (the scheduling domain
 * is frozen for this workstream; a `useSession(id)` beside `useSessionRoster` is the
 * natural home for it later).
 *
 * READ PERMISSION, WRITE PERMISSION
 *
 * `schedule.read` opens the view; `schedule.write` (secretary, manager,
 * administrator — never a teacher) enables the writes, through the existing
 * `viewPermissions` matrix and `useCan`. No second, compensation-specific permission
 * is invented, and with no signed-in principal the controls are absent rather than
 * present-and-refused: the ledger records WHO decided, and a decision attributed to
 * nobody is one the trail cannot answer for.
 *
 * HONEST NOTES THAT STAY VISIBLE (reported, never hidden)
 *
 *   - `studentOnRoster === undefined` is "not determinable" and is rendered as
 *     such; `false` is INFORMATION — it hides no control and gates nothing (D20);
 *   - `sessionStatus === "missing"` is a real answer (the row was deleted, or the
 *     chain cannot be walked). When it appears, the ids beside it are HISTORICAL:
 *     they are shown as evidence and offered as no target;
 *   - the demo dataset ships no compensable case — its one cancelled session is a
 *     group class — so a fresh demo shows the empty state until somebody cancels a
 *     private lesson. That is data, not a missing feature.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CalendarPlus, History } from "lucide-react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { Button, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import {
  Chip,
  DataTable,
  Drawer,
  FilterBar,
  PageHeader,
  SearchInput,
  StatStrip,
  type Column,
  type StatDef,
} from "@/components/ds/patterns";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { useApp } from "@/context/AppContext";
import { ATTENDANCE_STATUS_LABEL } from "@/domains/attendance/types";
import { useAuth, useCan } from "@/domains/auth/AuthContext";
import { useClasses } from "@/domains/classes/useClasses";
import { isCompensableOriginal } from "@/domains/compensation/derive";
import {
  COMPENSATION_STATUS_LABEL,
  type SessionCompensation,
} from "@/domains/compensation/types";
import { useCompensations } from "@/domains/compensation/useCompensations";
import { getSchedulingRepository } from "@/domains/registry";
import { useRooms } from "@/domains/rooms/useRooms";
import { addDays, isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { SESSION_STATUS_LABEL, type Session } from "@/domains/scheduling/types";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { useStudentList } from "@/domains/students/useStudents";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { NO_DATA, faNum, faTime } from "@/lib/format";
// The academy day comes from the ONE shared conversion (`views/relations/academyDay`),
// never from a private copy of it (audit M-2).
import { academyIsoDate } from "@/views/relations/academyDay";
import { RescheduleSessionDialog } from "@/views/scheduling/SessionWriteDialogs";
import {
  CompleteCompensationDialog,
  RegisterCompensationDialog,
  ScheduleCompensationDialog,
  type CompensationCandidate,
} from "./compensation/CompensationDialogs";

/**
 * Page sizes and the candidate window, stated rather than inherited.
 *
 * A compensation ledger is small — one row per cancelled private lesson somebody
 * decided to make up — and the support reads exist only to turn ids into names, so
 * 200 is far above either for one academy. Each list says plainly when a page was
 * not enough instead of letting truncation pass for a total. The four summary reads
 * ask for ONE row and read `total`; the candidate window is stated in the dialog
 * itself, because "cancelled lessons we still act on" is a policy an operator
 * should be able to read, not a hidden constant.
 */
const LEDGER_PER_PAGE = 200;
const SUPPORT_PER_PAGE = 200;
const CANDIDATES_PER_PAGE = 200;
const CANDIDATE_DAYS_BACK = 365;
const CANDIDATE_DAYS_FORWARD = 120;

/** A Jalali day as the product reads it. Only the day is a fact. */
function jalaliDay(iso: string): string {
  const display = isoToJalaliDisplay(iso.slice(0, 10), { day: "numeric", month: "short" });
  return display.length > 0 ? display : NO_DATA;
}

/** Jalali day AND clock, for a row of the calendar. */
function jalaliDayTime(iso: string | undefined, time: string | undefined): string {
  if (!iso || !time) return NO_DATA;
  const day = jalaliDay(iso);
  return day === NO_DATA ? NO_DATA : `${day} · ${faTime(time)}`;
}

/* ------------------------------------------------------------------ */
/* One session, read by id                                             */
/* ------------------------------------------------------------------ */

interface SessionRowState {
  session: Session | undefined;
  loading: boolean;
  error: ApiError | null;
  /** Re-runs this read: the only way a failed by-id read is retried (audit S-3). */
  reload: () => void;
}

/**
 * ONE session by id — the drawer's original and its effective make-up, and the
 * move dialog's target.
 *
 * The bookkeeping is the discipline every derived read in this product carries
 * (OPEN_ITEMS I13): the state remembers which id it answers for, so the render that
 * first sees a new id can never expose the previous one's row, and an answer that
 * arrives after the id changed is dropped. Any persisted write bumps the data
 * version, so a move or a cancellation refreshes this row with no call-site
 * coupling.
 */
function useSessionRow(id: string | undefined): SessionRowState {
  const dataVersion = useDataVersion();
  const [state, setState] = useState<{ key: string; session?: Session; loading: boolean; error: ApiError | null }>({
    key: "",
    loading: false,
    error: null,
  });
  const latest = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const ticket = ++latest.current;
    setState((current) =>
      current.key === id ? { ...current, loading: true } : { key: id, loading: true, error: null },
    );
    getSchedulingRepository()
      .get(id, controller.signal)
      .then((session) => {
        if (ticket !== latest.current) return;
        setState({ key: id, session, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setState({ key: id, loading: false, error: normalized });
      });
    return () => controller.abort();
  }, [id, dataVersion, nonce]);

  const answers = id !== undefined && state.key === id;
  return {
    session: answers ? state.session : undefined,
    loading: id !== undefined && (!answers || state.loading),
    error: answers ? state.error : null,
    // Stable identity: a retry re-runs the read and nothing else.
    reload: useCallback(() => setNonce((value) => value + 1), []),
  };
}

/* ------------------------------------------------------------------ */
/* Presentation of the derived read model                              */
/* ------------------------------------------------------------------ */

/** Tone per DERIVED status. A broken attempt is an attention state, not a status. */
function statusTone(compensation: SessionCompensation): Tone {
  if (compensation.status === "completed") return "ok";
  if (compensation.status === "scheduled") return "gold";
  return compensation.attemptBroken ? "danger" : "warn";
}

/** What the make-up column says. A reformat of the read model, never a new status. */
function makeUpSummary(compensation: SessionCompensation): string {
  if (compensation.status === "completed") return "انجام شده";
  if (compensation.status === "scheduled") {
    const moves = compensation.currentAttempt?.rescheduleCount ?? 0;
    return moves > 0 ? `ثبت شده · ${faNum(moves)} بار جابه‌جا شده` : "ثبت شده";
  }
  return compensation.attemptBroken ? "جلسهٔ پیشین از دست رفت" : "ثبت نشده";
}

/**
 * The C-2 disclosure, in words an operator can act on.
 *
 * `true` says nothing (the ordinary case needs no sentence), `false` states the fact
 * and its consequence in one breath — the booking stands — and `undefined` says it
 * could not be determined. None of the three hides or disables anything, and the
 * `undefined` branch is documented where it is decided, below.
 */
function rosterDisclosure(compensation: SessionCompensation): string | null {
  const attempt = compensation.currentAttempt;
  if (!attempt || attempt.sessionStatus === "missing") return null;
  if (attempt.studentOnRoster === false) {
    return "هنرجو در فهرست این روز نیست (ثبت‌نام او برای این تاریخ فعال نیست). این فقط برای اطلاع شماست؛ جبرانی ثبت‌شده معتبر است.";
  }
  /*
   * KEPT DELIBERATELY, and unreachable through today's read model (audit S-5).
   *
   * The domain answers `undefined` only when the attempt's lineage cannot be
   * resolved, and such a row is already `missing` — returned from above, where no
   * make-up state is claimed at all. So this branch guards the TYPE
   * (`studentOnRoster?: boolean`), not a state the domain produces today, and no
   * test fabricates one: inventing `scheduled` + `undefined` would be inventing a
   * read model the domain cannot return.
   *
   * It stays because the alternative is a fail-open: if a future read model ever
   * reported a live session whose roster could not be determined, silence here
   * would read as "on the roster", and the operator would be told nothing while the
   * screen knew it did not know. It hides and disables nothing either way.
   */
  if (attempt.studentOnRoster === undefined) {
    return "وضعیت هنرجو در فهرست این روز قابل تشخیص نبود.";
  }
  return null;
}

/** Why the obligation is in the state it is in — in the domain's own terms. */
function statusExplanation(compensation: SessionCompensation): string {
  if (compensation.status === "completed") {
    return "این جبرانی انجام‌شده ثبت شده است؛ وضعیت نهایی است و جبرانی دیگری برای همین جلسه و هنرجو ثبت نمی‌شود.";
  }
  if (compensation.status === "scheduled") {
    return "یک جلسهٔ جبرانی فعال ثبت شده است. اگر زمان آن مناسب نیست، همان جلسه را جابه‌جا کنید (لغو و ساخت جلسهٔ تازه) — ثبت دوباره جبرانی ممکن نیست.";
  }
  if (compensation.attemptBroken) {
    return "جلسهٔ جبرانی پیشین لغو، حذف یا غیرقابل‌ردیابی شده است؛ بنابراین این تعهد به «نیازمند جبرانی» بازگشته و ثبت جلسهٔ تازه مجاز است.";
  }
  return "هنوز جلسهٔ جبرانی برای این تعهد ثبت نشده است؛ لغو جلسه به‌تنهایی جبرانی نمی‌سازد.";
}

/**
 * One row of the summary strip: the label, the read that answers it, and where it
 * navigates to.
 *
 * The four rows are ONE list because the strip, the attention chip and the failure
 * note under it all address the same four numbers — and because a number nobody has
 * read yet must not be rendered as `0`. `useResourceList` starts from an empty page,
 * so `total` is `0` while a read is in flight and stays `0` when it fails: the value
 * is taken from the read's own STATE, never from the number it happens to hold
 * (audit M-1).
 */
interface CountEntry {
  label: string;
  /** The explanation shown once the read has answered. */
  hint: string;
  tone: Tone;
  read: { total: number; loading: boolean; error: ApiError | null; reload: () => void };
  onClick: () => void;
}

/** A count that is still loading, or that failed, has no value. It is NOT `0`. */
function countValue(entry: CountEntry): string {
  return entry.read.loading || entry.read.error !== null ? NO_DATA : faNum(entry.read.total);
}

/** The hint tracks the read's state, so it never explains a number that is absent. */
function countHint(entry: CountEntry): string {
  if (entry.read.error !== null) return "خوانده نشد";
  return entry.read.loading ? "در حال خواندن…" : entry.hint;
}

const STATUS_TABS = [
  { id: "all", label: "همه" },
  { id: "required", label: "نیازمند جبرانی" },
  { id: "scheduled", label: "جبرانی ثبت شده" },
  { id: "completed", label: "انجام شده" },
] as const;
type StatusTab = (typeof STATUS_TABS)[number]["id"];

/* ------------------------------------------------------------------ */

export function CompensationView() {
  const { notify } = useApp();
  const { user, permissions } = useAuth();

  /**
   * Permission AND principal, as the attendance surface states it: the permission
   * is the RBAC answer and `userId` is provenance — a decision attributed to nobody
   * is one the ledger cannot answer for, so with no signed-in user the write
   * controls are absent rather than refused.
   */
  const canWrite = useCan("schedule.write") && user !== null;
  const actor = useMemo(() => (user ? { userId: user.id, permissions } : null), [user, permissions]);

  const [tab, setTab] = useState<StatusTab>("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ compensation: SessionCompensation; session: Session } | null>(null);

  const todayIso = useMemo(() => academyIsoDate(), []);

  /* ---------------- reads ---------------- */

  /**
   * The ledger, whole and unfiltered: tabs, the summary's navigation, the search and
   * the "already registered" exclusion all read this one page, so no two parts of
   * the screen can disagree about what exists. The repository's `total` is kept
   * beside it so truncation is announced.
   */
  const ledger = useCompensations({ per_page: LEDGER_PER_PAGE });

  /*
   * The summary. Four one-row reads, each filtered and counted BY THE REPOSITORY:
   * the strip's numbers are exact even when the table's page is not, and
   * `needsAttention` is the ledger's own derived filter (a live make-up whose
   * effective session was cancelled or cannot be resolved) rather than an
   * approximation built here.
   */
  const requiredCount = useCompensations({ status: "required", per_page: 1 });
  const scheduledCount = useCompensations({ status: "scheduled", per_page: 1 });
  const completedCount = useCompensations({ status: "completed", per_page: 1 });
  const attentionCount = useCompensations({ needsAttention: true, per_page: 1 });

  const classes = useClasses({ per_page: SUPPORT_PER_PAGE });
  const students = useStudentList({ per_page: SUPPORT_PER_PAGE });
  const rooms = useRooms({ per_page: SUPPORT_PER_PAGE });
  const teachers = useTeachers({ per_page: SUPPORT_PER_PAGE });

  /**
   * The cancelled lessons the registration dialog may offer, in a stated window.
   * The window is the operator's policy, not a rule of the domain: a cancellation
   * from longer ago than a year, or further ahead than four months, is out of the
   * dialog's reach and the dialog says so.
   */
  const candidateWindow = useMemo(
    () => ({
      from: addDays(todayIso, -CANDIDATE_DAYS_BACK) ?? todayIso,
      to: addDays(todayIso, CANDIDATE_DAYS_FORWARD) ?? todayIso,
    }),
    [todayIso],
  );
  const cancelledSessions = useSessions({
    status: "cancelled",
    from: candidateWindow.from,
    to: candidateWindow.to,
    per_page: CANDIDATES_PER_PAGE,
  });

  /*
   * The session rows the drawer and the booking dialog need, read by id. The
   * effective session is asked for only when the read model says a real one exists:
   * `missing` means the ids beside it are historical, and a lookup for them must
   * fail by design.
   */
  const open = useMemo(() => ledger.items.find((row) => row.id === openId), [ledger.items, openId]);
  const bookingTarget = useMemo(
    () => ledger.items.find((row) => row.id === bookingId),
    [bookingId, ledger.items],
  );
  const attemptIsReal = open?.currentAttempt !== undefined && open.currentAttempt.sessionStatus !== "missing";
  const drawerOriginal = useSessionRow(open?.originalSessionId);
  const drawerEffective = useSessionRow(attemptIsReal ? open?.currentAttempt?.sessionId : undefined);

  /* ---------------- derived ---------------- */

  const classIndex = useMemo(() => new Map(classes.items.map((row) => [row.id, row])), [classes.items]);
  const studentIndex = useMemo(() => new Map(students.students.map((row) => [row.id, row])), [students.students]);
  const roomIndex = useMemo(() => new Map(rooms.items.map((row) => [row.id, row])), [rooms.items]);
  const teacherIndex = useMemo(() => new Map(teachers.items.map((row) => [row.id, row])), [teachers.items]);

  const classTitleOf = useCallback((classId: string) => classIndex.get(classId)?.title ?? NO_DATA, [classIndex]);
  const studentNameOf = useCallback((studentId: string) => studentIndex.get(studentId)?.name ?? NO_DATA, [studentIndex]);

  const visibleRows = useMemo(() => {
    const byStatus = ledger.items.filter(
      (row) =>
        (tab === "all" || row.status === tab) && (!attentionOnly || row.attemptBroken),
    );
    const needle = query.trim();
    if (needle.length === 0) return byStatus;
    return byStatus.filter((row) =>
      [studentNameOf(row.studentId), classTitleOf(row.classId), row.reason].join(" ").includes(needle),
    );
  }, [attentionOnly, classTitleOf, ledger.items, query, studentNameOf, tab]);

  const truncated = ledger.total > ledger.items.length;

  /**
   * The candidates: cancelled, private, and not yet registered.
   *
   * Three of the four conditions are VALUES the domains answered — the repository
   * filtered the status, the class carries its own `kind`, and the ledger carries
   * every original it already covers. The fourth (`isCompensableOriginal`) is the
   * domain's own exported predicate, called rather than re-implemented; the
   * repository re-decides all of it on the write, and its refusal is what the
   * operator would see if any of this ever disagreed.
   */
  const candidates: CompensationCandidate[] = useMemo(() => {
    const registered = new Set(ledger.items.map((row) => row.originalSessionId));
    return cancelledSessions.items
      .filter((session) => !registered.has(session.id))
      .map((session) => ({ session, klass: classIndex.get(session.classId) }))
      .filter((entry): entry is CompensationCandidate => entry.klass !== undefined && isCompensableOriginal(entry.session, entry.klass));
  }, [cancelledSessions.items, classIndex, ledger.items]);

  /**
   * The four numbers, each paired with the read that answers it.
   *
   * `error` is read here on purpose: a count that failed is NAMED in the note under
   * the strip — with a retry that re-runs exactly those reads — instead of quietly
   * becoming `0`, and the strip shows the indeterminate value until a real answer
   * exists. Nothing is derived from a truncated ledger page.
   */
  const countEntries: CountEntry[] = [
    {
      label: "نیازمند جبرانی",
      hint: "تعهد باز، بدون جلسهٔ فعال",
      tone: "warn",
      read: requiredCount,
      onClick: () => {
        setTab("required");
        setAttentionOnly(false);
      },
    },
    {
      label: "جبرانی ثبت‌شده",
      hint: "تعهد با یک جلسهٔ فعال",
      tone: "gold",
      read: scheduledCount,
      onClick: () => {
        setTab("scheduled");
        setAttentionOnly(false);
      },
    },
    {
      label: "انجام‌شده",
      hint: "وضعیت نهایی",
      tone: "ok",
      read: completedCount,
      onClick: () => {
        setTab("completed");
        setAttentionOnly(false);
      },
    },
    {
      label: "نیازمند توجه",
      hint: "جلسهٔ ثبت‌شده لغو، حذف یا غیرقابل‌ردیابی شده",
      tone: "danger",
      read: attentionCount,
      onClick: () => {
        setAttentionOnly(true);
        setTab("all");
      },
    },
  ];

  const stats: StatDef[] = countEntries.map((entry) => ({
    label: entry.label,
    value: countValue(entry),
    tone: entry.tone,
    hint: countHint(entry),
    onClick: entry.onClick,
  }));

  /** Counts that failed. Named below; the attention chip shows no number either. */
  const failedCounts = countEntries.filter((entry) => entry.read.error !== null);
  const attentionCountKnown = !attentionCount.loading && attentionCount.error === null;

  const columns: Column<SessionCompensation>[] = [
    {
      key: "student",
      header: "هنرجو",
      cell: (row) => <span className="font-medium text-ink-50">{studentNameOf(row.studentId)}</span>,
    },
    { key: "class", header: "کلاس", cell: (row) => classTitleOf(row.classId), hideBelow: "sm" },
    {
      key: "status",
      header: "وضعیت",
      cell: (row) => <StatusBadge tone={statusTone(row)} label={COMPENSATION_STATUS_LABEL[row.status]} />,
    },
    {
      key: "makeup",
      header: "جلسهٔ جبرانی",
      cell: (row) => (
        <span className={row.attemptBroken ? "text-warn-300" : "text-ink-200"}>{makeUpSummary(row)}</span>
      ),
      hideBelow: "md",
    },
    {
      key: "required",
      header: "تاریخ ثبت تصمیم",
      cell: (row) => <span className="nums">{jalaliDay(row.requiredAt)}</span>,
      align: "end",
      hideBelow: "lg",
    },
  ];

  /* ---------------- writes ---------------- */

  /** A refusal is announced in `danger`, in the repository's own words. */
  const refused = useCallback(
    (title: string) => (cause: unknown) => {
      notify({ tone: "danger", title, detail: apiErrorFromThrown(cause).message });
    },
    [notify],
  );

  const registerRefused = refused("ثبت جبرانی انجام نشد");
  const bookingRefused = refused("ثبت جلسهٔ جبرانی انجام نشد");
  const completingRefused = refused("ثبت انجام جبرانی نشد");
  const movingRefused = refused("جابه‌جایی جلسهٔ جبرانی انجام نشد");

  /**
   * Registered. The copy reports the act AND its limits: one record was written, no
   * session was created by it, and no notification was sent — the product has no
   * provider, and a success sentence that implied one would be the exact dishonesty
   * H2 was about.
   */
  const registerDone = useCallback(
    (created: SessionCompensation) => {
      setRegisterOpen(false);
      notify({
        tone: "success",
        title: "جبرانی ثبت شد",
        detail: `${studentNameOf(created.studentId)} — ${classTitleOf(created.classId)}؛ فقط رکورد جبرانی نوشته شد: هنوز جلسه‌ای ساخته نشده و اطلاع‌رسانی‌ای انجام نشده است.`,
      });
    },
    [classTitleOf, notify, studentNameOf],
  );

  /**
   * Booked. The session is reported as the CALENDAR's fact — an ordinary session of
   * the class — and the C-2 disclosure, when the fresh read carries one, is passed
   * on as information rather than as a warning about the write.
   */
  const bookingDone = useCallback(
    (updated: SessionCompensation) => {
      setBookingId(null);
      const attempt = updated.currentAttempt;
      const disclosure = rosterDisclosure(updated);
      notify({
        tone: "success",
        title: "جلسهٔ جبرانی ثبت شد",
        detail: [
          `${classTitleOf(updated.classId)}؛ یک جلسهٔ معمولی در تقویم ساخته شد${
            attempt && attempt.sessionStatus !== "missing"
              ? ` و وضعیت آن «${SESSION_STATUS_LABEL[attempt.sessionStatus]}» است.`
              : "."
          }`,
          disclosure ?? "",
        ]
          .filter((part) => part.length > 0)
          .join(" "),
      });
    },
    [classTitleOf, notify],
  );

  const completingDone = useCallback(
    (updated: SessionCompensation) => {
      setCompletingId(null);
      notify({
        tone: "success",
        title: "جبرانی انجام‌شده ثبت شد",
        detail: `${studentNameOf(updated.studentId)} — ${classTitleOf(updated.classId)}؛ این وضعیت نهایی است و جبرانی دیگری برای همین جلسه و هنرجو ثبت نمی‌شود.`,
      });
    },
    [classTitleOf, notify, studentNameOf],
  );

  const movingDone = useCallback(
    (moved: Session) => {
      setMoving(null);
      notify({
        tone: "success",
        title: "جلسهٔ جبرانی جابه‌جا شد",
        detail: `جلسهٔ پیشین لغو و جلسهٔ تازه‌ای در ${jalaliDayTime(moved.date, moved.startTime)} ساخته شد؛ ثبت جبرانی روی جلسهٔ تازه ادامه دارد.`,
      });
    },
    [notify],
  );

  /* ---------------- render ---------------- */

  if (ledger.error && ledger.items.length === 0) {
    return (
      <>
        <PageHeader
          kicker="عملیات"
          title="جبرانی"
          description="تعهدهای جبرانی کلاس‌های خصوصی: ثبت تصمیم، ثبت جلسهٔ جبرانی و ثبت انجام."
        />
        <ErrorState
          title="فهرست جبرانی‌ها خوانده نشد"
          description={ledger.error.message}
          onRetry={() => ledger.reload()}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="عملیات"
        title="جبرانی"
        description="لغو یک جلسهٔ خصوصی خودش جبرانی نمی‌سازد: مدیر آموزشگاه تصمیم می‌گیرد هنرجو جلسه‌ای طلبکار است یا نه. جلسهٔ جبرانی یک جلسهٔ معمولی از همان کلاس است و با همان قواعد برنامه‌ریزی ساخته می‌شود."
        actions={
          canWrite ? (
            <Button variant="primary" onClick={() => setRegisterOpen(true)}>
              <CalendarPlus className="size-4" /> ثبت جبرانی
            </Button>
          ) : (
            <span className="text-[11.5px] text-ink-400">
              {user ? "ثبت و تغییر جبرانی به این حساب داده نشده است." : "برای ثبت جبرانی، وارد شوید."}
            </span>
          )
        }
      />

      {/* The summary gets a named landmark: it is one unit, and a count that failed
          must be distinguishable from a count that is genuinely zero. */}
      <section aria-label="نوار خلاصه">
        <StatStrip stats={stats} className="mb-4" />
      </section>

      {/*
        A count that could not be read is SAID, not zeroed. The retry calls each
        failed read's own `reload`, so the strip returns to real numbers without
        inventing any in the meantime — and the note names which numbers are missing.
      */}
      {failedCounts.length > 0 && (
        <ErrorState
          className="mb-4"
          title="شمارش خلاصه خوانده نشد"
          description={`شمارش ${failedCounts
            .map((entry) => `«${entry.label}»`)
            .join("، ")} خوانده نشد؛ تا پیش از پاسخ، این عددها نامشخص («${NO_DATA}») نمایش داده می‌شوند${
            attentionCount.error !== null ? " و نشان «نیازمند توجه» هم عددی نشان نمی‌دهد" : ""
          }.`}
          onRetry={() => {
            failedCounts.forEach((entry) => entry.read.reload());
          }}
        />
      )}

      <FilterBar
        className="mb-3"
        search={
          <SearchInput value={query} onChange={setQuery} placeholder="جستجوی هنرجو، کلاس یا دلیل…" />
        }
        chips={
          <>
            {STATUS_TABS.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.label}
                active={tab === entry.id && !attentionOnly}
                onClick={() => {
                  setTab(entry.id);
                  setAttentionOnly(false);
                }}
              />
            ))}
            <Chip
              label="نیازمند توجه"
              tone="violet"
              active={attentionOnly}
              count={attentionCountKnown ? attentionCount.total : undefined}
              onClick={() => {
                setAttentionOnly((value) => !value);
                setTab("all");
              }}
            />
          </>
        }
      />

      {/*
        A refresh that FAILED while rows remain is SAID (audit S-1). These rows are
        the last successful read, and this screen never lets them pass for a fresh
        one: the note names the failure, says where the rows came from, and retries
        the same read. The empty case never reaches this line — a first read that
        failed is reported above as an error, not as an empty ledger (D12), so a
        failed read can never become an empty-state success.
      */}
      {ledger.error !== null && (
        <ErrorState
          className="mb-3"
          title="فهرست جبرانی‌ها تازه‌سازی نشد"
          description={`آخرین خواندن فهرست شکست خورد: ${ledger.error.message} ردیف‌های زیر از آخرین خواندن موفق‌اند و ممکن است با سامانه یکی نباشند.`}
          onRetry={() => ledger.reload()}
        />
      )}

      <Surface className="overflow-hidden">
        {ledger.loading && ledger.items.length === 0 ? (
          <LoadingState label="در حال خواندن جبرانی‌ها…" />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={query.trim().length > 0 || tab !== "all" || attentionOnly ? "چیزی با این فیلتر پیدا نشد" : "جبرانی‌ای ثبت نشده است"}
            description={
              query.trim().length > 0 || tab !== "all" || attentionOnly
                ? "فیلترها را باز کنید تا همهٔ تعهدهای ثبت‌شده دیده شوند."
                : "برای ثبت نخستین جبرانی، از دکمهٔ «ثبت جبرانی» استفاده کنید: جلسهٔ لغوشدهٔ یک کلاس خصوصی را انتخاب کنید و دلیل را بنویسید."
            }
            action={tab !== "all" || attentionOnly || query.trim().length > 0 ? "نمایش همه" : undefined}
            onAction={() => {
              setTab("all");
              setAttentionOnly(false);
              setQuery("");
            }}
          />
        ) : (
          <DataTable
            rows={visibleRows}
            columns={columns}
            onRowClick={(row) => setOpenId(row.id)}
            caption="تعهدهای جبرانی"
            empty={<EmptyState title="جبرانی‌ای ثبت نشده است" description="این فهرست خالی است." />}
          />
        )}
      </Surface>

      {truncated && (
        <p className="mt-2 text-[11.5px] text-ink-400">
          {faNum(ledger.items.length)} ردیف از {faNum(ledger.total)} ردیف خوانده شد؛ فیلتر کردن روی همان یک صفحه
          انجام می‌شود.
        </p>
      )}

      {/* ---------------- drawer ---------------- */}
      <Drawer
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        width="xl"
        kicker="تعهد جبرانی"
        title={open ? studentNameOf(open.studentId) : "تعهد جبرانی"}
      >
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(open)} label={COMPENSATION_STATUS_LABEL[open.status]} />
              {open.attemptBroken && <StatusBadge tone="danger" label="نیازمند توجه" />}
              <span className="text-[11.5px] text-ink-400">{classTitleOf(open.classId)}</span>
            </div>

            <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-ink-300">
              {statusExplanation(open)}
            </p>

            <section>
              <h3 className="mb-2 text-xs font-medium text-ink-200">هنرجو و تصمیم</h3>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <dt className="text-ink-400">هنرجوی ثابت‌شده</dt>
                <dd className="text-ink-100">{studentNameOf(open.studentId)}</dd>
                <dt className="text-ink-400">دلیل نیاز به جبرانی</dt>
                <dd className="text-ink-100">{open.reason}</dd>
                <dt className="text-ink-400">تاریخ ثبت تصمیم</dt>
                <dd className="nums text-ink-100">{jalaliDay(open.requiredAt)}</dd>
                <dt className="text-ink-400">ثبت‌کنندهٔ تصمیم</dt>
                <dd className="nums text-ink-400">{open.requiredByUserId}</dd>
                <dt className="text-ink-400">حضور و غیاب جلسهٔ لغوشده</dt>
                <dd className="text-ink-100">
                  {open.originalStudentAttendance
                    ? ATTENDANCE_STATUS_LABEL[open.originalStudentAttendance]
                    : "ثبت نشده"}
                </dd>
              </dl>
              {open.originalAttendanceAcknowledgedAt && (
                <p className="mt-2 text-[11px] text-ink-400">
                  هنگام ثبت تصمیم، حضور و غیاب ثبت‌شده برای این هنرجو در جلسهٔ لغوشده دیده و تأیید شده است.
                </p>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium text-ink-200">جلسهٔ لغوشده</h3>
              {open.originalMissing ? (
                <p className="text-[12px] text-warn-200">
                  این جلسه حذف شده است؛ رکورد جبرانی کلاس و هنرجو را در خود نگه داشته و جلسه دیگر روی تقویم نیست.
                </p>
              ) : drawerOriginal.error ? (
                <p className="text-[12px] text-danger-200">
                  جلسهٔ لغوشده خوانده نشد: {drawerOriginal.error.message}
                </p>
              ) : drawerOriginal.loading && !drawerOriginal.session ? (
                <p className="text-[12px] text-ink-400">در حال خواندن…</p>
              ) : drawerOriginal.session ? (
                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <dt className="text-ink-400">تاریخ و ساعت</dt>
                  <dd className="nums text-ink-100">
                    {jalaliDayTime(drawerOriginal.session.date, drawerOriginal.session.startTime)}
                  </dd>
                  <dt className="text-ink-400">اتاق</dt>
                  <dd className="text-ink-100">{roomIndex.get(drawerOriginal.session.roomId)?.name ?? NO_DATA}</dd>
                  <dt className="text-ink-400">مدرس</dt>
                  <dd className="text-ink-100">{teacherIndex.get(drawerOriginal.session.teacherId)?.name ?? NO_DATA}</dd>
                  <dt className="text-ink-400">دلیل لغو</dt>
                  <dd className="text-ink-100">{drawerOriginal.session.cancelReason ?? NO_DATA}</dd>
                </dl>
              ) : (
                <p className="text-[12px] text-ink-400">این جلسه در دسترس نیست.</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium text-ink-200">جلسهٔ جبرانی</h3>
              {open.attempts.length === 0 || !open.currentAttempt ? (
                <p className="text-[12px] text-ink-300">هنوز جلسه‌ای برای این تعهد ثبت نشده است.</p>
              ) : (
                <div className="space-y-3">
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <dt className="text-ink-400">وضعیت جلسه</dt>
                    <dd className="text-ink-100">
                      {open.currentAttempt.sessionStatus === "missing"
                        ? "قابل ردیابی نیست (حذف‌شده یا زنجیرهٔ جابه‌جایی ناقص)"
                        : SESSION_STATUS_LABEL[open.currentAttempt.sessionStatus]}
                    </dd>
                    {open.currentAttempt.sessionStatus !== "missing" && (
                      <>
                        <dt className="text-ink-400">تاریخ و ساعت</dt>
                        <dd className="nums text-ink-100">
                          {drawerEffective.error !== null
                            ? "خوانده نشد"
                            : drawerEffective.loading && !drawerEffective.session
                              ? "در حال خواندن…"
                              : jalaliDayTime(drawerEffective.session?.date, drawerEffective.session?.startTime)}
                        </dd>
                        <dt className="text-ink-400">اتاق و مدرس</dt>
                        <dd className="text-ink-100">
                          {drawerEffective.error !== null
                            ? "خوانده نشد"
                            : drawerEffective.session
                              ? `${roomIndex.get(drawerEffective.session.roomId)?.name ?? NO_DATA} · ${
                                  teacherIndex.get(drawerEffective.session.teacherId)?.name ?? NO_DATA
                                }`
                              : NO_DATA}
                        </dd>
                      </>
                    )}
                    <dt className="text-ink-400">جابه‌جایی‌ها</dt>
                    <dd className="text-ink-100">{faNum(open.currentAttempt.rescheduleCount)} بار</dd>
                  </dl>

                  <p className="text-[11px] leading-relaxed text-ink-400">
                    جلسهٔ کنونی: <span className="nums text-ink-300">{open.currentAttempt.sessionId}</span>
                    {open.currentAttempt.sessionStatus === "missing" && (
                      <> — این شناسه تاریخی است و جلسه‌ای برای باز کردن یا جابه‌جا کردن ندارد.</>
                    )}
                    {open.currentAttempt.rescheduleCount > 0 && open.currentAttempt.sessionStatus !== "missing" && (
                      <>
                        {" "}
                        — نخستین ثبت روی جلسهٔ <span className="nums">{open.currentAttempt.bookedSessionId}</span> بود
                        که با جابه‌جایی لغو شده است.
                      </>
                    )}
                  </p>

                  {/*
                    A failed read of the make-up is DISTINCT from a make-up that is
                    not there (audit S-3): the id says a session exists, so silence
                    or "—" would read as "no data" when the truth is "not read".
                    Said visibly, with a retry — never only in a hover title — and
                    the move below stays unavailable until a read answers.
                  */}
                  {drawerEffective.error !== null && (
                    <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-danger-200">
                      <p>
                        جلسهٔ کنونی خوانده نشد: {drawerEffective.error.message} تا خوانده‌شدن آن، تاریخ، اتاق و
                        مدرس این جلسه نامعلوم‌اند و جابه‌جایی ممکن نیست.
                      </p>
                      <Button
                        variant="subtle"
                        size="sm"
                        className="mt-2"
                        onClick={() => drawerEffective.reload()}
                      >
                        تلاش دوباره
                      </Button>
                    </div>
                  )}

                  {rosterDisclosure(open) && (
                    <p className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn-200">
                      {rosterDisclosure(open)}
                    </p>
                  )}

                  <div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-300">
                      <History className="size-3.5" /> تاریخچهٔ ثبت‌ها (قدیمی به جدید)
                    </h4>
                    <ul className="space-y-1 text-[11.5px] text-ink-300">
                      {open.attempts.map((attempt, index) => (
                        <li key={`${attempt.sessionId}-${index}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="nums text-ink-400">#{faNum(index + 1)}</span>
                          <span className="nums">{jalaliDay(attempt.scheduledAt)}</span>
                          <span className="nums text-ink-500">{attempt.sessionId}</span>
                          <span className="text-ink-500">ثبت‌کننده: {attempt.scheduledByUserId}</span>
                          {index === open.attempts.length - 1 && (
                            <StatusBadge tone="gold" label="جلسهٔ کنونی" glyph={false} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* Actions. A teacher (or anyone without `schedule.write`) never sees
                one: the domain would refuse, and a control whose operation cannot
                run is removed rather than present-and-refused (M2). */}
            {canWrite && actor && (
              <section className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                {open.status === "required" && (
                  <Button
                    variant="primary"
                    // The form is seeded with the domain's own default, which is a
                    // REFORMAT of the original session — so the row has to be in hand
                    // before the dialog opens. Disabled, never opened-with-a-guess;
                    // a deleted original has no default to offer (the operator fills
                    // the form), so that case is enabled at once.
                    disabled={drawerOriginal.loading && !drawerOriginal.session}
                    title={
                      drawerOriginal.loading && !drawerOriginal.session
                        ? "برای ثبت جلسهٔ جبرانی، جلسهٔ لغوشده باید خوانده شود."
                        : undefined
                    }
                    onClick={() => setBookingId(open.id)}
                  >
                    <CalendarClock className="size-4" /> ثبت جلسهٔ جبرانی
                  </Button>
                )}
                {open.status === "scheduled" && (
                  <>
                    <Button variant="primary" onClick={() => setCompletingId(open.id)}>
                      ثبت انجام جبرانی
                    </Button>
                    <Button
                      variant="subtle"
                      disabled={!drawerEffective.session}
                      title={drawerEffective.session ? undefined : "برای جابه‌جایی، جلسهٔ کنونی باید خوانده شود."}
                      onClick={() => {
                        if (!drawerEffective.session) return;
                        setMoving({ compensation: open, session: drawerEffective.session });
                      }}
                    >
                      جابه‌جایی جلسه
                    </Button>
                    {drawerEffective.error !== null && (
                      <span className="text-[11.5px] text-warn-200">
                        جابه‌جایی تا خوانده‌شدن جلسهٔ کنونی ممکن نیست.
                      </span>
                    )}
                  </>
                )}
                {open.status === "completed" && (
                  <p className="text-[11.5px] text-ink-400">این تعهد بسته شده است؛ عملیات دیگری روی آن وجود ندارد.</p>
                )}
              </section>
            )}
          </div>
        )}
      </Drawer>

      {/* ---------------- dialogs ---------------- */}

      {/* S-4: what the candidate list is a list OF is stated rather than implied —
          the window, the page cap, whether the read hit that cap, and whether the
          "already registered" exclusion was computed over a partial ledger page. */}
      {registerOpen && actor && (
        <RegisterCompensationDialog
          open
          candidates={candidates}
          candidatesLoading={cancelledSessions.loading || classes.loading}
          candidatesUnavailable={
            cancelledSessions.error?.message ?? classes.error?.message ?? null
          }
          candidatesWindow={{
            ...candidateWindow,
            daysBack: CANDIDATE_DAYS_BACK,
            daysForward: CANDIDATE_DAYS_FORWARD,
            perPage: CANDIDATES_PER_PAGE,
          }}
          candidatesTruncated={
            !cancelledSessions.loading && cancelledSessions.total > cancelledSessions.items.length
          }
          alreadyRegisteredIsPartial={truncated}
          onSubmit={(values) => ledger.register({ ...values, actor })}
          onRejected={registerRefused}
          onWritten={registerDone}
          onClose={() => setRegisterOpen(false)}
        />
      )}

      {bookingTarget && actor && (
        <ScheduleCompensationDialog
          open
          compensation={bookingTarget}
          original={drawerOriginal.session}
          frozenStudentName={studentNameOf(bookingTarget.studentId)}
          classTitle={classTitleOf(bookingTarget.classId)}
          rooms={rooms.items}
          teachers={teachers.items}
          roomsUnavailable={rooms.error !== null}
          teachersUnavailable={teachers.error !== null}
          onSubmit={(values) => ledger.schedule(bookingTarget.id, { ...values, actor })}
          onRejected={bookingRefused}
          onWritten={bookingDone}
          onClose={() => setBookingId(null)}
        />
      )}

      {completingId && actor && (() => {
        const target = ledger.items.find((row) => row.id === completingId);
        if (!target) return null;
        return (
          <CompleteCompensationDialog
            open
            compensation={target}
            frozenStudentName={studentNameOf(target.studentId)}
            effectiveLabel={
              target.currentAttempt
                ? jalaliDayTime(drawerEffective.session?.date, drawerEffective.session?.startTime)
                : NO_DATA
            }
            onSubmit={() => ledger.complete(target.id, { actor })}
            onRejected={completingRefused}
            onWritten={completingDone}
            onClose={() => setCompletingId(null)}
          />
        );
      })()}

      {moving && actor && (
        <RescheduleSessionDialog
          open
          session={moving.session}
          classTitle={classTitleOf(moving.compensation.classId)}
          rooms={rooms.items}
          teachers={teachers.items}
          roomsUnavailable={rooms.error !== null}
          teachersUnavailable={teachers.error !== null}
          onSubmit={(id, input) => getSchedulingRepository().rescheduleSession(id, input)}
          onRejected={movingRefused}
          onWritten={movingDone}
          onClose={() => setMoving(null)}
        />
      )}
    </>
  );
}
