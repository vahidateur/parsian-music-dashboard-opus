/**
 * Repertoire + progress repository contract.
 *
 * One repository covers pieces, assignments and progress events because their
 * invariants are inseparable: an event must belong to an open assignment, an
 * assignment's snapshot is derived from its newest event, and closing an
 * assignment must not orphan history. Splitting them would push those rules
 * into callers.
 *
 * Analytics live behind the repository too (`insightsForStudent`) so a future
 * API implementation can compute them server-side over the full history
 * instead of shipping every event to the browser.
 */
import type { Page } from "@/api/types";
import type {
  AssignmentListParams,
  CreateAssignmentInput,
  CreatePieceInput,
  Piece,
  PieceAssignment,
  PieceListParams,
  ProgressEvent,
  ProgressEventListParams,
  RecordProgressInput,
  UpdateAssignmentInput,
  UpdatePieceInput,
} from "./types";
import type { ProgressInsight } from "./analytics";
import type { Recommendation } from "./recommendations";

/** An assignment joined with its piece — what every UI actually needs. */
export interface AssignmentWithPiece {
  assignment: PieceAssignment;
  piece: Piece | undefined;
}

/** Everything the student/teacher progress view needs, in one round trip. */
export interface StudentProgressOverview {
  assignments: AssignmentWithPiece[];
  insights: ProgressInsight[];
  recommendations: Recommendation[];
  /** Most recent events across all pieces, newest first. Bounded. */
  recentEvents: ProgressEvent[];
}

export interface ProgressRepository {
  /* ---- pieces ---- */
  listPieces(params?: PieceListParams, signal?: AbortSignal): Promise<Page<Piece>>;
  getPiece(id: string, signal?: AbortSignal): Promise<Piece>;
  createPiece(input: CreatePieceInput): Promise<Piece>;
  updatePiece(id: string, input: UpdatePieceInput): Promise<Piece>;
  /** Refused while any assignment references the piece; deactivate instead. */
  deletePiece(id: string): Promise<void>;

  /* ---- assignments ---- */
  listAssignments(params?: AssignmentListParams, signal?: AbortSignal): Promise<Page<PieceAssignment>>;
  getAssignment(id: string, signal?: AbortSignal): Promise<PieceAssignment>;
  assignPiece(input: CreateAssignmentInput): Promise<PieceAssignment>;
  updateAssignment(id: string, input: UpdateAssignmentInput): Promise<PieceAssignment>;
  /**
   * Removes an assignment **and refuses** when progress events exist, so a
   * deletion can never silently destroy history. Close it instead.
   */
  deleteAssignment(id: string): Promise<void>;

  /* ---- progress events (append-only) ---- */
  listEvents(params?: ProgressEventListParams, signal?: AbortSignal): Promise<Page<ProgressEvent>>;
  recordProgress(input: RecordProgressInput): Promise<ProgressEvent>;

  /* ---- derived ---- */
  /** Assignments joined with pieces for one student. */
  studentAssignments(studentId: string, signal?: AbortSignal): Promise<AssignmentWithPiece[]>;
  /** Analytics + recommendations for one student's active assignments. */
  studentOverview(studentId: string, signal?: AbortSignal): Promise<StudentProgressOverview>;
}
