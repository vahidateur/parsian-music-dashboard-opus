/**
 * Repertoire and student-progress domain types.
 *
 * WHY THIS IS A SEPARATE DOMAIN FROM `learning`
 *
 * `learning` answers "what does the academy teach, and what may this student
 * open?" — programs, levels, content, eligibility. It is curriculum: mostly
 * static, edited by administrators.
 *
 * `progress` answers "what is this student actually working on, and how is it
 * going?" — pieces, assignments, practice events, analytics. It is
 * high-churn, append-mostly, per-student data.
 *
 * Keeping them apart matters because a progress history grows without bound
 * while a curriculum does not, and because a piece is deliberately NOT a
 * `LearningContent` (see below).
 *
 * PIECE vs LEARNING CONTENT
 *
 * A `LearningContent` is a *resource*: a PDF method book, a backing track, a
 * demonstration video. A `Piece` is a *musical work* a student learns and
 * performs. They overlap but are not the same thing:
 *
 *   - one piece may have several contents (score PDF, reference recording);
 *   - a content (scale exercise sheet) may belong to no piece at all;
 *   - progress is tracked against the piece, never against the PDF.
 *
 * Conflating them would make "mastery of a PDF" a meaningful sentence, which
 * it is not.
 */
import type { ListParams } from "@/api/types";
import type { InstrumentId } from "@/data/academy";

/* ------------------------------------------------------------------ */
/* Piece / repertoire                                                  */
/* ------------------------------------------------------------------ */

/**
 * A musical work in the academy's repertoire.
 *
 * `recommendedLevelId` is advisory, not a gate: a teacher may legitimately
 * assign a stretch piece. Eligibility rules apply to *content*, not to what a
 * teacher chooses to teach.
 */
export interface Piece {
  id: string;
  title: string;
  composer: string;
  instrumentId: InstrumentId;
  /** Optional: a piece can be cross-programme (e.g. a general study). */
  programId?: string;
  /** Advisory difficulty anchor. */
  recommendedLevelId?: string;
  description: string;
  /**
   * How this piece is subdivided for progress tracking. Chosen per piece
   * because a violin sonata is measured in bars while an aural-training track
   * is measured in seconds. See `ProgressRangeUnit`.
   */
  rangeUnit: ProgressRangeUnit;
  /**
   * Total extent in `rangeUnit` (e.g. 120 measures). Optional: unknown for
   * free-form works, in which case range progress is recorded without a
   * denominator and completion percentage is not derived.
   */
  totalRange?: number;
  /** Supporting resources: scores, recordings. Never the source of progress. */
  contentIds: string[];
  active: boolean;
  /** ISO-8601. */
  createdAt: string;
}

/**
 * How a piece is subdivided.
 *
 * Modelled as a unit + numeric range rather than a free-text field so that
 * analytics can compare "measures 37→52" arithmetically. `freeform` exists as
 * the honest escape hatch: it stores a label and disables range arithmetic
 * rather than pretending a number exists.
 */
export type ProgressRangeUnit = "measure" | "section" | "page" | "timestamp" | "freeform";

export const RANGE_UNIT_LABEL: Record<ProgressRangeUnit, string> = {
  measure: "میزان",
  section: "بخش",
  page: "صفحه",
  timestamp: "ثانیه",
  freeform: "آزاد",
};

export interface PieceListParams extends ListParams {
  instrumentId?: InstrumentId;
  programId?: string;
  search?: string;
  activeOnly?: boolean;
}

export type CreatePieceInput = Omit<Piece, "id" | "createdAt" | "contentIds"> &
  Partial<Pick<Piece, "createdAt" | "contentIds">>;
export type UpdatePieceInput = Partial<Omit<Piece, "id" | "createdAt">>;

/* ------------------------------------------------------------------ */
/* Assignment — a student working on a piece                           */
/* ------------------------------------------------------------------ */

/**
 * Lifecycle of a piece for one student.
 *
 * `paused` and `abandoned` are distinct on purpose: paused implies intent to
 * return (illness, exam season), abandoned is a decision. Reporting treats
 * them differently and merging them would lose that.
 */
export type AssignmentStatus = "planned" | "learning" | "polishing" | "completed" | "paused" | "abandoned";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  learning: "در حال یادگیری",
  polishing: "صیقل‌دهی",
  completed: "تکمیل‌شده",
  paused: "متوقف",
  abandoned: "رهاشده",
};

/** Statuses that mean the student is actively working on the piece. */
export const ACTIVE_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ["planned", "learning", "polishing"];

/** Statuses that close an assignment; a new one may then be created. */
export const CLOSED_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ["completed", "abandoned"];

