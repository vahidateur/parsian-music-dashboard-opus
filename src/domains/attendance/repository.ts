import type { Page } from "@/api/types";
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

/**
 * Attendance repository — marks against a session, and their audit trail.
 *
 * NO UPDATE, NO DELETE, BY DESIGN
 *
 * There is no `update` and no `delete` verb. Changing a mark goes through
 * `correct`, which requires a reason and appends an immutable
 * `AttendanceCorrection`. Offering a bare update would let the UI rewrite a
 * disputed absence with no trace, which is exactly the failure this domain
 * exists to prevent.
 *
 * `bulkRecord` IS ATOMIC
 *
 * A register is saved as one act. The implementation must validate every entry
 * — roster membership, session state, duplicates — before writing any of them,
 * so a teacher never ends up with half a register saved and no clear idea
 * which half.
 *
 * THE ROSTER IS DERIVED
 *
 * `sessionAttendance` joins the roster derived from active Enrollment at the
 * session's date with whatever marks exist. Students are never stored on a
 * session, so a mid-term join or withdrawal is reflected automatically.
 */
export interface AttendanceRepository {
  /* ---------------- records ---------------- */

  list(params?: AttendanceListParams, signal?: AbortSignal): Promise<Page<AttendanceRecord>>;
  get(id: string, signal?: AbortSignal): Promise<AttendanceRecord>;

  /**
   * Marks one student. Refused when the session is cancelled, the student is
   * not on the derived roster, or a mark already exists for the pair — use
   * `correct` to change an existing mark.
   */
  record(input: RecordAttendanceInput): Promise<AttendanceRecord>;

  /** Saves a whole register. All-or-nothing. */
  bulkRecord(input: BulkRecordInput): Promise<AttendanceRecord[]>;

  /**
   * Changes an existing mark and appends an immutable correction.
   * `reason` is required.
   */
  correct(id: string, input: CorrectionInput): Promise<AttendanceRecord>;

  /* ---------------- audit trail ---------------- */

  /** Correction history, newest first. Paginated: it grows without bound. */
  listCorrections(
    params?: CorrectionListParams,
    signal?: AbortSignal,
  ): Promise<Page<AttendanceCorrection>>;

  /* ---------------- derived ---------------- */

  /** Derived roster joined with existing marks, in one pass. */
  sessionAttendance(sessionId: string, signal?: AbortSignal): Promise<SessionAttendance>;

  /**
   * Session ids that have at least one attendance record.
   *
   * This is the narrow boundary the scheduling domain consumes to protect
   * attendance-bearing sessions from destructive operations. It returns ids
   * only — scheduling learns nothing about attendance internals, and the
   * dependency stays one-directional.
   */
  sessionIdsWithAttendance(signal?: AbortSignal): Promise<ReadonlySet<string>>;
}
