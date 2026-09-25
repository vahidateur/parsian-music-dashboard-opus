/**
 * The teaching desk — the pure half.
 *
 * WHAT THIS MODULE IS
 *
 * The teacher dashboard is the same `dashboard` view rendered for a teacher,
 * and every number it shows has to come from records the academy already
 * stores. The derivations live here — no React, no storage — so each rule can
 * be read, unit-tested and reused by a future server implementation, exactly
 * the split `dashboardInsights.ts` makes for the management dashboard.
 *
 * WHAT IT REFUSES TO DO
 *
 *   · It never reads `Student.payment`, `Student.balance` or `Student.status`.
 *     In the seeded academy «در معرض ریزش» travels beside «بدهی», so an
 *     attention list built on that field would be a billing list wearing a
 *     teaching label. Teaching signals come from the immutable `ProgressEvent`
 *     log and from this teacher's own registers.
 *   · It never reads `Teacher.todayClasses`: that fixture field holds `c1, c6,
 *     …` — ids matching no class (`cl…`) and no session in the dataset. The day
 *     comes from the calendar read filtered by `teacherId`, which the
 *     scheduling repository genuinely honours.
 *   · It never turns unavailable evidence into zero. A roster whose reads were
 *     truncated, or a register whose marks could not be read, yields `null`
 *     (rendered «—») and never `0`; and a session is never announced as
 *     "register not taken" while the marks read is incomplete.
 *   · It never calls a past session "held". `completed` is only what the
 *     academy recorded; a slot the clock has passed is described as exactly
 *     that («زمان جلسه گذشته»), the same rule `deriveFlowRows` follows for the
 *     management dashboard — this module reuses that status vocabulary instead
 *     of inventing a second one.
 *
 * SCOPE (T-02, ACCEPTED / ASSIGNED-ONLY)
 *
 * A teacher's students are the students with an ACTIVE enrolment in a class
 * whose `teacherId` is theirs — the rule `auth/scope.ts` already owns
 * (`isAssignedStudent` / `assignedStudentIdsForTeacher`). This module calls
 * those functions instead of re-deriving the join, so the smallest permission
 * model has one implementation, not two.
 */
import { assignedStudentIdsForTeacher, canWriteAttendance, type Actor } from "@/domains/auth/scope";
import { resolveSessionRoster } from "@/domains/attendance/roster";
import {
  DEFAULT_THRESHOLDS,
  PROGRESS_STATUS_LABEL,
  analyzePiece,
  classifyProgress,
  trailingSameRangeCount,
} from "@/domains/progress/analytics";
import { conflictPairs } from "@/domains/shared/dashboardInsights";
import { isoToJalaliDisplay } from "@/domains/scheduling/dateBridge";
import { NO_DATA, faNum, parseTime } from "@/lib/format";
import type { AttendanceRecord } from "@/domains/attendance/types";
import type { AcademyClass } from "@/domains/classes/types";
import type { Enrollment } from "@/domains/enrollments/types";
import type { InstrumentId } from "@/domains/instruments/types";
import type { LearningLevel } from "@/domains/learning/types";
import type { Piece, PieceAssignment, ProgressEvent } from "@/domains/progress/types";
import { ACTIVE_ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_LABEL } from "@/domains/progress/types";
import type { Session } from "@/domains/scheduling/types";
import type { Student } from "@/domains/students/types";

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

export interface TeacherScopeModel {
  /** A linked teacher record exists. When false NOTHING may be shown. */
  resolved: boolean;
  /** Classes whose `teacherId` is this teacher. */
  classIds: ReadonlySet<string>;
  /** Students assigned to this teacher (active enrolment ∩ own class). */
  studentIds: ReadonlySet<string>;
  /** The enrollments the roster rule may read (own classes, active only). */
  enrollments: readonly Enrollment[];
}

/**
 * The teacher's own slice of the academy, from the canonical scope functions.
 *
 * `resolved: false` is the honest answer when the signed-in account carries no
 * `teacherId`: the desk then renders a blocked state instead of the
 * organization's students. There is no org-wide fallback here, by design.
 */
