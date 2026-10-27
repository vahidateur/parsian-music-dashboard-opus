import type { ApiClient } from "@/api/client";
import { isApiError } from "@/api/errors";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { LearningRepository } from "./repository";
import type {
  AssignPlacementInput,
  AttachContentIntent,
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
  LockedContent,
  PlacementListParams,
  StudentPlacement,
  UpdateContentInput,
  UpdateLevelInput,
  UpdateProgramInput,
} from "./types";

const RESOURCE = "learning";

/**
 * REST implementation of the learning domain.
 *
 * Endpoints (served by the server now):
 *   programs  GET|POST /learning/programs, GET|PATCH|DELETE /learning/programs/{id}
 *   levels    GET|POST /learning/levels, GET|PATCH|DELETE /learning/levels/{id},
 *             POST /learning/levels/{id}/reorder
 *   content   GET|POST /learning/content, GET|PATCH|DELETE /learning/content/{id}
 *   links     GET|POST /learning/levels/{id}/links, DELETE .../links/{contentId}
 *   placement GET|POST /learning/placements, GET|DELETE /learning/students/{id}/placement
 *   derived   GET /learning/students/{id}/eligible-content|locked-content,
 *             GET /learning/content/{id}/eligible-students
 *
 * Reads are allowed to every role that works with students
 * (`learning.read`); writes require `learning.write` (administrator, manager
 * and teacher, per DECISIONS.md §34).
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so pickers and panels refresh without knowing
 * who wrote. A write the server refused changes nothing, so the version is
 * bumped only after the write has actually happened.
 */
export class ApiLearningRepository implements LearningRepository {
  constructor(private readonly client: ApiClient) {}

  /* ------------------------------------------------------------ programs */

  listPrograms(params: LearningProgramListParams = {}, signal?: AbortSignal): Promise<Page<LearningProgram>> {
    return this.client.getPage<LearningProgram>(`${RESOURCE}/programs`, { query: toProgramQuery(params), signal });
  }

  getProgram(id: string, signal?: AbortSignal): Promise<LearningProgram> {
    return this.client.get<LearningProgram>(`${RESOURCE}/programs/${encodeURIComponent(id)}`, { signal });
  }

  async createProgram(input: CreateProgramInput): Promise<LearningProgram> {
    const created = await this.client.post<LearningProgram>(`${RESOURCE}/programs`, input);
    bumpDataVersion();
    return created;
  }

