/**
 * The teaching desk — the reading half.
 *
 * ONE READ SET, ONE SNAPSHOT
 *
 * Like `useDashboardInsights` does for the management dashboard, the teacher's
 * panels are all projections of these reads: one calendar window, one register
 * window, one roster read, one progress read. A single retry re-reads
 * everything on screen, and two panels cannot disagree with each other
 * mid-write.
 *
 * WHAT IS READ, AND WHY IT IS BOUNDED
 *
 *   · sessions   — seven days up to today, filtered by `teacherId` (the filter
 *                  the scheduling repository genuinely honours). It powers the
 *                  day, the register queue and the hero's wave;
 *   · attendance — the marks inside the same window, so an ended session can be
 *                  told from an *unread* one;
 *   · classes    — filtered by `teacherId`;
 *   · students · enrollments · assignments · pieces · events · levels · library
 *                · conversations — one stated page each, narrowed immediately to
 *                  the assigned students where that applies.
 *
 * Every page size is written at the call site. A read that was truncated raises
 * a completeness flag, and a surface that would otherwise imply "all clear"
 * says so instead: a page boundary never becomes a zero.
 *
 * THE ONE THING THIS HOOK WILL NOT DO
 *
 * It will not fall back to the organization's students. When the signed-in
 * account carries no linked teacher record the reads are issued for an id no
 * teacher can hold (`NO_TEACHER_LINK`), the resolved scope is empty, and the
 * view renders a blocked state — the fail-closed direction `views/Students.tsx`
 * already takes.
 */
import { useCallback, useMemo } from "react";
import type { ApiError } from "@/api/errors";
import { useAttendanceRecords } from "@/domains/attendance/useAttendance";
import { useClasses } from "@/domains/classes/useClasses";
import { useConversations } from "@/domains/chat/useChat";
import { useEnrollments } from "@/domains/enrollments/useEnrollments";
import { useLearningContent, useLevels } from "@/domains/learning/useLearning";
import { useLibraryList } from "@/domains/library/useLibrary";
import { useAssignments, usePieces, useProgressEvents } from "@/domains/progress/useProgress";
import { useRooms } from "@/domains/rooms/useRooms";
import { addDays } from "@/domains/scheduling/dateBridge";
import { useSessions } from "@/domains/scheduling/useScheduling";
import { useStudentList } from "@/domains/students/useStudents";
import { deriveFlowRows, type FlowRow, type FlowSummary } from "./dashboardInsights";
import {
  REGISTER_LOOKBACK_DAYS,
  buildDeskStudents,
  buildLessonFocus,
  buildTeacherDay,
  buildTeachingSignals,
  dayWindowInstants,
  resolveTeacherScope,
  teacherDayPulse,
  teacherMayTakeRegister,
  type DeskStudent,
  type LessonFocus,
  type TeacherDayModel,
  type TeacherRegisterRow,
  type TeachingSignal,
} from "./teacherDesk";
import type { DayPulse } from "./useDayPulse";
import type { Actor } from "@/domains/auth/scope";
import type { AcademyClass } from "@/domains/classes/types";
import type { ChatConversation } from "@/domains/chat/types";
import type { LearningContent } from "@/domains/learning/types";
import type { LibraryItem } from "@/domains/library/types";
import type { Session } from "@/domains/scheduling/types";

/**
 * The id the scoped reads are issued for when the account has no teacher link.
 *
 * Deliberately not a real id: the repositories answer an empty page, so a
 * misconfigured account cannot pull the organization's students into a teacher
 * surface even for one frame.
 */
export const NO_TEACHER_LINK = "no-teacher-link";

const SESSIONS_PER_PAGE = 200;
const SUPPORT_PER_PAGE = 200;
const STUDENTS_PER_PAGE = 500;
const ENROLLMENTS_PER_PAGE = 500;
const PROGRESS_PER_PAGE = 500;
const CONVERSATIONS_PER_PAGE = 200;
const CONTENT_PER_PAGE = 200;
/** More than any single academy day, so the timeline is never silently cut. */
const DAY_ROWS_LIMIT = 60;

export interface TeacherDeskEvidence {
  /** Every read the roster rule depends on answered whole. */
  roster: boolean;
  /** The marks read answered a page that covers the window. */
  marks: boolean;
  /** The progress reads answered whole. */
  progress: boolean;
}

