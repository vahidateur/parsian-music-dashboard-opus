/**
 * Teacher domain types — the canonical owner of the teacher entity (M10).
 *
 * The entity moved here unchanged from the dissolved fixture module
 * (`src/data/records.ts`): it is the shape the Teachers view renders AND the
 * shape the persisted demo dataset stores, and this domain is its one owner.
 *
 * MULTI-TENANCY (§21): a production `teachers` table needs `organization_id`
 * with a composite unique index on (organization_id, phone).
 */
import type { InstrumentId } from "@/domains/instruments/types";
import type { ListParams } from "@/api/types";

export interface TeacherNote {
  date: string;
  text: string;
}

export interface Teacher {
  id: string;
  name: string;
  /** Profile photo as a `MediaAsset.id`. See `Student.photoMediaId`. */
  photoMediaId?: string;
  instrument: InstrumentId;
  title: string;
  students: number;
  utilization: number; // % of contracted hours filled
  weeklyHours: number;
  contractHours: number;
  attendanceRate: number;
  retention: number;
  todayClasses: string[]; // session ids
  /** availability grid: 7 days × 4 blocks (صبح، ظهر، عصر، شب) — 0 free, 1 booked, 2 unavailable */
  availability: number[][];
  since: string;
  phone: string;
  /** `inactive` = deactivated; excluded from new class/session assignment. */
  status: "active" | "absent-tomorrow" | "light-load" | "inactive";
  bio: string;
}

/** Employment state. `active` is the only status eligible for new assignments. */
export type TeacherStatus = Teacher["status"];

export interface TeacherListParams extends ListParams {
  search?: string;
  instrument?: InstrumentId;
  status?: TeacherStatus;
  /** Only teachers assignable to new classes/sessions (status === "active"). */
  assignableOnly?: boolean;
  sort?: "name" | "utilization" | "students";
  dir?: "asc" | "desc";
}

export type CreateTeacherInput = Omit<Teacher, "id" | "todayClasses" | "availability"> &
  Partial<Pick<Teacher, "todayClasses" | "availability">>;

export type UpdateTeacherInput = Partial<Omit<Teacher, "id">>;
