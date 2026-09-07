import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { SchedulingRepository } from "./repository";
import type {
  ConflictReport,
  CreateSessionInput,
  GenerateInput,
  GenerationPlan,
  GenerationResult,
  RescheduleInput,
  RosterEntry,
  Session,
  SessionCandidate,
  SessionListParams,
  UpdateSessionInput,
} from "./types";

const SESSIONS = "sessions";

/**
 * Implementation #2 — REST backend for scheduling.
 *
 * **No server implements these endpoints, and this class is deliberately NOT
 * registered in `registry.ts`.** Wiring it would produce failing requests
 * dressed up as a feature, which §37 forbids. It exists so the boundary is
 * real rather than hypothetical: it compiles against the same interface the
 * demo satisfies, uses the shared `ApiClient`, and pins the contract a backend
 * must honour.
 *
 * ENDPOINTS
 *
 *   GET    /api/v1/sessions
 *   POST   /api/v1/sessions
 *   GET    /api/v1/sessions/{id}
 *   PATCH  /api/v1/sessions/{id}
 *   DELETE /api/v1/sessions/{id}
 *   POST   /api/v1/sessions/{id}/cancel
 *   POST   /api/v1/sessions/{id}/reschedule
 *   POST   /api/v1/sessions/generate          (?preview=1 for a dry run)
 *   POST   /api/v1/sessions/check-conflicts
 *   GET    /api/v1/sessions/{id}/roster
 *
 * WHY GENERATION IS A POST WITH `?preview=1` RATHER THAN A GET
 *
 * The plan depends on a window plus the full current schedule, which is too
 * large and too structured for a query string, and the request body is
 * identical to the write call. Keeping one endpoint with a preview flag
 * guarantees the preview and the commit compute the same plan — two separate
 * endpoints would eventually drift, and a preview that disagrees with the
 * write is worse than no preview.
 *
 * SERVER-SIDE OBLIGATIONS (see docs/production-handoff.md)
 *
 *   - Conflict detection must be re-run inside the write transaction with a
 *     unique constraint on (room, date, time-range) and (teacher, date,
 *     time-range). A client-side check cannot stop two admins booking the same
 *     room simultaneously.
 *   - `?preview=1` must be strictly read-only and must not hold locks.
 *   - The protection rules (attendance-bearing, past, cancelled, manual) must
 *     be enforced server-side; the client cannot be trusted to send
 *     `confirmUpdates` honestly.
 *   - Timestamps must be server-generated; a browser clock is user-controlled.
 *   - Roster derivation must happen server-side from Enrollment, and must be
 *     scoped by the caller's authorization (a teacher may only see their own).
 */
export class ApiSchedulingRepository implements SchedulingRepository {
  constructor(private readonly client: ApiClient) {}

  /* ---------------- sessions ---------------- */

  list(params: SessionListParams = {}, signal?: AbortSignal): Promise<Page<Session>> {
    return this.client.getPage<Session>(SESSIONS, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<Session> {
    return this.client.get<Session>(`${SESSIONS}/${encodeURIComponent(id)}`, { signal });
  }

  create(input: CreateSessionInput): Promise<Session> {
    return this.client.post<Session>(SESSIONS, input);
  }

  update(id: string, input: UpdateSessionInput): Promise<Session> {
    return this.client.patch<Session>(`${SESSIONS}/${encodeURIComponent(id)}`, input);
  }

  /** A verb, not a status patch: the server records the reason atomically. */
  cancelSession(id: string, reason: string): Promise<Session> {
    return this.client.post<Session>(`${SESSIONS}/${encodeURIComponent(id)}/cancel`, { reason });
  }

  /** Returns the NEW session; the server links it to the cancelled original. */
  rescheduleSession(id: string, input: RescheduleInput): Promise<Session> {
    return this.client.post<Session>(`${SESSIONS}/${encodeURIComponent(id)}/reschedule`, input);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${SESSIONS}/${encodeURIComponent(id)}`);
  }

  /* ---------------- generation ---------------- */

  /** MUST be read-only server-side. */
  previewGeneration(input: GenerateInput, signal?: AbortSignal): Promise<GenerationPlan> {
    return this.client.post<GenerationPlan>(`${SESSIONS}/generate`, input, {
      query: { preview: 1 },
      signal,
    });
  }

  generateSessions(input: GenerateInput): Promise<GenerationResult> {
    return this.client.post<GenerationResult>(`${SESSIONS}/generate`, input);
  }

  /* ---------------- derived ---------------- */

  checkConflicts(candidate: SessionCandidate, signal?: AbortSignal): Promise<ConflictReport> {
    return this.client.post<ConflictReport>(`${SESSIONS}/check-conflicts`, candidate, { signal });
  }

  sessionRoster(sessionId: string, signal?: AbortSignal): Promise<RosterEntry[]> {
    return this.client.get<RosterEntry[]>(`${SESSIONS}/${encodeURIComponent(sessionId)}/roster`, {
      signal,
    });
  }
}

/** Domain params → wire query params (snake_case, per the API contract). */
export function toQuery(params: SessionListParams): QueryParams {
  return {
    class_id: params.classId,
    teacher_id: params.teacherId,
    room_id: params.roomId,
    status: params.status,
    from: params.from,
    to: params.to,
    active_only: params.activeOnly,
    page: params.page,
    per_page: params.per_page,
  };
}