export function resolveTeacherScope(input: {
  teacherId: string | null;
  classes: readonly AcademyClass[];
  enrollments: readonly Enrollment[];
}): TeacherScopeModel {
  const { teacherId } = input;
  if (!teacherId) {
    return { resolved: false, classIds: new Set(), studentIds: new Set(), enrollments: [] };
  }
  const mine = input.classes.filter((row) => row.teacherId === teacherId);
  const classIds = new Set(mine.map((row) => row.id));
  const enrollments = input.enrollments.filter(
    (row) => classIds.has(row.classId) && row.status === "active",
  );
  const studentIds = assignedStudentIdsForTeacher(
    teacherId,
    mine.map((row) => ({ id: row.id, teacherId: row.teacherId })),
    input.enrollments.map((row) => ({
      studentId: row.studentId,
      classId: row.classId,
      status: row.status,
    })),
  );
  return { resolved: true, classIds, studentIds, enrollments };
}

/* ------------------------------------------------------------------ */
/* The day                                                             */
/* ------------------------------------------------------------------ */

/** How many due registers the queue lists before it starts counting. */
export const REGISTER_DUE_LIMIT = 4;

/** Days the register queue looks back over, today included. */
export const REGISTER_LOOKBACK_DAYS = 6;

export interface TeacherRegisterRow {
  sessionId: string;
  classId: string;
  date: string;
  /** The register's expected students, or `null` while that evidence is short. */
  rosterStudentIds: readonly string[] | null;
  /** Marks recorded for this session, or `null` while the marks read is short. */
  marks: number | null;
  /** The session's day/slot is behind today's clock (cancelled excluded). */
  pastByClock: boolean;
  /** The academy recorded the session as held. */
  completed: boolean;
  /** Past by the clock, with a roster, and provably no mark. */
  registerDue: boolean;
  /** A short, honest line about the register, already formatted. */
  registerNote: string;
}

export interface TeacherDayModel {
  /** Register state of every session in the window, by session id. */
  bySessionId: ReadonlyMap<string, TeacherRegisterRow>;
  /** Today's stored sessions, chronological (cancelled included). */
  todaySessions: readonly Session[];
  /** Ended sessions of the window whose register is genuinely due, newest first. */
  due: readonly TeacherRegisterRow[];
  /** Every due register in the window, including the ones past the list limit. */
  dueTotal: number;
  /** Distinct students expected today, or `null` when roster evidence is short. */
  todayStudentCount: number | null;
}

