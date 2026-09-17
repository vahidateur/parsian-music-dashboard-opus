import type { Page } from "@/api/types";
import type { CreateEnrollmentInput, Enrollment, EnrollmentListParams, UpdateEnrollmentInput } from "./types";

/**
 * Enrollment is the canonical Student↔Class edge.
 *
 * `enroll`/`withdraw` are the domain verbs; capacity and duplicate rules live
 * behind them so no caller can bypass an invariant by writing the array.
 */
export interface EnrollmentRepository {
  list(params?: EnrollmentListParams, signal?: AbortSignal): Promise<Page<Enrollment>>;
  get(id: string, signal?: AbortSignal): Promise<Enrollment>;
  enroll(input: CreateEnrollmentInput): Promise<Enrollment>;
  update(id: string, input: UpdateEnrollmentInput): Promise<Enrollment>;
  /** Cancels an enrollment, freeing its seat. History is preserved. */
  withdraw(id: string): Promise<Enrollment>;
  delete(id: string): Promise<void>;
}
