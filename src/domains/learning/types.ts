/**
 * Learning domain — programs, levels, content and student placement.
 *
 * MODEL
 *
 *   Instrument
 *     └── LearningProgram        (e.g. "ویولن کلاسیک")
 *           └── LearningLevel    (ordered 1..N — N is per program, never global)
 *                 └── LearningContent  (via LevelContentLink)
 *
 *   Student ──> StudentPlacement ──> (program, current level)
 *
 * ELIGIBILITY IS COMPUTED, NEVER COPIED.
 *
 * The requirement "when a student reaches level 3, level 3 content becomes
 * available" is satisfied by a *rule over relationships*, not by duplicating
 * content rows per student. A student's eligible content is derived at read
 * time from their placement:
 *
 *   eligible(student) = content linked to any level of the student's program
 *                       whose `order` <= the student's current level order
 *
 * Consequences that fall out for free:
 *   - changing a student's level instantly changes their eligible set
 *   - linking content to a level instantly changes every eligible student
 *   - nothing has to be migrated, back-filled or kept in sync
 *
 * The cumulative rule (`<=` rather than `===`) is deliberate: a level-3 violin
 * student should still be able to open level-1 material. `LearningLevel.
 * exclusive` opts a level out when content should be visible only at that
 * exact level.
 *
 * MULTI-TENANCY (§21): every table here needs `organization_id` in production.
 *
 * F1: Level N eligible 1..N, N+1+ locked with honest reason در سطح X باز می‌شود,
 * locked no preview/download, not_visible hidden, not_found honest, not_applicable empty,
 * one content linked to several reachable levels emitted once lowest level,
 * sorting levelOrder ASC sortOrder ASC title fa, canonical owner learning/eligibility.ts,
 * O-01 remains OPEN.
 */
import type { ListParams } from "@/api/types";
import type { InstrumentId } from "@/domains/instruments/types";
import type { MediaKind } from "@/domains/media/types";

/* ------------------------------------------------------------------ */
/* Program                                                             */
/* ------------------------------------------------------------------ */

/**
 * A curriculum for one instrument. An instrument may offer several (e.g.
 * "ویولن کلاسیک" and "ویولن ایرانی"), each with its own number of levels.
 */
export interface LearningProgram {
  id: string;
  instrumentId: string;
  name: string;
  description: string;
  active: boolean;
}

export interface LearningProgramListParams extends ListParams {
  instrumentId?: string;
  activeOnly?: boolean;
  search?: string;
}

export type CreateProgramInput = Omit<LearningProgram, "id">;
export type UpdateProgramInput = Partial<Omit<LearningProgram, "id">>;

/* ------------------------------------------------------------------ */
/* Level                                                               */
/* ------------------------------------------------------------------ */

/**
 * One rung of a program. `order` is 1-based and unique within a program; it —
 * not the id — defines progression, so levels can be renamed without breaking
 * eligibility.
 */
export interface LearningLevel {
  id: string;
  programId: string;
  /** 1-based position within the program. Unique per program. */
  order: number;
  name: string;
  description: string;
  /** Learning outcomes for this level, shown on the student's page. */
  objectives: string[];
  /**
   * Free-text teacher notes for the level — what a structured description is
   * too tight for: recommendations, cautions, suggested resources. Optional and
   * display-only; eligibility and progression never read it.
   */
  notes?: string;
  /** Inactive levels keep their history but cannot be newly assigned. */
  active: boolean;
  /**
   * When true, content on this level is visible ONLY to students placed
   * exactly here, overriding the cumulative rule.
   */
  exclusive?: boolean;
  /**
   * Levels a student is expected to have completed first.
   *
   * ADVISORY, NOT ENFORCED. A teacher may legitimately place a transferring
   * student at level 5 without them having passed levels 1–4 here. The UI
   * surfaces an unmet prerequisite as information; the repository does not
   * refuse the placement, because that would encode a policy the academy has
   * not asked for. Cycles are rejected — a prerequisite graph that loops is
   * always a data error.
   */
  prerequisiteLevelIds?: string[];
}

export interface LearningLevelListParams extends ListParams {
  programId?: string;
  activeOnly?: boolean;
}

export type CreateLevelInput = Omit<LearningLevel, "id" | "order"> & Partial<Pick<LearningLevel, "order">>;
export type UpdateLevelInput = Partial<Omit<LearningLevel, "id" | "programId">>;

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/** Content types the library can hold. `voice` is a short spoken recording. */
export type LearningContentType = "pdf" | "image" | "audio" | "voice" | "video" | "document";

/** Maps a content type onto the media-storage kind used for its binary. */
export const CONTENT_MEDIA_KIND: Record<LearningContentType, MediaKind> = {
  pdf: "document",
  image: "image",
  audio: "audio",
  voice: "audio",
  video: "document",
  document: "document",
};

/**
 * One piece of teaching material. Exists once, globally, and is *linked* to
 * levels — never duplicated per student or per level.
 */