function minutesOf(value: string): number | null {
  const parsed = parseTime(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ISO instants for a closed day window — the shape the attendance read wants. */
export function dayWindowInstants(fromIso: string, toIso: string): { since: string; until: string } {
  return { since: `${fromIso}T00:00:00.000Z`, until: `${toIso}T23:59:59.999Z` };
}

/**
 * The teacher's day and the registers that are due, from records only.
 *
 * `marks: null` means the attendance read did not answer (or answered a page
 * that does not cover the window). In that state every row reports
 * `marks: null` and `registerDue: false`: it cannot tell an unmarked session
 * from an unread one, and saying "not taken" would be a claim about a record
 * nobody read.
 */
export function buildTeacherDay(input: {
  teacherId: string | null;
  /** The window's session rows, read with a `teacherId` filter. */
  sessions: readonly Session[];
  todayIso: string;
  nowMinutes: number;
  classesById: ReadonlyMap<string, AcademyClass>;
  enrollments: readonly Enrollment[];
  students: readonly Student[];
  /** Every mark in the window, or `null` when that read did not answer. */
  marks: readonly AttendanceRecord[] | null;
  /** False when a read the rosters depend on was truncated. */
  evidenceComplete: boolean;
}): TeacherDayModel {
  const marksBySession = new Map<string, number>();
  if (input.marks) {
    for (const mark of input.marks) {
      marksBySession.set(mark.sessionId, (marksBySession.get(mark.sessionId) ?? 0) + 1);
    }
  }

  const mine = input.sessions.filter(
    (row) => input.teacherId === null || row.teacherId === input.teacherId,
  );

  const rosterOf = (session: Session): readonly string[] | null => {
    const klass = input.classesById.get(session.classId);
    if (!klass || !input.evidenceComplete) return null;
    try {
      return resolveSessionRoster({
        classId: klass.id,
        date: session.date,
        enrollments: input.enrollments,
        students: input.students,
      }).map((entry) => entry.studentId);
    } catch {
      // A roster the rule refuses to resolve is not a zero — it is unknown.
      return null;
    }
  };

  const bySessionId = new Map<string, TeacherRegisterRow>();
  for (const session of mine) {
    const end = minutesOf(session.endTime);
    /*
      Past means the session's own day is behind today, or it is today and its
      end has gone by. Comparing the clock time alone would read every earlier
      day as "still ahead" whenever the desk is opened in the morning — hiding
      exactly the registers that are overdue.
    */
    const pastByClock =
      session.status !== "cancelled" &&
      end !== null &&
      (session.date < input.todayIso ||
        (session.date === input.todayIso && end <= input.nowMinutes));
    const completed = session.status === "completed";
    const rosterStudentIds = rosterOf(session);
    const rosterCount = rosterStudentIds === null ? null : rosterStudentIds.length;
    const marks = input.marks ? (marksBySession.get(session.id) ?? 0) : null;
    const registerDue = pastByClock && marks !== null && marks === 0 && rosterCount !== null && rosterCount > 0;

    const registerNote =
      session.status === "cancelled"
        ? "جلسه لغو شده"
        : marks === null
          ? "وضعیت صورت‌جلسه خوانده نشد"
          : marks > 0
            ? `صورت‌جلسه ثبت شده — ${faNum(marks)} مهر`
            : !pastByClock
              ? "در انتظار برگزاری"
              : rosterCount === null
                ? "فهرست هنرجویان خوانده نشد"
                : rosterCount === 0
                  ? "هنرجویی برای این جلسه ثبت نشده"
                  : completed
                    ? "جلسه برگزار شده — صورت‌جلسه ثبت نشده"
                    : "زمان جلسه گذشته — صورت‌جلسه ثبت نشده";

    bySessionId.set(session.id, {
      sessionId: session.id,
      classId: session.classId,
      date: session.date,
      rosterStudentIds,
      marks,
      pastByClock,
      completed,
      registerDue,
      registerNote,
    });
  }

  const byStart = (a: Session, b: Session) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id);
  const todaySessions = mine.filter((row) => row.date === input.todayIso).sort(byStart);

  const due = [...bySessionId.values()]
    .filter((row) => row.registerDue)
    .sort((a, b) => b.date.localeCompare(a.date) || b.sessionId.localeCompare(a.sessionId))
    .slice(0, REGISTER_DUE_LIMIT);
  const dueTotal = [...bySessionId.values()].filter((row) => row.registerDue).length;

  const expected = new Set<string>();
  let studentsKnown = true;
  for (const session of todaySessions) {
    if (session.status === "cancelled") continue;
    const roster = bySessionId.get(session.id)?.rosterStudentIds;
    if (!roster) {
      studentsKnown = false;
      continue;
    }
    for (const studentId of roster) expected.add(studentId);
  }

  return {
    bySessionId,
    todaySessions,
    due,
    dueTotal,
    todayStudentCount: studentsKnown ? expected.size : null,
  };
}

/**
 * The wave's numbers over the teacher's own day.
 *
 * The clash rule is `conflictPairs` — the one definition the Hero, the flow
 * rows and the day pulse already share; a second conflict rule would be a
 * second read path.
 */
export function teacherDayPulse(
  todaySessions: readonly Session[],
  nowMinutes: number,
): { live: number; conflicts: number; firstConflictStart: string | null; clashIds: ReadonlySet<string> } {
  const pairs = conflictPairs(todaySessions);
  const clashIds = new Set<string>();
  for (const pair of pairs) {
    clashIds.add(pair.a.id);
    clashIds.add(pair.b.id);
  }
  const live = todaySessions.filter((session) => {
    if (session.status === "cancelled") return false;
    const start = minutesOf(session.startTime);
    const end = minutesOf(session.endTime);
    return start !== null && end !== null && start <= nowMinutes && nowMinutes < end;
  }).length;
  const firstConflictStart =
    todaySessions
      .filter((session) => clashIds.has(session.id))
      .map((session) => session.startTime)
      .sort()[0] ?? null;
  return { live, conflicts: pairs.length, firstConflictStart, clashIds };
}

/* ------------------------------------------------------------------ */
/* Register authorization                                              */
/* ------------------------------------------------------------------ */

/**
 * Whether THIS teacher may take THIS session's register.
 *
 * The decision is `auth/scope.ts`'s `canWriteAttendance` — the actor's
 * `attendance.write`, the session actually being theirs, and the student being
 * assigned to them — not the role name. The session-level question is asked
 * once per roster member because that is the granularity the canonical rule
 * speaks in; a session with nobody on its register has nobody to authorize for
 * and is not offered.
 */
export function teacherMayTakeRegister(input: {
  actor: Actor;
  session: { id: string; classId: string; teacherId: string };
  rosterStudentIds: readonly string[];
  classes: readonly AcademyClass[];
  enrollments: readonly Enrollment[];
}): boolean {
  if (!input.actor.permissions.includes("attendance.write")) return false;
  if (input.rosterStudentIds.length === 0) return false;
  const classes = input.classes.map((row) => ({ id: row.id, teacherId: row.teacherId }));
  const enrollments = input.enrollments.map((row) => ({
    studentId: row.studentId,
    classId: row.classId,
    status: row.status,
  }));
  return input.rosterStudentIds.some((studentId) =>
    canWriteAttendance(input.actor, { studentId, session: input.session }, { classes, enrollments }),
  );
}

/* ------------------------------------------------------------------ */
/* Teaching attention — educational evidence only                      */
/* ------------------------------------------------------------------ */

export type TeachingSignalKind =
  | "regression"
  | "target_passed"
  | "possible_plateau"
  | "slowing"
  | "absence"
  | "no_evidence"
  | "no_assignment";

/** Reporting order: what is losing ground first, what is merely quiet last. */
export const TEACHING_SIGNAL_RANK: Record<TeachingSignalKind, number> = {
  regression: 0,
  target_passed: 1,
  possible_plateau: 2,
  absence: 3,
  slowing: 4,
  no_evidence: 5,
  no_assignment: 6,
};

/** The one-line label of a signal kind, for the list row. */
export const TEACHING_SIGNAL_LABEL: Record<TeachingSignalKind, string> = {
  regression: "پسرفت",
  target_passed: "تاریخ هدف گذشته",
  possible_plateau: "احتمال توقف",
  slowing: "کند شدن",
  absence: "غیبت",
  no_evidence: "بی‌شواهد",
  no_assignment: "بدون تکلیف",
};

export interface TeachingSignal {
  id: string;
  kind: TeachingSignalKind;
  studentId: string;
  studentName: string;
  pieceTitle?: string;
  /** The measurement behind the signal, in one honest line. */
  detail: string;
  /** ISO instant of the newest record the signal rests on, when it has one. */
  evidenceIso?: string;
}

/** How many register absences start reading as a pattern. */
export const ABSENCE_SIGNAL_MIN = 2;

/**
 * The teacher's attention list, from evidence that is educational by
 * construction: the progress log, the assignment's own target date, and this
 * teacher's registers. Money never enters — see the module header.
 */
export function buildTeachingSignals(input: {
  todayIso: string;
  nowIso: string;
  assignableStudentIds: ReadonlySet<string>;
  studentNameById: ReadonlyMap<string, string>;
  assignments: readonly PieceAssignment[];
  piecesById: ReadonlyMap<string, Piece>;
  events: readonly ProgressEvent[];
  /** Absences counted over THIS teacher's own sessions, per student. */
  absencesByStudent: ReadonlyMap<string, number>;
}): TeachingSignal[] {
  const now = new Date(input.nowIso);
  const activeAssignments = input.assignments.filter(
    (row) => input.assignableStudentIds.has(row.studentId) && ACTIVE_ASSIGNMENT_STATUSES.includes(row.status),
  );

  const eventsByPair = new Map<string, ProgressEvent[]>();
  for (const event of input.events) {
    if (!input.assignableStudentIds.has(event.studentId)) continue;
    const key = `${event.studentId}|${event.pieceId}`;
    const bucket = eventsByPair.get(key);
    if (bucket) bucket.push(event);
    else eventsByPair.set(key, [event]);
  }

  const signals: TeachingSignal[] = [];
  const nameOf = (studentId: string) => input.studentNameById.get(studentId) ?? NO_DATA;

  for (const assignment of activeAssignments) {
    const events = eventsByPair.get(`${assignment.studentId}|${assignment.pieceId}`) ?? [];
    const stats = analyzePiece(events, now);
    const insight = classifyProgress(assignment.id, assignment.pieceId, events, DEFAULT_THRESHOLDS, now);
    const newest = stats.lastRecordedAt;
    const push = (kind: TeachingSignalKind, detail: string) =>
      signals.push({
        id: `${kind}:${assignment.studentId}:${assignment.pieceId}`,
        kind,
        studentId: assignment.studentId,
        studentName: nameOf(assignment.studentId),
        pieceTitle: input.piecesById.get(assignment.pieceId)?.title ?? NO_DATA,
        detail,
        ...(newest ? { evidenceIso: newest } : {}),
      });

    if (insight.status === "regression" && insight.evidence.masteryChange !== null) {
      push(
        "regression",
        `${faNum(Math.abs(Math.round(insight.evidence.masteryChange)))} امتیاز افت تسلط در ${faNum(insight.evidence.windowDays)} روز`,
      );
      continue;
    }

    const targetDate = assignment.targetDate?.slice(0, 10);
    if (targetDate && targetDate < input.todayIso) {
      const shown = isoToJalaliDisplay(targetDate, { day: "numeric", month: "long" });
      push("target_passed", `تاریخ هدف ${shown.length > 0 ? shown : NO_DATA} گذشته است`);
    }

    if (insight.status === "possible_plateau") {
      const repeats = trailingSameRangeCount(events);
      push(
        "possible_plateau",
        insight.evidence.rangeLabel
          ? `${faNum(repeats)} رویداد پشت‌سرهم روی «${insight.evidence.rangeLabel}»`
          : `${faNum(repeats)} رویداد پشت‌سرهم روی یک بخش`,
      );
    } else if (insight.status === "slowing") {
      push("slowing", `سرعت پیشرفت در ${faNum(insight.evidence.windowDays)} روز گذشته کم شده است`);
    }

    if (events.length === 0) {
      push("no_evidence", "برای این تکلیف هیچ شاهدی ثبت نشده");
    } else if (stats.daysSinceLastEvent !== null && stats.daysSinceLastEvent > DEFAULT_THRESHOLDS.recentWindowDays) {
      push("no_evidence", `${faNum(stats.daysSinceLastEvent)} روز از آخرین شاهد گذشت`);
    }
  }

  const withAssignment = new Set(activeAssignments.map((row) => row.studentId));
  for (const studentId of input.assignableStudentIds) {
    if (!withAssignment.has(studentId)) {
      signals.push({
        id: `no_assignment:${studentId}:`,
        kind: "no_assignment",
        studentId,
        studentName: nameOf(studentId),
        detail: "تکلیف فعالی برای این هنرجو ثبت نشده",
      });
    }
    const absences = input.absencesByStudent.get(studentId) ?? 0;
    if (absences >= ABSENCE_SIGNAL_MIN) {
      signals.push({
        id: `absence:${studentId}:`,
        kind: "absence",
        studentId,
        studentName: nameOf(studentId),
        detail: `${faNum(absences)} غیبت در صورت‌جلسه‌های شما`,
      });
    }
  }

  return signals.sort(
    (a, b) =>
      TEACHING_SIGNAL_RANK[a.kind] - TEACHING_SIGNAL_RANK[b.kind] ||
      (b.evidenceIso ?? "").localeCompare(a.evidenceIso ?? "") ||
      a.studentName.localeCompare(b.studentName, "fa"),
  );
}

/* ------------------------------------------------------------------ */
/* Students on the desk                                                */
/* ------------------------------------------------------------------ */

export interface DeskPieceLine {
  assignmentId: string;
  pieceTitle: string;
  statusLabel: string;
  /** Latest recorded mastery, 0–100, or `null` when nothing was recorded. */
  mastery: number | null;
  rangeLabel: string | null;
  /** Days since the newest progress record for this piece, or `null`. */
  daysSinceEvidence: number | null;
  /** The progress classification of this piece, in words. */
  progressLabel: string;
  /** The assignment's own target date has passed. */
  overdue: boolean;
}

export interface DeskStudent {
  id: string;
  name: string;
  instrument: InstrumentId;
  level: string;
  photoMediaId?: string;
  /** Active pieces, as assigned. */
  pieces: DeskPieceLine[];
  /** Newest evidence instant for this student, or `null` when none is recorded. */
  lastEvidenceIso: string | null;
  /** Absences inside this teacher's own registers, inside the window. */
  absences: number;
}

/**
 * The roster the teacher actually teaches: assigned students only, with the
 * progress evidence attached to each of them.
 *
 * `Student.status`, `Student.payment` and `Student.balance` are deliberately
 * not read here: what a teacher needs about a student is what that student is
 * working on and when it was last measured.
 */
export function buildDeskStudents(input: {
  students: readonly Student[];
  assignableStudentIds: ReadonlySet<string>;
  assignments: readonly PieceAssignment[];
  piecesById: ReadonlyMap<string, Piece>;
  events: readonly ProgressEvent[];
  absencesByStudent: ReadonlyMap<string, number>;
  todayIso: string;
  nowIso: string;
}): DeskStudent[] {
  const now = new Date(input.nowIso);
  const mine = input.students.filter((row) => input.assignableStudentIds.has(row.id));

  const eventsByPair = new Map<string, ProgressEvent[]>();
  for (const event of input.events) {
    const key = `${event.studentId}|${event.pieceId}`;
    const bucket = eventsByPair.get(key);
    if (bucket) bucket.push(event);
    else eventsByPair.set(key, [event]);
  }

  return mine
    .map((student) => {
      const assignments = input.assignments.filter(
        (row) => row.studentId === student.id && ACTIVE_ASSIGNMENT_STATUSES.includes(row.status),
      );
      let lastEvidenceIso: string | null = null;
      const pieces = assignments.map((assignment) => {
        const events = eventsByPair.get(`${student.id}|${assignment.pieceId}`) ?? [];
        const stats = analyzePiece(events, now);
        const insight = classifyProgress(assignment.id, assignment.pieceId, events, DEFAULT_THRESHOLDS, now);
        if (stats.lastRecordedAt && (!lastEvidenceIso || stats.lastRecordedAt > lastEvidenceIso)) {
          lastEvidenceIso = stats.lastRecordedAt;
        }
        const targetDate = assignment.targetDate?.slice(0, 10);
        return {
          assignmentId: assignment.id,
          pieceTitle: input.piecesById.get(assignment.pieceId)?.title ?? NO_DATA,
          statusLabel: ASSIGNMENT_STATUS_LABEL[assignment.status],
          mastery: assignment.latest?.mastery ?? null,
          rangeLabel: assignment.latest?.rangeLabel ?? null,
          daysSinceEvidence: stats.daysSinceLastEvent,
          progressLabel: PROGRESS_STATUS_LABEL[insight.status],
          overdue: targetDate !== undefined && targetDate < input.todayIso,
        } satisfies DeskPieceLine;
      });
      return {
        id: student.id,
        name: student.name,
        instrument: student.instrument,
        level: student.level,
        ...(student.photoMediaId ? { photoMediaId: student.photoMediaId } : {}),
        pieces,
        lastEvidenceIso,
        absences: input.absencesByStudent.get(student.id) ?? 0,
      } satisfies DeskStudent;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/* ------------------------------------------------------------------ */
/* Lesson focus                                                        */
/* ------------------------------------------------------------------ */

export interface LessonFocus {
  classId: string;
  className: string;
  instrument: InstrumentId;
  /** The curriculum rung the class is tied to, when it is tied to one. */
  levelId: string | null;
  levelName: string | null;
  levelOrder: number | null;
  objectives: string[];
  levelNotes: string | null;
}

/**
 * What each class is meant to teach — the level its `levelId` names.
 *
 * A class that carries no `levelId` is reported as unbound (`levelId: null`)
 * rather than guessed from its title: the academy has not stated the rung, and
 * inventing one would put a curriculum in front of a teacher that nobody
 * chose.
 */
export function buildLessonFocus(
  classes: readonly AcademyClass[],
  levelsById: ReadonlyMap<string, LearningLevel>,
): LessonFocus[] {
  return classes
    .map((row) => {
      const level = row.levelId ? levelsById.get(row.levelId) : undefined;
      return {
        classId: row.id,
        className: row.title,
        instrument: row.instrument,
        levelId: row.levelId ?? null,
        levelName: level?.name ?? null,
        levelOrder: level?.order ?? null,
        objectives: level?.objectives ?? [],
        levelNotes: level?.notes ?? null,
      } satisfies LessonFocus;
    })
    .sort((a, b) => a.className.localeCompare(b.className, "fa"));
}