export interface PieceAssignment {
  id: string;
  studentId: string;
  pieceId: string;
  /** Who assigned it. Kept for accountability, not authorization. */
  teacherId?: string;
  status: AssignmentStatus;
  /** ISO-8601 date. */
  assignedAt: string;
  /** ISO-8601 date; advisory. */
  targetDate?: string;
  /** ISO-8601; set when status becomes completed/abandoned. */
  closedAt?: string;
  notes: string;
  /**
   * Denormalized snapshot of the newest progress event, so a list of ten
   * assignments does not need ten history scans. Recomputed by the repository
   * on every write — never edited directly, and always rebuildable from the
   * immutable event log.
   */
  latest?: ProgressSnapshot;
}

/** The mutable "where are we now" view, derived from the newest event. */
export interface ProgressSnapshot {
  rangeStart?: number;
  rangeEnd?: number;
  rangeLabel?: string;
  tempoBpm?: number;
  targetTempoBpm?: number;
  mastery: number;
  /** ISO-8601 of the event this snapshot came from. */
  recordedAt: string;
  eventId: string;
}

export interface AssignmentListParams extends ListParams {
  studentId?: string;
  pieceId?: string;
  teacherId?: string;
  status?: AssignmentStatus;
  /** Only assignments in an active status. */
  activeOnly?: boolean;
}

export interface CreateAssignmentInput {
  studentId: string;
  pieceId: string;
  teacherId?: string;
  status?: AssignmentStatus;
  assignedAt?: string;
  targetDate?: string;
  notes?: string;
}

export type UpdateAssignmentInput = Partial<
  Pick<PieceAssignment, "status" | "targetDate" | "notes" | "teacherId">
>;

/* ------------------------------------------------------------------ */
/* Progress events — the immutable log                                 */
/* ------------------------------------------------------------------ */

/**
 * Who recorded a progress entry.
 *
 * Kept because a teacher's assessment and a student's self-report are not
 * equally authoritative, and analytics may later weight them differently. It
 * is a provenance label, NOT an authorization decision (§31).
 */
export type ProgressSource = "teacher" | "student" | "system";

export const PROGRESS_SOURCE_LABEL: Record<ProgressSource, string> = {
  teacher: "مدرس",
  student: "هنرجو",
  system: "سامانه",
};

/**
 * One practice or lesson observation. **Append-only.**
 *
 * Progress events are never edited or deleted in normal operation: they are
 * the evidence every analytic and every insight is computed from. Correcting
 * a mistake appends a new event rather than rewriting the past, so a chart
 * can never silently change shape.
 */
export interface ProgressEvent {
  id: string;
  studentId: string;
  pieceId: string;
  assignmentId: string;
  /** ISO-8601 timestamp of the observation. */
  recordedAt: string;
  /** Numeric range worked on, in the piece's `rangeUnit`. */
  rangeStart?: number;
  rangeEnd?: number;
  /** Human label, required when the piece uses `freeform`. */
  rangeLabel?: string;
  tempoBpm?: number;
  targetTempoBpm?: number;
  /** 0–100, validated. See MASTERY_SCALE. */
  mastery: number;
  /** Minutes practised, when known. */
  practiceMinutes?: number;
  teacherNote?: string;
  studentNote?: string;
  source: ProgressSource;
  /** Optional link to a class session, when recorded during a lesson. */
  sessionId?: string;
}

export interface ProgressEventListParams extends ListParams {
  studentId?: string;
  pieceId?: string;
  assignmentId?: string;
  /** ISO-8601 lower bound, inclusive. */
  since?: string;
  /** ISO-8601 upper bound, inclusive. */
  until?: string;
}

export interface RecordProgressInput {
  assignmentId: string;
  rangeStart?: number;
  rangeEnd?: number;
  rangeLabel?: string;
  tempoBpm?: number;
  targetTempoBpm?: number;
  mastery: number;
  practiceMinutes?: number;
  teacherNote?: string;
  studentNote?: string;
  source: ProgressSource;
  sessionId?: string;
  /** ISO-8601; defaults to now. Explicit for back-dated lesson entry. */
  recordedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Validation bounds                                                   */
/* ------------------------------------------------------------------ */

/**
 * Mastery is an integer percentage, 0–100.
 *
 * Documented as a single scale so values stay comparable across pieces,
 * teachers and time. A free-form or per-teacher scale would make every trend
 * calculation meaningless.
 */
export const MASTERY_SCALE = { min: 0, max: 100 } as const;

/**
 * Plausible tempo bounds.
 *
 * 20 BPM is slower than any practical practice tempo; 400 BPM is beyond
 * prestissimo. These reject typos (820 for 82) without constraining musically
 * legitimate values.
 */
export const TEMPO_BOUNDS = { min: 20, max: 400 } as const;

/** Guards against a mistyped practice log skewing every average. */
export const PRACTICE_MINUTES_BOUNDS = { min: 0, max: 600 } as const;

/** Upper bound for a numeric range value, to reject absurd input. */
export const MAX_RANGE_VALUE = 100_000;
