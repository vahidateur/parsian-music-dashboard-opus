/**
 * Demo implementation of the repertoire + progress repository.
 *
 * INVARIANTS OWNED HERE (never in the UI):
 *
 *   - a student may hold only ONE open assignment per piece;
 *   - a progress event must target an existing, non-closed assignment;
 *   - mastery, tempo, practice minutes and ranges are range-checked;
 *   - a piece using numeric ranges rejects a bare label and vice versa;
 *   - the event log is append-only — nothing here updates or deletes an event;
 *   - deleting an assignment with history is refused, because that would
 *     destroy the evidence every analytic depends on (§27).
 *
 * The `latest` snapshot on an assignment is a denormalized projection of the
 * newest event, recomputed on every append. It exists purely so listing twenty
 * assignments does not require twenty history scans, and it is always
 * rebuildable from the log.
 */
import type { Page } from "@/api/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { notFound, paginate, sortRows, validationError, conflict, matchesQuery } from "@/domains/shared/demoCollection";
import { resolveEligibleContent } from "@/domains/learning/eligibility";
import { classifyProgress, DEFAULT_THRESHOLDS, type ProgressInsight } from "./analytics";
import { recommendForAssignment, sortRecommendations, type Recommendation } from "./recommendations";
import type {
  AssignmentListParams,
  CreateAssignmentInput,
  CreatePieceInput,
  Piece,
  PieceAssignment,
  PieceListParams,
  ProgressEvent,
  ProgressEventListParams,
  ProgressSnapshot,
  RecordProgressInput,
  UpdateAssignmentInput,
  UpdatePieceInput,
} from "./types";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  CLOSED_ASSIGNMENT_STATUSES,
  MASTERY_SCALE,
  MAX_RANGE_VALUE,
  PRACTICE_MINUTES_BOUNDS,
  TEMPO_BOUNDS,
} from "./types";
import type { AssignmentWithPiece, ProgressRepository, StudentProgressOverview } from "./repository";

/** How many recent events the overview carries. Bounded for performance. */
const RECENT_EVENT_LIMIT = 20;

