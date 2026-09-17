/**
 * Class domain types — the canonical owner of the class entity (M10).
 *
 * The entity moved here unchanged from the dissolved fixture module
 * (`src/data/records.ts`): it is the shape the Classes view renders AND the
 * shape the persisted demo dataset stores, and this domain is its one owner.
 *
 * §9: `studentIds` on `AcademyClass` is a DENORMALIZED DISPLAY FIELD ONLY.
 * Enrollment is the canonical Student↔Class relationship. Repository writes
 * keep `studentIds`/`enrolled` in sync as a projection; never treat them as the
 * source of truth.
 *
 * NOTE on the name `ClassStatus`: this domain owns the *offering lifecycle*
 * vocabulary (`active | archived`). The *session row timeline* vocabulary
 * (`done | live | next | scheduled | cancelled | attention`) belongs to
 * scheduling semantics and lives in `@/domains/scheduling/types` under the
 * non-colliding name `ClassSessionStatus` (M10).
 *
 * MULTI-TENANCY (§21): production `classes` needs `organization_id`.
 */
import type { InstrumentId } from "@/domains/instruments/types";
import type { ListParams } from "@/api/types";

export interface AcademyClass {
  id: string;
  /** Absent means active. "archived" hides the class from new enrollment. */
  status?: "active" | "archived";
  title: string;
  instrument: InstrumentId;
  teacherId: string;
  roomId: string;
  kind: "private" | "group";
  level: string;
  days: number[];
  time: string;
  duration: number;
  enrolled: number;
  capacity: number;
  attendanceAvg: number;
  waitlist: number;
  tuition: number;
  termProgress: number;
  studentIds: string[];
}

export type ClassStatus = "active" | "archived";

export interface ClassListParams extends ListParams {
  search?: string;
  instrument?: InstrumentId;
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
