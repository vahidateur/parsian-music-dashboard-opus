import type { Page } from "@/api/types";
import type { ConflictReport } from "./types";
import type {
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

/**
 * Scheduling repository — the Session lifecycle.
 *
 * A `Session` is one real dated occurrence. The Class remains the offering and
 * `class.days/time/duration` remains the recurrence source; this repository
 * never writes those fields.
 *
 * DOMAIN VERBS, NOT FIELD WRITES
 *
 * `cancelSession` and `rescheduleSession` exist as verbs rather than as
 * `update({ status })` because each carries an invariant a caller must not be
 * able to bypass: a cancellation always records a reason, and a reschedule
 * always creates a new session linked to the original rather than mutating a
 * date in place. Mutating the date would destroy the record that the session
 * ever existed at the original time — which is exactly what a parent disputes.
 *
 * PREVIEW IS WRITE-FREE
 *
 * `previewGeneration` and `generateSessions` are deliberately separate calls.
 * The preview computes the identical plan and performs **no writes**, so the UI
 * can show "۱۲ ایجاد · ۳ بدون تغییر · ۲ محافظت‌شده" before anyone commits to it.
 * An implementation that writes during a preview is a defect, not an
 * optimisation.
 *
 * PROTECTION INVARIANTS (enforced here, never in the UI)
 *
 *   - a session with attendance recorded is never modified or deleted;
 *   - a past session is never modified by generation;
 *   - a cancelled session is never resurrected;
 *   - a manually created or edited session is never overwritten by generation;
 *   - a future generated session whose class recurrence changed is updated
 *     ONLY when the caller passes `confirmUpdates`;
 *   - an orphaned future session is reported, never silently deleted.
 *
 * CONFLICTS ARE DERIVED
 *
 * There is no stored conflict state. `checkConflicts` computes a report from
 * the current schedule, so cancelling or moving one session immediately
 * changes the answer for every other. Hard conflicts are always refused;
 * warnings require explicit acknowledgement on the input.
 */
export interface SchedulingRepository {
  /* ---------------- sessions ---------------- */

  list(params?: SessionListParams, signal?: AbortSignal): Promise<Page<Session>>;
  get(id: string, signal?: AbortSignal): Promise<Session>;

  /** Creates a one-off session. Always `origin: "manual"`. */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Edits a session in place. Marks it `origin: "manual"` so bulk generation
   * will never overwrite the change. Refused when attendance exists.
   */
  update(id: string, input: UpdateSessionInput): Promise<Session>;

  /** Cancels a session. `reason` is required and preserved for the record. */
  cancelSession(id: string, reason: string): Promise<Session>;

  /**
   * Moves a session by cancelling the original and creating a linked
   * replacement. Returns the NEW session; the original keeps
   * `rescheduledToId` and the replacement keeps `rescheduledFromId`.
   */
  rescheduleSession(id: string, input: RescheduleInput): Promise<Session>;

  /** Hard-deletes a session. Refused when any attendance record exists. */
  delete(id: string): Promise<void>;

  /* ---------------- generation ---------------- */

  /** Computes the plan. **Writes nothing.** */
  previewGeneration(input: GenerateInput, signal?: AbortSignal): Promise<GenerationPlan>;

  /** Applies a freshly recomputed plan. Idempotent for an unchanged window. */
  generateSessions(input: GenerateInput): Promise<GenerationResult>;

  /* ---------------- derived ---------------- */

  /** Conflict report for a candidate, against the current schedule. */
  checkConflicts(candidate: SessionCandidate, signal?: AbortSignal): Promise<ConflictReport>;

  /**
   * Students expected at a session, derived from active Enrollment scoped to
   * the session's date. Never a stored list: a student who joins in week 6
   * must not appear on week 2's roster.
   */
  sessionRoster(sessionId: string, signal?: AbortSignal): Promise<RosterEntry[]>;
}