export class DemoProgressRepository implements ProgressRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  /* ---------------- pieces ---------------- */

  async listPieces(params: PieceListParams = {}): Promise<Page<Piece>> {
    let rows = this.store.pieces.all();
    if (params.instrumentId) rows = rows.filter((p) => p.instrumentId === params.instrumentId);
    if (params.programId) rows = rows.filter((p) => p.programId === params.programId);
    if (params.activeOnly) rows = rows.filter((p) => p.active);
    if (params.search) rows = rows.filter((p) => matchesQuery([p.title, p.composer], params.search));
    return paginate(sortRows(rows, (p) => p.title), params);
  }

  async getPiece(id: string): Promise<Piece> {
    const piece = this.store.pieces.find(id);
    if (!piece) throw notFound("PIECE_NOT_FOUND", "قطعه یافت نشد.");
    return piece;
  }

  async createPiece(input: CreatePieceInput): Promise<Piece> {
    this.validatePiece(input);
    return this.store.pieces.create({
      ...input,
      contentIds: input.contentIds ?? [],
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  async updatePiece(id: string, input: UpdatePieceInput): Promise<Piece> {
    const existing = await this.getPiece(id);
    this.validatePiece({ ...existing, ...input });
    const updated = this.store.pieces.update(id, input);
    if (!updated) throw notFound("PIECE_NOT_FOUND", "قطعه یافت نشد.");
    return updated;
  }

  async deletePiece(id: string): Promise<void> {
    await this.getPiece(id);
    const used = this.store.pieceAssignments.all().some((a) => a.pieceId === id);
    if (used) {
      throw conflict(
        "PIECE_IN_USE",
        "این قطعه به هنرجویانی تخصیص داده شده است و حذف نمی‌شود. به‌جای حذف، آن را غیرفعال کنید.",
      );
    }
    this.store.pieces.remove(id);
  }

  private validatePiece(piece: Partial<Piece>): void {
    const fields: Record<string, string[]> = {};
    if (!piece.title || piece.title.trim().length === 0) fields.title = ["عنوان قطعه الزامی است."];
    if (!piece.instrumentId) fields.instrumentId = ["ساز الزامی است."];
    else if (!this.store.instruments.find(piece.instrumentId)) fields.instrumentId = ["ساز نامعتبر است."];

    if (piece.programId && !this.store.programs.find(piece.programId)) {
      fields.programId = ["دوره نامعتبر است."];
    }
    if (piece.recommendedLevelId && !this.store.levels.find(piece.recommendedLevelId)) {
      fields.recommendedLevelId = ["سطح نامعتبر است."];
    }
    if (
      piece.totalRange !== undefined &&
      (!Number.isFinite(piece.totalRange) || piece.totalRange <= 0 || piece.totalRange > MAX_RANGE_VALUE)
    ) {
      fields.totalRange = ["مقدار نامعتبر است."];
    }
    if (Object.keys(fields).length > 0) {
      throw validationError("PIECE_INVALID", "اطلاعات قطعه معتبر نیست.", fields);
    }
  }

  /* ---------------- assignments ---------------- */

  async listAssignments(params: AssignmentListParams = {}): Promise<Page<PieceAssignment>> {
    let rows = this.store.pieceAssignments.all();
    if (params.studentId) rows = rows.filter((a) => a.studentId === params.studentId);
    if (params.pieceId) rows = rows.filter((a) => a.pieceId === params.pieceId);
    if (params.teacherId) rows = rows.filter((a) => a.teacherId === params.teacherId);
    if (params.status) rows = rows.filter((a) => a.status === params.status);
    if (params.activeOnly) rows = rows.filter((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status));
    // Newest assignment first: the current work is what a teacher opens for.
    return paginate(
      [...rows].sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt)),
      params,
    );
  }

  async getAssignment(id: string): Promise<PieceAssignment> {
    const assignment = this.store.pieceAssignments.find(id);
    if (!assignment) throw notFound("ASSIGNMENT_NOT_FOUND", "تخصیص قطعه یافت نشد.");
    return assignment;
  }

  async assignPiece(input: CreateAssignmentInput): Promise<PieceAssignment> {
    const fields: Record<string, string[]> = {};
    if (!this.store.students.find(input.studentId)) fields.studentId = ["هنرجو یافت نشد."];

    const piece = this.store.pieces.find(input.pieceId);
    if (!piece) fields.pieceId = ["قطعه یافت نشد."];
    else if (!piece.active) fields.pieceId = ["این قطعه غیرفعال است."];

    if (input.teacherId && !this.store.teachers.find(input.teacherId)) {
      fields.teacherId = ["مدرس یافت نشد."];
    }
    if (Object.keys(fields).length > 0) {
      throw validationError("ASSIGNMENT_INVALID", "اطلاعات تخصیص معتبر نیست.", fields);
    }

    // One open assignment per (student, piece). A finished piece may be
    // re-assigned later, which is why only OPEN ones block.
    const duplicate = this.store.pieceAssignments
      .all()
      .find(
        (a) =>
          a.studentId === input.studentId &&
          a.pieceId === input.pieceId &&
          !CLOSED_ASSIGNMENT_STATUSES.includes(a.status),
      );
    if (duplicate) {
      throw conflict("ASSIGNMENT_DUPLICATE", "این قطعه هم‌اکنون به این هنرجو تخصیص دارد.");
    }

    return this.store.pieceAssignments.create({
      studentId: input.studentId,
      pieceId: input.pieceId,
      teacherId: input.teacherId,
      status: input.status ?? "planned",
      assignedAt: input.assignedAt ?? new Date().toISOString(),
      targetDate: input.targetDate,
      notes: input.notes ?? "",
    });
  }

  async updateAssignment(id: string, input: UpdateAssignmentInput): Promise<PieceAssignment> {
    const existing = await this.getAssignment(id);
    if (input.teacherId && !this.store.teachers.find(input.teacherId)) {
      throw validationError("ASSIGNMENT_INVALID", "مدرس یافت نشد.", { teacherId: ["نامعتبر است"] });
    }

    const patch: Partial<PieceAssignment> = { ...input };
    // Closing stamps the moment; reopening clears it, so the field never lies.
    if (input.status && CLOSED_ASSIGNMENT_STATUSES.includes(input.status)) {
      patch.closedAt = existing.closedAt ?? new Date().toISOString();
    } else if (input.status) {
      patch.closedAt = undefined;
    }

    const updated = this.store.pieceAssignments.update(id, patch);
    if (!updated) throw notFound("ASSIGNMENT_NOT_FOUND", "تخصیص قطعه یافت نشد.");
    return updated;
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.getAssignment(id);
    const hasHistory = this.store.progressEvents.all().some((e) => e.assignmentId === id);
    if (hasHistory) {
      throw conflict(
        "ASSIGNMENT_HAS_HISTORY",
        "برای این تخصیص سابقهٔ پیشرفت ثبت شده است و حذف نمی‌شود. وضعیت آن را به «رهاشده» تغییر دهید.",
      );
    }
    this.store.pieceAssignments.remove(id);
  }

  /* ---------------- progress events ---------------- */

  async listEvents(params: ProgressEventListParams = {}): Promise<Page<ProgressEvent>> {
    let rows = this.store.progressEvents.all();
    if (params.studentId) rows = rows.filter((e) => e.studentId === params.studentId);
    if (params.pieceId) rows = rows.filter((e) => e.pieceId === params.pieceId);
    if (params.assignmentId) rows = rows.filter((e) => e.assignmentId === params.assignmentId);
    if (params.since) {
      const since = Date.parse(params.since);
      rows = rows.filter((e) => Date.parse(e.recordedAt) >= since);
    }
    if (params.until) {
      const until = Date.parse(params.until);
      rows = rows.filter((e) => Date.parse(e.recordedAt) <= until);
    }
    // Newest first: a timeline shows the most recent observation at the top.
    return paginate(
      [...rows].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)),
      params,
    );
  }

  async recordProgress(input: RecordProgressInput): Promise<ProgressEvent> {
    const assignment = await this.getAssignment(input.assignmentId);
    const piece = this.store.pieces.find(assignment.pieceId);

    const fields: Record<string, string[]> = {};

    if (CLOSED_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      fields.assignmentId = ["این تخصیص بسته شده است و پیشرفت جدیدی نمی‌پذیرد."];
    }

    // Mastery is the one always-required measurement.
    if (
      !Number.isFinite(input.mastery) ||
      !Number.isInteger(input.mastery) ||
      input.mastery < MASTERY_SCALE.min ||
      input.mastery > MASTERY_SCALE.max
    ) {
      fields.mastery = [`تسلط باید عددی صحیح بین ${MASTERY_SCALE.min} تا ${MASTERY_SCALE.max} باشد.`];
    }

    for (const [key, value] of [
      ["tempoBpm", input.tempoBpm],
      ["targetTempoBpm", input.targetTempoBpm],
    ] as const) {
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < TEMPO_BOUNDS.min || value > TEMPO_BOUNDS.max) {
        fields[key] = [`سرعت باید بین ${TEMPO_BOUNDS.min} تا ${TEMPO_BOUNDS.max} ضرب در دقیقه باشد.`];
      }
    }

    if (input.practiceMinutes !== undefined) {
      const minutes = input.practiceMinutes;
      if (
        !Number.isFinite(minutes) ||
        minutes < PRACTICE_MINUTES_BOUNDS.min ||
        minutes > PRACTICE_MINUTES_BOUNDS.max
      ) {
        fields.practiceMinutes = [`مدت تمرین باید بین ${PRACTICE_MINUTES_BOUNDS.min} تا ${PRACTICE_MINUTES_BOUNDS.max} دقیقه باشد.`];
      }
    }

    // Range: shape must match how the piece is subdivided.
    const usesFreeform = piece?.rangeUnit === "freeform";
    const hasNumericRange = input.rangeStart !== undefined || input.rangeEnd !== undefined;

    if (hasNumericRange) {
      if (usesFreeform) {
        fields.rangeStart = ["این قطعه محدودهٔ عددی ندارد؛ از برچسب متنی استفاده کنید."];
      } else {
        const start = input.rangeStart;
        const end = input.rangeEnd;
        if (start !== undefined && (!Number.isFinite(start) || start < 0 || start > MAX_RANGE_VALUE)) {
          fields.rangeStart = ["مقدار نامعتبر است."];
        }
        if (end !== undefined && (!Number.isFinite(end) || end < 0 || end > MAX_RANGE_VALUE)) {
          fields.rangeEnd = ["مقدار نامعتبر است."];
        }
        if (start !== undefined && end !== undefined && end < start) {
          fields.rangeEnd = ["پایان محدوده نمی‌تواند کوچک‌تر از شروع باشد."];
        }
        if (piece?.totalRange !== undefined && end !== undefined && end > piece.totalRange) {
          fields.rangeEnd = [`این قطعه ${piece.totalRange} ${piece.rangeUnit === "measure" ? "میزان" : "واحد"} دارد.`];
        }
      }
    } else if (usesFreeform && !input.rangeLabel) {
      fields.rangeLabel = ["برای این قطعه، توضیح محدوده الزامی است."];
    }

    if (Object.keys(fields).length > 0) {
      throw validationError("PROGRESS_INVALID", "اطلاعات پیشرفت معتبر نیست.", fields);
    }

    const event = this.store.progressEvents.create({
      studentId: assignment.studentId,
      pieceId: assignment.pieceId,
      assignmentId: assignment.id,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      rangeLabel: input.rangeLabel,
      tempoBpm: input.tempoBpm,
      targetTempoBpm: input.targetTempoBpm,
      mastery: input.mastery,
      practiceMinutes: input.practiceMinutes,
      teacherNote: input.teacherNote,
      studentNote: input.studentNote,
      source: input.source,
      sessionId: input.sessionId,
    });

    this.refreshSnapshot(assignment.id);
    return event;
  }

  /**
   * Recomputes an assignment's cached snapshot from its newest event.
   *
   * Derived strictly from the log, so a back-dated entry cannot make the
   * snapshot disagree with the history a chart draws.
   */
  private refreshSnapshot(assignmentId: string): void {
    const events = this.store.progressEvents.all().filter((e) => e.assignmentId === assignmentId);
    if (events.length === 0) return;

    const newest = events.reduce((latest, candidate) =>
      Date.parse(candidate.recordedAt) >= Date.parse(latest.recordedAt) ? candidate : latest,
    );

    const snapshot: ProgressSnapshot = {
      rangeStart: newest.rangeStart,
      rangeEnd: newest.rangeEnd,
      rangeLabel: newest.rangeLabel,
      tempoBpm: newest.tempoBpm,
      targetTempoBpm: newest.targetTempoBpm,
      mastery: newest.mastery,
      recordedAt: newest.recordedAt,
      eventId: newest.id,
    };
    this.store.pieceAssignments.update(assignmentId, { latest: snapshot });
  }

  /* ---------------- derived ---------------- */

  async studentAssignments(studentId: string): Promise<AssignmentWithPiece[]> {
    const assignments = this.store.pieceAssignments.all().filter((a) => a.studentId === studentId);
    // One index build, then constant-time joins — not a scan per assignment.
    const pieces = new Map(this.store.pieces.all().map((p) => [p.id, p]));
    return assignments
      .sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt))
      .map((assignment) => ({ assignment, piece: pieces.get(assignment.pieceId) }));
  }

  async studentOverview(studentId: string): Promise<StudentProgressOverview> {
    const joined = await this.studentAssignments(studentId);

    // Group the student's events by assignment in ONE pass, rather than
    // filtering the whole log once per assignment.
    const byAssignment = new Map<string, ProgressEvent[]>();
    for (const event of this.store.progressEvents.all()) {
      if (event.studentId !== studentId) continue;
      const list = byAssignment.get(event.assignmentId) ?? [];
      list.push(event);
      byAssignment.set(event.assignmentId, list);
    }

    // Eligible content, resolved once and shared by every recommendation, so
    // suggestions can never escape what the student may open (§21).
    const eligible = this.eligibleFor(studentId);

    const insights: ProgressInsight[] = [];
    const recommendations: Recommendation[] = [];

    for (const { assignment, piece } of joined) {
      // Closed assignments are history, not something to advise on.
      if (CLOSED_ASSIGNMENT_STATUSES.includes(assignment.status)) continue;

      const events = byAssignment.get(assignment.id) ?? [];
      const insight = classifyProgress(assignment.id, assignment.pieceId, events, DEFAULT_THRESHOLDS);
      insights.push(insight);
      recommendations.push(
        ...recommendForAssignment({ insight, assignment, piece, eligibleContent: eligible }),
      );
    }

    const recentEvents = [...byAssignment.values()]
      .flat()
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
      .slice(0, RECENT_EVENT_LIMIT);

    return {
      assignments: joined,
      insights,
      recommendations: sortRecommendations(recommendations),
      recentEvents,
    };
  }

  /** Content this student may open, via the shared eligibility rule. */
  private eligibleFor(studentId: string) {
    const placement = this.store.placements.all().find((p) => p.studentId === studentId);
    if (!placement) return [];
    return resolveEligibleContent({
      placement,
      levels: this.store.levels.all(),
      links: this.store.levelContent.all(),
      content: this.store.learningContent.all(),
    });
  }
}
