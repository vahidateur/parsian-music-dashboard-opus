import type { Page } from "@/api/types";
import type {
  AssignPlacementInput,
  CreateContentInput,
  CreateLevelInput,
  CreateProgramInput,
  EligibleContent,
  LearningContent,
  LearningContentListParams,
  LearningLevel,
  LearningLevelListParams,
  LearningProgram,
  LearningProgramListParams,
  LevelContentLink,
  PlacementListParams,
  StudentPlacement,
  UpdateContentInput,
  UpdateLevelInput,
  UpdateProgramInput,
} from "./types";

/**
 * One repository for the whole learning aggregate.
 *
 * Programs, levels, links and placements are not independently meaningful —
 * a level without its program is nonsense, and eligibility spans all four.
 * Keeping them behind one contract lets the invariants (unique level order,
 * no orphan links, placement matches program) be enforced in one place
 * instead of being split across four repositories that must agree.
 */
export interface LearningRepository {
  /* programs */
  listPrograms(params?: LearningProgramListParams, signal?: AbortSignal): Promise<Page<LearningProgram>>;
  getProgram(id: string, signal?: AbortSignal): Promise<LearningProgram>;
  createProgram(input: CreateProgramInput): Promise<LearningProgram>;
  updateProgram(id: string, input: UpdateProgramInput): Promise<LearningProgram>;
  deleteProgram(id: string): Promise<void>;

  /* levels */
  listLevels(params?: LearningLevelListParams, signal?: AbortSignal): Promise<Page<LearningLevel>>;
  getLevel(id: string, signal?: AbortSignal): Promise<LearningLevel>;
  createLevel(input: CreateLevelInput): Promise<LearningLevel>;
  updateLevel(id: string, input: UpdateLevelInput): Promise<LearningLevel>;
  /** Moves a level to a new 1-based position, renumbering its siblings. */
  reorderLevel(id: string, newOrder: number): Promise<LearningLevel>;
  deleteLevel(id: string): Promise<void>;

  /* content */
  listContent(params?: LearningContentListParams, signal?: AbortSignal): Promise<Page<LearningContent>>;
  getContent(id: string, signal?: AbortSignal): Promise<LearningContent>;
  createContent(input: CreateContentInput): Promise<LearningContent>;
  updateContent(id: string, input: UpdateContentInput): Promise<LearningContent>;
  deleteContent(id: string): Promise<void>;

  /* level ↔ content links */
  listLinks(levelId?: string, signal?: AbortSignal): Promise<LevelContentLink[]>;
  attachContent(levelId: string, contentId: string): Promise<LevelContentLink>;
  detachContent(levelId: string, contentId: string): Promise<void>;

  /* placement */
  listPlacements(params?: PlacementListParams, signal?: AbortSignal): Promise<Page<StudentPlacement>>;
  getStudentPlacement(studentId: string, signal?: AbortSignal): Promise<StudentPlacement | undefined>;
  /** Creates or moves a placement, appending to its history. */
  assignPlacement(input: AssignPlacementInput): Promise<StudentPlacement>;
  removePlacement(studentId: string): Promise<void>;

  /* derived */
  /** Content the student may currently open. Computed, never stored. */
  eligibleContent(studentId: string, signal?: AbortSignal): Promise<EligibleContent[]>;
  /** Students who can currently open a given content item. */
  eligibleStudentIds(contentId: string, signal?: AbortSignal): Promise<string[]>;
}
