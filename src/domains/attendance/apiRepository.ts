import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { AttendanceRepository } from "./repository";
import type {
  AttendanceCorrection,
  AttendanceListParams,
  AttendanceRecord,
  BulkRecordInput,
  CorrectionInput,
  CorrectionListParams,
  RecordAttendanceInput,
  SessionAttendance,
} from "./types";

const ATTENDANCE = "attendance";

/**
 * Implementation #2 — REST backend for attendance.
 *
 * **No server implements these endpoints, and this class is deliberately NOT
 * registered.** Wiring it would turn every call into a failing request
 * presented as a feature (§37). It exists so the boundary is real: it compiles
 * against the same interface the demo satisfies, uses the shared `ApiClient`,
 * and pins the contract a backend must honour.
 *
 * ENDPOINTS
 *
 *   GET    /api/v1/attendance
 *   GET    /api/v1/attendance/{id}
 *   POST   /api/v1/attendance
 *   POST   /api/v1/attendance/bulk
 *   POST   /api/v1/attendance/{id}/correct
 *   GET    /api/v1/attendance/corrections
 *   GET    /api/v1/sessions/{id}/attendance
 *   GET    /api/v1/sessions/with-attendance
 *
 * NOTE THE ABSENCES. There is no `PATCH /attendance/{id}` and no
 * `DELETE /attendance/{id}`, mirroring the interface. Changing a mark is a
 * `correct` action that requires a reason and appends immutable history; a
 * bare update endpoint would let a disputed absence be rewritten with no
 * trace, which is the failure this domain exists to prevent.
 *
 * SERVER-SIDE OBLIGATIONS (see docs/production-handoff.md)
 *
 *   - `UNIQUE(session_id, student_id)` must be a DATABASE constraint. An
 *     application check loses to two concurrent submissions of the same
 *     register.
 *   - `/attendance/bulk` must run in one transaction: all rows or none.
 *   - Corrections must be append-only, enforced by table grants (INSERT and
 *     SELECT, no UPDATE or DELETE) rather than by application discipline.
 *   - `recordedAt` / `changedAt` must be server-generated. A browser clock is
 *     user-controlled and a back-dated mark is exactly what a dispute turns on.
 *   - `recordedByUserId` / `changedByUserId` must be taken from the
 *     authenticated session, NOT from the request body. They are provenance,
 *     and a client-supplied value is an unverified claim.
 *   - Roster membership must be re-derived server-side from Enrollment; the
 *     client's view of who is on the register is not authoritative.
 *   - A teacher must only reach sessions they are authorized for; scoping by
 *     `session.teacherId` in a query string is not an access control.
 */
export class ApiAttendanceRepository implements AttendanceRepository {
  constructor(private readonly client: ApiClient) {}

  /* ---------------- records ---------------- */

  list(params: AttendanceListParams = {}, signal?: AbortSignal): Promise<Page<AttendanceRecord>> {
    return this.client.getPage<AttendanceRecord>(ATTENDANCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<AttendanceRecord> {
    return this.client.get<AttendanceRecord>(`${ATTENDANCE}/${encodeURIComponent(id)}`, { signal });
  }

  record(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    return this.client.post<AttendanceRecord>(ATTENDANCE, input);
  }

  /** MUST be one transaction server-side. */
  bulkRecord(input: BulkRecordInput): Promise<AttendanceRecord[]> {
    return this.client.post<AttendanceRecord[]>(`${ATTENDANCE}/bulk`, input);
  }

  /** A verb, not a patch: the server appends the correction atomically. */
  correct(id: string, input: CorrectionInput): Promise<AttendanceRecord> {
    return this.client.post<AttendanceRecord>(
      `${ATTENDANCE}/${encodeURIComponent(id)}/correct`,
      input,
    );
  }

  /* ---------------- audit trail ---------------- */

  listCorrections(
    params: CorrectionListParams = {},
    signal?: AbortSignal,
  ): Promise<Page<AttendanceCorrection>> {
    return this.client.getPage<AttendanceCorrection>(`${ATTENDANCE}/corrections`, {
      query: toCorrectionQuery(params),
      signal,
    });
  }

  /* ---------------- derived ---------------- */

  /** The server derives the roster; the client's copy is not authoritative. */
  sessionAttendance(sessionId: string, signal?: AbortSignal): Promise<SessionAttendance> {
    return this.client.get<SessionAttendance>(
      `sessions/${encodeURIComponent(sessionId)}/attendance`,
      { signal },
    );
  }

  async sessionIdsWithAttendance(signal?: AbortSignal): Promise<ReadonlySet<string>> {
    const ids = await this.client.get<string[]>("sessions/with-attendance", { signal });
    return new Set(ids);
  }
}

/* Domain params → wire query params (snake_case, per the API contract). */

export function toQuery(params: AttendanceListParams): QueryParams {
  return {
    session_id: params.sessionId,
    student_id: params.studentId,
    status: params.status,
    since: params.since,
    until: params.until,
    page: params.page,
    per_page: params.per_page,
  };
}

export function toCorrectionQuery(params: CorrectionListParams): QueryParams {
  return {
    attendance_record_id: params.attendanceRecordId,
    session_id: params.sessionId,
    student_id: params.studentId,
    page: params.page,
    per_page: params.per_page,
  };
}
