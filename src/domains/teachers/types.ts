/**
 * Teacher domain types.
 *
 * The entity is reused from `@/data/records` — it is already the shape the
 * Teachers view renders, and duplicating it would create two sources of truth.
 * Only operation types live here.
 *
 * MULTI-TENANCY (§21): a production `teachers` table needs `organization_id`
 * with a composite unique index on (organization_id, phone).
 */
import type { Instrument } from "@/data/academy";
import type { Teacher } from "@/data/records";
import type { ListParams } from "@/api/types";

export type { Teacher };

/** Employment state. `active` is the only status eligible for new assignments. */
export type TeacherStatus = Teacher["status"];

export interface TeacherListParams extends ListParams {
  search?: string;
  instrument?: Instrument;
  status?: TeacherStatus;
  /** Only teachers assignable to new classes/sessions (status === "active"). */
  assignableOnly?: boolean;
  sort?: "name" | "utilization" | "students";
  dir?: "asc" | "desc";
}

export type CreateTeacherInput = Omit<Teacher, "id" | "todayClasses" | "availability"> &
  Partial<Pick<Teacher, "todayClasses" | "availability">>;

export type UpdateTeacherInput = Partial<Omit<Teacher, "id">>;
