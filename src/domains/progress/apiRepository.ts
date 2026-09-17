/**
 * Implementation #2 — REST backend for repertoire and progress.
 *
 * **No server implements these endpoints yet.** This class exists so the
 * boundary is real rather than hypothetical: it compiles against the same
 * interface the demo satisfies, uses the shared `ApiClient`, and documents the
 * contract a backend must honour. It is deliberately NOT wired into the
 * registry — doing so would produce failing requests dressed up as a feature.
 *
 * Endpoints (contract):
 *   GET    /api/v1/pieces
 *   POST   /api/v1/pieces
 *   GET    /api/v1/pieces/{id}
 *   PATCH  /api/v1/pieces/{id}
 *   DELETE /api/v1/pieces/{id}
 *   GET    /api/v1/piece-assignments
 *   POST   /api/v1/piece-assignments
 *   GET    /api/v1/piece-assignments/{id}
 *   PATCH  /api/v1/piece-assignments/{id}
 *   DELETE /api/v1/piece-assignments/{id}
 *   GET    /api/v1/progress-events
 *   POST   /api/v1/progress-events
 *   GET    /api/v1/students/{id}/progress-overview
 *
 * SERVER-SIDE OBLIGATIONS (see docs/production-handoff.md):
 *   - analytics, plateau detection and recommendations are recomputed on the
 *     server over the FULL history; the client must never be the authority;
 *   - eligibility filtering for suggested content is re-applied server-side,
 *     because a client-side filter is not an authorization boundary;
 *   - `POST /progress-events` is append-only: no PATCH or DELETE is offered
 *     for events, by design.
 */
import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { AssignmentWithPiece, ProgressRepository, StudentProgressOverview } from "./repository";
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

const PIECES = "pieces";
const ASSIGNMENTS = "piece-assignments";
const EVENTS = "progress-events";

export class ApiProgressRepository implements ProgressRepository {
  constructor(private readonly client: ApiClient) {}

  /* ---- pieces ---- */

  listPieces(params: PieceListParams = {}, signal?: AbortSignal): Promise<Page<Piece>> {
    return this.client.getPage<Piece>(PIECES, { query: pieceQuery(params), signal });
  }

  getPiece(id: string, signal?: AbortSignal): Promise<Piece> {
    return this.client.get<Piece>(`${PIECES}/${encodeURIComponent(id)}`, { signal });
  }

  createPiece(input: CreatePieceInput): Promise<Piece> {
    return this.client.post<Piece>(PIECES, input);
  }

  updatePiece(id: string, input: UpdatePieceInput): Promise<Piece> {
    return this.client.patch<Piece>(`${PIECES}/${encodeURIComponent(id)}`, input);
  }

  async deletePiece(id: string): Promise<void> {
    await this.client.delete(`${PIECES}/${encodeURIComponent(id)}`);
  }

  /* ---- assignments ---- */

  listAssignments(params: AssignmentListParams = {}, signal?: AbortSignal): Promise<Page<PieceAssignment>> {
    return this.client.getPage<PieceAssignment>(ASSIGNMENTS, { query: assignmentQuery(params), signal });
  }

  getAssignment(id: string, signal?: AbortSignal): Promise<PieceAssignment> {
    return this.client.get<PieceAssignment>(`${ASSIGNMENTS}/${encodeURIComponent(id)}`, { signal });
  }

  assignPiece(input: CreateAssignmentInput): Promise<PieceAssignment> {
    return this.client.post<PieceAssignment>(ASSIGNMENTS, input);
  }

  updateAssignment(id: string, input: UpdateAssignmentInput): Promise<PieceAssignment> {
    return this.client.patch<PieceAssignment>(`${ASSIGNMENTS}/${encodeURIComponent(id)}`, input);
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.client.delete(`${ASSIGNMENTS}/${encodeURIComponent(id)}`);
  }

  /* ---- events ---- */

  listEvents(params: ProgressEventListParams = {}, signal?: AbortSignal): Promise<Page<ProgressEvent>> {
    return this.client.getPage<ProgressEvent>(EVENTS, { query: eventQuery(params), signal });
  }

  recordProgress(input: RecordProgressInput): Promise<ProgressEvent> {
    return this.client.post<ProgressEvent>(EVENTS, input);
  }

  /* ---- derived ---- */

  async studentAssignments(studentId: string, signal?: AbortSignal): Promise<AssignmentWithPiece[]> {
    return this.client.get<AssignmentWithPiece[]>(
      `students/${encodeURIComponent(studentId)}/assignments`,
      { signal },
    );
  }

  /**
   * One round trip for the whole progress view.
   *
   * Deliberately a server-computed endpoint rather than three client calls:
   * the analytics must run over the complete history, which may be thousands
   * of events, and shipping that to a browser to compute an average would not
   * scale.
   */
  studentOverview(studentId: string, signal?: AbortSignal): Promise<StudentProgressOverview> {
    return this.client.get<StudentProgressOverview>(
      `students/${encodeURIComponent(studentId)}/progress-overview`,
      { signal },
    );
  }
}

/* Domain params → wire query params (snake_case, per the API contract). */

export function pieceQuery(params: PieceListParams): QueryParams {
  return {
    instrument_id: params.instrumentId,
    program_id: params.programId,
    search: params.search,
    active_only: params.activeOnly,
    page: params.page,
    per_page: params.per_page,
  };
}

export function assignmentQuery(params: AssignmentListParams): QueryParams {
  return {
    student_id: params.studentId,
    piece_id: params.pieceId,
    teacher_id: params.teacherId,
    status: params.status,
    active_only: params.activeOnly,
    page: params.page,
    per_page: params.per_page,
  };
}

export function eventQuery(params: ProgressEventListParams): QueryParams {
  return {
    student_id: params.studentId,
    piece_id: params.pieceId,
    assignment_id: params.assignmentId,
    since: params.since,
    until: params.until,
    page: params.page,
    per_page: params.per_page,
  };
}
