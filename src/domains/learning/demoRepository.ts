/**
 * Demo learning repository.
 *
 * Invariants owned here (never by a dialog):
 *  - a program belongs to an existing instrument
 *  - level `order` is 1-based, contiguous and unique within its program
 *  - a level cannot be deleted while content is linked to it
 *  - a placement's level must belong to the placement's program
 *  - one active placement per student
 *  - attaching content twice to the same level is a no-op conflict, not a copy
 */
import type { Page } from "@/api/types";
import { conflict, matchesQuery, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resolveEligibleContent, resolveEligibleStudentIds } from "./eligibility";
import type { LearningRepository } from "./repository";
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

export class DemoLearningRepository implements LearningRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  /* ---------------------------------------------------------- programs */

  async listPrograms(params: LearningProgramListParams = {}): Promise<Page<LearningProgram>> {
    const rows = this.store.programs.all().filter((row) => {
      if (params.instrumentId && row.instrumentId !== params.instrumentId) return false;
      if (params.activeOnly && !row.active) return false;
      return matchesQuery([row.name, row.description], params.search);
    });
    return paginate(rows, params);
  }

  async getProgram(id: string): Promise<LearningProgram> {
    const found = this.store.programs.find(id);
    if (!found) throw notFound("PROGRAM_NOT_FOUND", `برنامهٔ آموزشی با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async createProgram(input: CreateProgramInput): Promise<LearningProgram> {
    if (input.name.trim().length < 2) {
      throw validationError("PROGRAM_INVALID", "اطلاعات برنامه معتبر نیست.", { name: ["نام برنامه الزامی است."] });
    }
    if (!this.store.instruments.find(input.instrumentId)) {
      throw validationError("PROGRAM_INVALID", "ساز انتخاب‌شده وجود ندارد.", { instrumentId: ["نامعتبر است"] });
    }
    return this.store.programs.create(input);
  }

  async updateProgram(id: string, input: UpdateProgramInput): Promise<LearningProgram> {
    await this.getProgram(id);
    if (input.instrumentId !== undefined && !this.store.instruments.find(input.instrumentId)) {
      throw validationError("PROGRAM_INVALID", "ساز انتخاب‌شده وجود ندارد.", { instrumentId: ["نامعتبر است"] });
    }
    const updated = this.store.programs.update(id, input);
    if (!updated) throw notFound("PROGRAM_NOT_FOUND", `برنامهٔ آموزشی با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async deleteProgram(id: string): Promise<void> {
    await this.getProgram(id);
    if (this.store.placements.all().some((p) => p.programId === id)) {
      throw conflict("PROGRAM_HAS_STUDENTS", "هنرجویانی در این برنامه سطح‌بندی شده‌اند؛ ابتدا آن‌ها را منتقل کنید.");
    }
    if (this.store.levels.all().some((l) => l.programId === id)) {
      throw conflict("PROGRAM_HAS_LEVELS", "ابتدا سطوح این برنامه را حذف کنید.");
    }
    this.store.programs.remove(id);
  }

  /* ------------------------------------------------------------ levels */

  async listLevels(params: LearningLevelListParams = {}): Promise<Page<LearningLevel>> {
    const rows = this.store.levels
      .all()
      .filter((row) => {
        if (params.programId && row.programId !== params.programId) return false;
        if (params.activeOnly && !row.active) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
    return paginate(rows, params);
  }

  async getLevel(id: string): Promise<LearningLevel> {
    const found = this.store.levels.find(id);
    if (!found) throw notFound("LEVEL_NOT_FOUND", `سطح با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async createLevel(input: CreateLevelInput): Promise<LearningLevel> {
    await this.getProgram(input.programId);
    if (input.name.trim().length < 1) {
      throw validationError("LEVEL_INVALID", "اطلاعات سطح معتبر نیست.", { name: ["نام سطح الزامی است."] });
    }
    const siblings = this.siblings(input.programId);
    // Appending is the default; an explicit order inserts and shifts.
    const order = input.order ?? siblings.length + 1;
    if (!Number.isInteger(order) || order < 1 || order > siblings.length + 1) {
      throw validationError("LEVEL_INVALID", "ترتیب سطح معتبر نیست.", { order: ["خارج از محدوده است"] });
    }
    for (const sibling of siblings) {
      if (sibling.order >= order) this.store.levels.update(sibling.id, { order: sibling.order + 1 });
    }
    return this.store.levels.create({ ...input, order });
  }

  async updateLevel(id: string, input: UpdateLevelInput): Promise<LearningLevel> {
    await this.getLevel(id);
    // Order changes go through `reorderLevel`, which keeps siblings contiguous.
    const { order: _ignored, ...patch } = input;
    const updated = this.store.levels.update(id, patch);
    if (!updated) throw notFound("LEVEL_NOT_FOUND", `سطح با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  /**
   * Moves a level within its program and renumbers siblings so the ladder
   * stays 1..N with no gaps or duplicates.
   */
  async reorderLevel(id: string, newOrder: number): Promise<LearningLevel> {
    const level = await this.getLevel(id);
    const siblings = this.siblings(level.programId).sort((a, b) => a.order - b.order);
    if (!Number.isInteger(newOrder) || newOrder < 1 || newOrder > siblings.length) {
      throw validationError("LEVEL_INVALID", "ترتیب سطح معتبر نیست.", { order: ["خارج از محدوده است"] });
    }

    const without = siblings.filter((s) => s.id !== id);
    without.splice(newOrder - 1, 0, level);
    without.forEach((row, index) => {
      const target = index + 1;
      if (row.order !== target) this.store.levels.update(row.id, { order: target });
    });

    return this.getLevel(id);
  }

  async deleteLevel(id: string): Promise<void> {
    const level = await this.getLevel(id);
    if (this.store.levelContent.all().some((l) => l.levelId === id)) {
      throw conflict("LEVEL_HAS_CONTENT", "ابتدا محتوای متصل به این سطح را جدا کنید.");
    }
    if (this.store.placements.all().some((p) => p.levelId === id)) {
      throw conflict("LEVEL_HAS_STUDENTS", "هنرجویانی در این سطح هستند؛ ابتدا سطح آن‌ها را تغییر دهید.");
    }
    this.store.levels.remove(id);

    // Close the gap so the ladder stays contiguous.
    for (const sibling of this.siblings(level.programId)) {
      if (sibling.order > level.order) this.store.levels.update(sibling.id, { order: sibling.order - 1 });
    }
  }

  private siblings(programId: string): LearningLevel[] {
    return this.store.levels.all().filter((row) => row.programId === programId);
  }

  /* ----------------------------------------------------------- content */

  async listContent(params: LearningContentListParams = {}): Promise<Page<LearningContent>> {
    let rows = this.store.learningContent.all();

    // Level filtering resolves through the link table so content is never copied.
    if (params.levelId) {
      const allowed = new Set(
        this.store.levelContent.all().filter((l) => l.levelId === params.levelId).map((l) => l.contentId),
      );
      rows = rows.filter((row) => allowed.has(row.id));
    }
    rows = rows.filter((row) => {
      if (params.type && row.type !== params.type) return false;
      if (params.activeOnly && !row.active) return false;
      return matchesQuery([row.title, row.description, row.author], params.search);
    });
    return paginate(rows, params);
  }

  async getContent(id: string): Promise<LearningContent> {
    const found = this.store.learningContent.find(id);
    if (!found) throw notFound("CONTENT_NOT_FOUND", `محتوا با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async createContent(input: CreateContentInput): Promise<LearningContent> {
    if (input.title.trim().length < 2) {
      throw validationError("CONTENT_INVALID", "اطلاعات محتوا معتبر نیست.", { title: ["عنوان الزامی است."] });
    }
    if (input.mediaId && !this.store.media.find(input.mediaId)) {
      throw validationError("CONTENT_INVALID", "فایل انتخاب‌شده یافت نشد.", { mediaId: ["نامعتبر است"] });
    }
    return this.store.learningContent.create({ ...input, createdAt: input.createdAt ?? new Date().toISOString() });
  }

  async updateContent(id: string, input: UpdateContentInput): Promise<LearningContent> {
    await this.getContent(id);
    if (input.mediaId && !this.store.media.find(input.mediaId)) {
      throw validationError("CONTENT_INVALID", "فایل انتخاب‌شده یافت نشد.", { mediaId: ["نامعتبر است"] });
    }
    const updated = this.store.learningContent.update(id, input);
    if (!updated) throw notFound("CONTENT_NOT_FOUND", `محتوا با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async deleteContent(id: string): Promise<void> {
    await this.getContent(id);
    // Links are owned by the content, so removing it detaches cleanly rather
    // than leaving orphan rows that would break eligibility lookups.
    for (const link of this.store.levelContent.all()) {
      if (link.contentId === id) this.store.levelContent.remove(link.id);
    }
    this.store.learningContent.remove(id);
  }

  /* ------------------------------------------------------------- links */

  async listLinks(levelId?: string): Promise<LevelContentLink[]> {
    const rows = this.store.levelContent.all();
    return levelId ? rows.filter((row) => row.levelId === levelId) : rows;
  }

  async attachContent(levelId: string, contentId: string): Promise<LevelContentLink> {
    await this.getLevel(levelId);
    await this.getContent(contentId);

    const existing = this.store.levelContent
      .all()
      .find((row) => row.levelId === levelId && row.contentId === contentId);
    if (existing) {
      throw conflict("CONTENT_ALREADY_LINKED", "این محتوا از قبل به این سطح متصل است.");
    }
    const siblings = this.store.levelContent.all().filter((row) => row.levelId === levelId);
    return this.store.levelContent.create({ levelId, contentId, sortOrder: siblings.length });
  }

  async detachContent(levelId: string, contentId: string): Promise<void> {
    const link = this.store.levelContent
      .all()
      .find((row) => row.levelId === levelId && row.contentId === contentId);
    if (!link) throw notFound("LINK_NOT_FOUND", "این محتوا به این سطح متصل نیست.");
    this.store.levelContent.remove(link.id);
  }

  /* -------------------------------------------------------- placements */

  async listPlacements(params: PlacementListParams = {}): Promise<Page<StudentPlacement>> {
    const rows = this.store.placements.all().filter((row) => {
      if (params.studentId && row.studentId !== params.studentId) return false;
      if (params.programId && row.programId !== params.programId) return false;
      if (params.levelId && row.levelId !== params.levelId) return false;
      return true;
    });
    return paginate(rows, params);
  }

  async getStudentPlacement(studentId: string): Promise<StudentPlacement | undefined> {
    return this.store.placements.all().find((row) => row.studentId === studentId);
  }

  async assignPlacement(input: AssignPlacementInput): Promise<StudentPlacement> {
    if (!this.store.students.find(input.studentId)) {
      throw validationError("PLACEMENT_INVALID", "هنرجو یافت نشد.", { studentId: ["نامعتبر است"] });
    }
    const level = await this.getLevel(input.levelId);
    await this.getProgram(input.programId);

    // A level from another program would silently break eligibility, which
    // reads levels through the placement's program.
    if (level.programId !== input.programId) {
      throw validationError("PLACEMENT_INVALID", "سطح انتخاب‌شده به این برنامه تعلق ندارد.", {
        levelId: ["با برنامه هم‌خوان نیست"],
      });
    }
    if (!level.active) {
      throw validationError("PLACEMENT_INVALID", "سطح غیرفعال قابل تخصیص نیست.", { levelId: ["غیرفعال است"] });
    }

    const now = new Date().toISOString();
    const existing = await this.getStudentPlacement(input.studentId);

    if (!existing) {
      return this.store.placements.create({
        studentId: input.studentId,
        programId: input.programId,
        levelId: input.levelId,
        assignedAt: input.effectiveDate ?? now,
        history: [],
      });
    }

    // Re-assigning the same level is a no-op rather than a bogus history entry.
    if (existing.levelId === input.levelId && existing.programId === input.programId) return existing;

    const updated = this.store.placements.update(existing.id, {
      programId: input.programId,
      levelId: input.levelId,
      assignedAt: input.effectiveDate ?? now,
      // Append-only: the previous level is recorded with both ends of the
      // move, so a timeline can be rendered without inferring adjacency.
      history: [
        ...existing.history,
        {
          levelId: existing.levelId,
          toLevelId: input.levelId,
          programId: input.programId,
          changedAt: now,
          ...(input.effectiveDate ? { effectiveDate: input.effectiveDate } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
      ],
    });
    if (!updated) throw notFound("PLACEMENT_NOT_FOUND", "سطح‌بندی هنرجو یافت نشد.");
    return updated;
  }

  async removePlacement(studentId: string): Promise<void> {
    const existing = await this.getStudentPlacement(studentId);
    if (!existing) throw notFound("PLACEMENT_NOT_FOUND", "سطح‌بندی هنرجو یافت نشد.");
    this.store.placements.remove(existing.id);
  }

  /* ----------------------------------------------------------- derived */

  async eligibleContent(studentId: string): Promise<EligibleContent[]> {
    return resolveEligibleContent({
      placement: await this.getStudentPlacement(studentId),
      levels: this.store.levels.all(),
      links: this.store.levelContent.all(),
      content: this.store.learningContent.all(),
    });
  }

  async eligibleStudentIds(contentId: string): Promise<string[]> {
    return resolveEligibleStudentIds(
      contentId,
      this.store.levels.all(),
      this.store.levelContent.all(),
      this.store.placements.all(),
    );
  }
}