export interface TeacherDesk {
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  /** False when the account has no linked teacher record. */
  resolved: boolean;
  teacherId: string | null;
  /** The teacher's own classes. */
  myClasses: AcademyClass[];
  /** Day + register queue, or `null` while the calendar/class read has not answered. */
  day: TeacherDayModel | null;
  /** Today's rows in the timeline's own shape, or `null` when the calendar read failed. */
  flow: { rows: FlowRow[]; summary: FlowSummary } | null;
  /** The same shape the management hero renders, over the teacher's own rows. */
  pulse: DayPulse;
  students: DeskStudent[];
  studentsLoading: boolean;
  signals: TeachingSignal[];
  lessons: LessonFocus[];
  sessionById: ReadonlyMap<string, Session>;
  classById: ReadonlyMap<string, AcademyClass>;
  roomNameById: ReadonlyMap<string, string>;
  /** Sessions this teacher is authorised to take the register for. */
  writableSessionIds: ReadonlySet<string>;
  conversations: ChatConversation[];
  /** Unread across the conversation rows, or `null` when that read is short. */
  unreadTotal: number | null;
  libraryRows: LibraryItem[];
  libraryTotal: number;
  libraryLoading: boolean;
  evidence: TeacherDeskEvidence;
}

export function useTeacherDesk(input: {
  teacherId: string | null;
  todayIso: string;
  nowMinutes: number;
  nowIso: string;
  /** The viewer's own `Actor`, for `canWriteAttendance`. Absent ⇒ nothing is writable. */
  actor: Actor | null;
}): TeacherDesk {
  const { teacherId, todayIso, nowMinutes, nowIso } = input;
  const scopedTeacherId = teacherId ?? NO_TEACHER_LINK;
  const fromIso = addDays(todayIso, -REGISTER_LOOKBACK_DAYS) ?? todayIso;
  const { since, until } = dayWindowInstants(fromIso, todayIso);

  const sessions = useSessions({ from: fromIso, to: todayIso, teacherId: scopedTeacherId, per_page: SESSIONS_PER_PAGE });
  const rooms = useRooms({ per_page: SUPPORT_PER_PAGE });
  const classRead = useClasses({ teacherId: scopedTeacherId, per_page: SUPPORT_PER_PAGE });
  const enrollmentRead = useEnrollments({ per_page: ENROLLMENTS_PER_PAGE });
  /*
    The student page is read whole and narrowed immediately to the assigned set.
    The assignment edge is an enrolment in this teacher's class, which a student
    record's own advisory `teacherId` cannot express (a student enrolled in my
    class may carry somebody else's id there).
  */
  const studentRead = useStudentList({ per_page: STUDENTS_PER_PAGE });
  const marks = useAttendanceRecords({ since, until, per_page: PROGRESS_PER_PAGE });
  const assignments = useAssignments({ activeOnly: true, per_page: PROGRESS_PER_PAGE });
  const events = useProgressEvents({ per_page: PROGRESS_PER_PAGE });
  const pieces = usePieces({ per_page: PROGRESS_PER_PAGE });
  const levels = useLevels({ per_page: PROGRESS_PER_PAGE });
  const library = useLibraryList({ per_page: SUPPORT_PER_PAGE });
  const conversations = useConversations({ per_page: CONVERSATIONS_PER_PAGE });

  const myClasses = useMemo(
    () => classRead.items.filter((row) => row.teacherId === scopedTeacherId),
    [classRead.items, scopedTeacherId],
  );

  const scope = useMemo(
    () => resolveTeacherScope({ teacherId, classes: classRead.items, enrollments: enrollmentRead.items }),
    [teacherId, classRead.items, enrollmentRead.items],
  );

  const windowSessions = useMemo(
    () => sessions.items.filter((row) => row.teacherId === scopedTeacherId),
    [sessions.items, scopedTeacherId],
  );

  const classById = useMemo(() => new Map(myClasses.map((row) => [row.id, row])), [myClasses]);
  const roomNameById = useMemo(
    () => new Map(rooms.items.map((row) => [row.id, row.name])),
    [rooms.items],
  );
  const levelsById = useMemo(() => new Map(levels.items.map((row) => [row.id, row])), [levels.items]);
  const piecesById = useMemo(() => new Map(pieces.items.map((row) => [row.id, row])), [pieces.items]);
  const sessionById = useMemo(() => new Map(windowSessions.map((row) => [row.id, row])), [windowSessions]);

  const rosterEvidence =
    !classRead.loading &&
    classRead.error === null &&
    !enrollmentRead.loading &&
    enrollmentRead.error === null &&
    !studentRead.loading &&
    studentRead.error === null &&
    enrollmentRead.total === enrollmentRead.items.length &&
    studentRead.total === studentRead.students.length;
  const marksEvidence =
    !marks.loading && marks.error === null && marks.total === marks.items.length;
  const progressEvidence =
    !assignments.loading &&
    assignments.error === null &&
    assignments.total === assignments.items.length &&
    !events.loading &&
    events.error === null &&
    events.total === events.items.length;

  const dayReady =
    !sessions.loading && sessions.error === null && !classRead.loading && classRead.error === null;

  const day = useMemo(
    () =>
      dayReady
        ? buildTeacherDay({
            teacherId,
            sessions: windowSessions,
            todayIso,
            nowMinutes,
            classesById: classById,
            enrollments: scope.enrollments,
            students: studentRead.students,
            marks: marksEvidence ? marks.items : null,
            evidenceComplete: rosterEvidence,
          })
        : null,
    [
      dayReady, windowSessions, teacherId, todayIso, nowMinutes, classById, scope.enrollments,
      studentRead.students, marks.items, marksEvidence, rosterEvidence,
    ],
  );

  const flow = useMemo(
    () =>
      sessions.error !== null
        ? null
        : deriveFlowRows(
            windowSessions,
            todayIso,
            nowMinutes,
            {
              classes: classById,
              rooms: new Map(rooms.items.map((row) => [row.id, row])),
              // Every row is this teacher's own session, so the drawer's teacher
              // label reads «شما» rather than repeating a name back to its owner.
              teachers: new Map([[scopedTeacherId, "شما"]]),
            },
            DAY_ROWS_LIMIT,
          ),
    [sessions.error, windowSessions, todayIso, nowMinutes, classById, rooms.items, scopedTeacherId],
  );

  const pulse = useMemo<DayPulse>(() => {
    const todaySessions = day?.todaySessions ?? [];
    const model = teacherDayPulse(todaySessions, nowMinutes);
    return {
      live: model.live,
      conflicts: model.conflicts,
      firstConflictStart: model.firstConflictStart,
      sessions: [...todaySessions],
      clashIds: new Set(model.clashIds),
      loading: sessions.loading,
      error: sessions.error,
    };
  }, [day, nowMinutes, sessions.loading, sessions.error]);

  const absencesByStudent = useMemo(() => {
    const counts = new Map<string, number>();
    if (!marksEvidence) return counts;
    const mySessionIds = new Set(windowSessions.map((row) => row.id));
    for (const mark of marks.items) {
      if (mark.status !== "absent" || !mySessionIds.has(mark.sessionId)) continue;
      counts.set(mark.studentId, (counts.get(mark.studentId) ?? 0) + 1);
    }
    return counts;
  }, [marks.items, marksEvidence, windowSessions]);

  const students = useMemo(
    () =>
      buildDeskStudents({
        students: studentRead.students,
        assignableStudentIds: scope.studentIds,
        assignments: assignments.items,
        piecesById,
        events: events.items,
        absencesByStudent,
        todayIso,
        nowIso,
      }),
    [
      studentRead.students, scope.studentIds, assignments.items, piecesById, events.items,
      absencesByStudent, todayIso, nowIso,
    ],
  );

  const signals = useMemo(
    () =>
      buildTeachingSignals({
        todayIso,
        nowIso,
        assignableStudentIds: scope.studentIds,
        studentNameById: new Map(students.map((row) => [row.id, row.name])),
        assignments: assignments.items,
        piecesById,
        events: events.items,
        absencesByStudent,
      }),
    [
      todayIso, nowIso, scope.studentIds, students, assignments.items, piecesById, events.items,
      absencesByStudent,
    ],
  );

  const lessons = useMemo(() => buildLessonFocus(myClasses, levelsById), [myClasses, levelsById]);

  /**
   * Which registers this teacher may actually take.
   *
   * The decision is `canWriteAttendance` — permission, the session being theirs,
   * the student being assigned — never the role name. A register that is due but
   * not writable is still listed; it is shown with the reason it cannot be
   * opened here instead of a button that would fail.
   */
  const writableSessionIds = useMemo(() => {
    const writable = new Set<string>();
    const actor = input.actor;
    if (!actor || !actor.permissions.includes("attendance.write") || !teacherId) return writable;
    const scopeActor: Actor = { ...actor, teacherId };
    for (const session of windowSessions) {
      const ROW = day?.bySessionId.get(session.id);
      if (!ROW?.registerDue || !ROW.rosterStudentIds || ROW.rosterStudentIds.length === 0) continue;
      const allowed = teacherMayTakeRegister({
        actor: scopeActor,
        session: { id: session.id, classId: session.classId, teacherId: session.teacherId },
        rosterStudentIds: ROW.rosterStudentIds,
        classes: classRead.items,
        enrollments: enrollmentRead.items,
      });
      if (allowed) writable.add(session.id);
    }
    return writable;
  }, [
    input.actor, teacherId, windowSessions, day, classRead.items, enrollmentRead.items,
  ]);

  const unreadTotal = useMemo(() => {
    if (conversations.loading || conversations.error !== null) return null;
    if (conversations.total !== conversations.items.length) return null;
    return conversations.items.reduce((total, row) => total + row.unread, 0);
  }, [conversations.loading, conversations.error, conversations.total, conversations.items]);

  const error: ApiError | null =
    sessions.error ?? classRead.error ?? enrollmentRead.error ?? studentRead.error ?? null;
  const loading = sessions.loading || classRead.loading || enrollmentRead.loading || studentRead.loading;

  const reloadAll = useCallback(() => {
    sessions.reload();
    rooms.reload();
    classRead.reload();
    enrollmentRead.reload();
    studentRead.reload();
    marks.reload();
    assignments.reload();
    events.reload();
    pieces.reload();
    levels.reload();
    library.reload();
    conversations.reload();
    // `teacherMayTakeRegister` depends on these reads too, so the callback is
    // rebuilt with them — this array is the honest dependency list, even though
    // the body only forwards `reload` calls.
  }, [
    sessions, rooms, classRead, enrollmentRead, studentRead, marks, assignments, events, pieces,
    levels, library, conversations,
  ]);

  return {
    loading,
    error,
    reload: reloadAll,
    resolved: scope.resolved,
    teacherId,
    myClasses,
    day,
    flow: flow === null ? null : { rows: flow.rows, summary: flow.summary },
    pulse,
    students,
    studentsLoading: studentRead.loading,
    signals,
    lessons,
    sessionById,
    classById,
    roomNameById,
    writableSessionIds,
    conversations: conversations.items,
    unreadTotal,
    libraryRows: library.items,
    libraryTotal: library.total,
    libraryLoading: library.loading,
    evidence: { roster: rosterEvidence, marks: marksEvidence, progress: progressEvidence },
  };
}

/**
 * The material linked to ONE class's level — the focused class only.
 *
 * One level at a time is deliberate: `listContent` takes a single `levelId`, and
 * a hook per class would be a hook whose count changes with the read. Focus also
 * matches how a desk is used — a teacher is preparing *this* lesson, not
 * auditing the whole ladder. With no level bound the read is `per_page: 0`, the
 * idiom `StudentLearningPanel` uses when a student has no placement.
 */
export function useTeacherLessonContent(levelId: string | null): {
  content: LearningContent[];
  loading: boolean;
  error: ApiError | null;
  complete: boolean;
} {
  const page = useLearningContent(
    levelId ? { levelId, activeOnly: true, per_page: CONTENT_PER_PAGE } : { per_page: 0 },
  );
  return {
    content: page.items,
    loading: page.loading,
    error: page.error,
    complete: !page.loading && page.error === null && page.total === page.items.length,
  };
}

/** The register row of one session, for a row that already resolved the session. */
export function registerRowOf(
  day: TeacherDayModel | null,
  sessionId: string,
): TeacherRegisterRow | undefined {
  return day?.bySessionId.get(sessionId);
}
