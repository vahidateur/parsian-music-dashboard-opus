/**
 * Student domain types.
 *
 * The entity itself is reused from `@/data/records` — it is already the shape
 * the views render, and duplicating it would create two sources of truth.
 * Only the *operation* types (list params, create/update inputs) live here.
 *
 * Domain note: a Student is NOT bound to a class. `Student.teacherId` in the
 * demo dataset is a denormalized convenience field, not the authoritative
 * relationship — enrollments own Student ↔ Class over time.
 */
import type { Instrument } from "@/data/academy";
import type { PaymentStatus, Student, StudentStatus } from "@/data/records";
import type { ListParams } from "@/api/types";

export type { Student, StudentStatus, PaymentStatus };

export interface StudentListParams extends ListParams {
  /** Free-text query over name/phone. */
  search?: string;
  status?: StudentStatus;
  instrument?: Instrument;
  payment?: PaymentStatus;
  teacherId?: string;
}

/** Everything a caller must supply to create a student. */
export type CreateStudentInput = Omit<Student, "id" | "notes" | "activity" | "skills"> &
  Partial<Pick<Student, "notes" | "activity" | "skills">>;

/** Partial patch semantics, mirroring `PATCH /students/{id}`. */
export type UpdateStudentInput = Partial<Omit<Student, "id">>;
