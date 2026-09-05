/**
 * Enrollment — the authoritative Student ↔ Class relationship.
 *
 * `Student` never carries a `classId`, and `AcademyClass.studentIds` in the
 * demo dataset is a denormalized display convenience. Enrollments are the
 * normalized edge and are what a future backend will expose at
 * `GET /classes/{id}/enrollments`.
 */

export type EnrollmentStatus = "active" | "waitlist" | "completed" | "cancelled";

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  status: EnrollmentStatus;
  /** Jalali display date, matching the rest of the demo dataset. */
  startDate: string;
  endDate?: string;
  /** Tuition plan snapshot at enrollment time (Toman per term). */
  pricingPlan: { label: string; amount: number };
}