export interface LearningContent {
  id: string;
  title: string;
  description: string;
  type: LearningContentType;
  /** Reference into the media domain; absent while metadata-only. */
  mediaId?: string;
  /** Optional attribution, e.g. composer or author. */
  author?: string;
  /** Optional teacher who contributed the material. */
  teacherId?: string;
  /**
   * Instrument this material belongs to. Optional because some content
   * (theory, ear training) is genuinely instrument-agnostic; when set, the
   * library can filter by it.
   */
  instrumentId?: InstrumentId;
  /**
   * Who may see it once eligible.
   *
   * `students` — visible to any eligible student (the default);
   * `teachers`  — staff-facing material (marking schemes, teacher notes) that
   *               eligibility must never expose to a student.
   */
  visibility: ContentVisibility;
  /** ISO-8601. */
  createdAt: string;
  active: boolean;
}

/** Audience for a piece of learning content. */
export type ContentVisibility = "students" | "teachers";

export interface LearningContentListParams extends ListParams {
  type?: LearningContentType;
  search?: string;
  activeOnly?: boolean;
  /** Restrict to content linked to this level. */
  levelId?: string;
}

export type CreateContentInput = Omit<LearningContent, "id" | "createdAt"> & Partial<Pick<LearningContent, "createdAt">>;
export type UpdateContentInput = Partial<Omit<LearningContent, "id" | "createdAt">>;

/* ------------------------------------------------------------------ */
/* Level ↔ Content link                                                */
/* ------------------------------------------------------------------ */

/**
 * The many-to-many edge. One content item can serve several levels (and
 * several programs) without being copied.
 */
export interface LevelContentLink {
  id: string;
  levelId: string;
  contentId: string;
  /** Ordering of content within the level. */
  sortOrder: number;
}

/**
 * The caller's own answer to "which program is that level in?", handed to
 * `attachContent` alongside the level so the repository has something to compare
 * the level against.
 *
 * WHY IT EXISTS (I13 Checkpoint 2). A surface renders level rows from a list
 * query. `attachContent(levelId, contentId)` checked only that both ids existed,
 * so if the row on screen belonged to a program the user had navigated away
 * from, the write still succeeded: content landed on a ladder nobody was looking
 * at, and because eligibility is derived from links, it silently changed what
 * every placed student of *that* program could open. `assignPlacement` never had
 * this hole, because it is handed a `programId` as well as a `levelId` and
 * refuses the pair when they disagree. This is the same contract, no larger.
 *
 * THE VALUE MUST BE RESOLVED INDEPENDENTLY of the level being written to — it
 * comes from the program the caller selected and read its own context from,
 * never from `level.programId` read back off the target. A caller that passes
 * the target's own program makes the comparison a tautology and the guard
 * proves nothing, which is the same reason two values taken from one stale row
 * cannot contradict each other.
 */
export interface AttachContentIntent {
  /** Program the caller resolved the target level to belong to. */
  programId: string;
}

/* ------------------------------------------------------------------ */
/* Student placement                                                   */
/* ------------------------------------------------------------------ */

/**
 * Where a student currently sits in a program. One active placement per
 * (student, program); `history` records past levels for progression reporting.
 */
export interface StudentPlacement {
  id: string;
  studentId: string;
  programId: string;
  /** The student's current level. */
  levelId: string;
  /** ISO-8601 date the current level was assigned. */
  assignedAt: string;
  history: PlacementHistoryEntry[];
}

/**
 * One rung of a student's journey.
 *
 * Records BOTH ends of the move. Storing only the level departed from makes a
 * timeline ambiguous when a program also changes, and makes "level 1 → 2 → 3"
 * impossible to render without inferring from adjacency.
 */
export interface PlacementHistoryEntry {
  /** The level being left. Kept as `levelId` for backward compatibility. */
  levelId: string;
  /** The level moved to. Absent on rows written before this field existed. */
  toLevelId?: string;
  /** Program at the time of the change, when it also moved. */
  programId?: string;
  /** ISO-8601 timestamp the change was RECORDED. */
  changedAt: string;
  /**
   * ISO-8601 date the change takes effect, which may differ from when it was
   * entered — a teacher back-dating a promotion to the exam date. Analytics
   * prefer this when present.
   */
  effectiveDate?: string;
  /** Optional short reason, e.g. "قبولی در آزمون سطح". */
  note?: string;
}

export interface PlacementListParams extends ListParams {
  studentId?: string;
  programId?: string;
  levelId?: string;
}

export interface AssignPlacementInput {
  studentId: string;
  programId: string;
  levelId: string;
  note?: string;
  /** ISO-8601 date the placement takes effect; defaults to now. */
  effectiveDate?: string;
}

/* ------------------------------------------------------------------ */
/* Eligibility (derived — never stored) — F1 canonical owner            */
/* ------------------------------------------------------------------ */

/** One eligible item plus the level that granted access, for UI grouping. */
export interface EligibleContent {
  content: LearningContent;
  levelId: string;
  levelOrder: number;
  levelName: string;
  sortOrder: number;
}

/** One locked item — content attached to N+1+ levels with honest reason. F1 */
export interface LockedContent {
  content: LearningContent;
  levelId: string;
  levelOrder: number;
  levelName: string;
  sortOrder: number;
  /** Honest reason per F1: در سطح X باز می‌شود */
  reason: string;
}
