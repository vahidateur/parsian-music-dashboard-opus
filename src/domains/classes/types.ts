/**
 * Class domain types.
 *
 * §9: `studentIds` on `AcademyClass` is a DENORMALIZED DISPLAY FIELD ONLY.
 * Enrollment is the canonical Student↔Class relationship. Repository writes
 * keep `studentIds`/`enrolled` in sync as a projection; never treat them as the
 * source of truth.
 *
 * MULTI-TENANCY (§21): production `classes` needs `organization_id`.
 */
import type { Instrument } from "@/data/academy";
import type { AcademyClass } from "@/data/records";
import type { ListParams } from "@/api/types";

export type { AcademyClass };

export type ClassStatus = "active" | "archived";

export interface ClassListParams extends ListParams {
  search?: string;
  instrument?: Instrument;
  teacherId?: string;
  roomId?: string;
  status?: ClassStatus;
  assignableOnly?: boolean;
  /** Include archived classes in the result (default: false). */
  includeArchived?: boolean;
  sort?: "title" | "enrolled" | "capacity";
  dir?: "asc" | "desc";
}

export type CreateClassInput = Omit<
  AcademyClass,
  "id" | "studentIds" | "enrolled" | "waitlist" | "attendanceAvg" | "termProgress"
> &
  Partial<Pick<AcademyClass, "attendanceAvg" | "termProgress">>;

export type UpdateClassInput = Partial<Omit<AcademyClass, "id" | "studentIds" | "enrolled" | "waitlist">>;