  async updateProgram(id: string, input: UpdateProgramInput): Promise<LearningProgram> {
    const updated = await this.client.patch<LearningProgram>(`${RESOURCE}/programs/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async deleteProgram(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/programs/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  /* -------------------------------------------------------------- levels */

  listLevels(params: LearningLevelListParams = {}, signal?: AbortSignal): Promise<Page<LearningLevel>> {
    return this.client.getPage<LearningLevel>(`${RESOURCE}/levels`, { query: toLevelQuery(params), signal });
  }

  getLevel(id: string, signal?: AbortSignal): Promise<LearningLevel> {
    return this.client.get<LearningLevel>(`${RESOURCE}/levels/${encodeURIComponent(id)}`, { signal });
  }

  async createLevel(input: CreateLevelInput): Promise<LearningLevel> {
    const created = await this.client.post<LearningLevel>(`${RESOURCE}/levels`, input);
    bumpDataVersion();
    return created;
  }

  async updateLevel(id: string, input: UpdateLevelInput): Promise<LearningLevel> {
    const updated = await this.client.patch<LearningLevel>(`${RESOURCE}/levels/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async reorderLevel(id: string, newOrder: number): Promise<LearningLevel> {
    const updated = await this.client.post<LearningLevel>(`${RESOURCE}/levels/${encodeURIComponent(id)}/reorder`, {
      order: newOrder,
    });
    bumpDataVersion();
    return updated;
  }

  async deleteLevel(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/levels/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  /* ------------------------------------------------------------- content */

  listContent(params: LearningContentListParams = {}, signal?: AbortSignal): Promise<Page<LearningContent>> {
    return this.client.getPage<LearningContent>(`${RESOURCE}/content`, { query: toContentQuery(params), signal });
  }

  getContent(id: string, signal?: AbortSignal): Promise<LearningContent> {
    return this.client.get<LearningContent>(`${RESOURCE}/content/${encodeURIComponent(id)}`, { signal });
  }

  async createContent(input: CreateContentInput): Promise<LearningContent> {
    const created = await this.client.post<LearningContent>(`${RESOURCE}/content`, input);
    bumpDataVersion();
    return created;
  }

  async updateContent(id: string, input: UpdateContentInput): Promise<LearningContent> {
    const updated = await this.client.patch<LearningContent>(`${RESOURCE}/content/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async deleteContent(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/content/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }

  /* --------------------------------------------------------------- links */

  async listLinks(levelId?: string, signal?: AbortSignal): Promise<LevelContentLink[]> {
    // Links are a sub-collection, not a page: the server returns a bare
    // `{ data: [...] }` envelope and the client unwraps it, same shape the
    // demo repository returns.
    return this.client.get<LevelContentLink[]>(`${RESOURCE}/links`, {
      query: levelId ? { levelId } : undefined,
      signal,
    });
  }

  async attachContent(levelId: string, contentId: string, intent: AttachContentIntent): Promise<LevelContentLink> {
    const created = await this.client.post<LevelContentLink>(
      `${RESOURCE}/levels/${encodeURIComponent(levelId)}/links`,
      { contentId, programId: intent.programId },
    );
    bumpDataVersion();
    return created;
  }

  async detachContent(levelId: string, contentId: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/levels/${encodeURIComponent(levelId)}/links/${encodeURIComponent(contentId)}`);
    bumpDataVersion();
  }

  /* ---------------------------------------------------------- placements */

  listPlacements(params: PlacementListParams = {}, signal?: AbortSignal): Promise<Page<StudentPlacement>> {
    return this.client.getPage<StudentPlacement>(`${RESOURCE}/placements`, { query: toPlacementQuery(params), signal });
  }

  async getStudentPlacement(studentId: string, signal?: AbortSignal): Promise<StudentPlacement | undefined> {
    try {
      return await this.client.get<StudentPlacement>(`${RESOURCE}/students/${encodeURIComponent(studentId)}/placement`, {
        signal,
      });
    } catch (error) {
      // No placement is an honest empty state, not a failure: the panel
      // renders its unplaced UI rather than an error.
      if (isApiError(error) && error.code === "PLACEMENT_NOT_FOUND") return undefined;
      throw error;
    }
  }

  async assignPlacement(input: AssignPlacementInput): Promise<StudentPlacement> {
    const saved = await this.client.post<StudentPlacement>(`${RESOURCE}/placements`, input);
    bumpDataVersion();
    return saved;
  }

  async removePlacement(studentId: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/students/${encodeURIComponent(studentId)}/placement`);
    bumpDataVersion();
  }

  /* ------------------------------------------------------------- derived */

  eligibleContent(studentId: string, signal?: AbortSignal): Promise<EligibleContent[]> {
    return this.client.get<EligibleContent[]>(`${RESOURCE}/students/${encodeURIComponent(studentId)}/eligible-content`, {
      signal,
    });
  }

  lockedContent(studentId: string, signal?: AbortSignal): Promise<LockedContent[]> {
    return this.client.get<LockedContent[]>(`${RESOURCE}/students/${encodeURIComponent(studentId)}/locked-content`, {
      signal,
    });
  }

  eligibleStudentIds(contentId: string, signal?: AbortSignal): Promise<string[]> {
    return this.client.get<string[]>(`${RESOURCE}/content/${encodeURIComponent(contentId)}/eligible-students`, {
      signal,
    });
  }
}

/** Domain params → wire query params (snake_case, as per the API contract). */
export function toProgramQuery(params: LearningProgramListParams): QueryParams {
  return {
    search: params.search,
    instrumentId: params.instrumentId,
    activeOnly: params.activeOnly ? 1 : undefined,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toLevelQuery(params: LearningLevelListParams): QueryParams {
  return {
    programId: params.programId,
    activeOnly: params.activeOnly ? 1 : undefined,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toContentQuery(params: LearningContentListParams): QueryParams {
  return {
    type: params.type,
    search: params.search,
    activeOnly: params.activeOnly ? 1 : undefined,
    levelId: params.levelId,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toPlacementQuery(params: PlacementListParams): QueryParams {
  return {
    studentId: params.studentId,
    programId: params.programId,
    levelId: params.levelId,
    page: params.page,
    per_page: params.per_page,
  };
}
