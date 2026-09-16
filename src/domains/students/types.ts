/**
 * Student domain types — the canonical owner of the student entity (M10).
 *
 * The entity moved here unchanged from the dissolved fixture module
 * (`src/data/records.ts`): it is the shape the views render AND the shape the
 * persisted demo dataset stores, and this domain is its one owner.
 *
 * Domain note: a Student is NOT bound to a class. `Student.teacherId` in the
 * demo dataset is a denormalized convenience field, not the authoritative
 * relationship — enrollments own Student ↔ Class over time.
 *
 * `PaymentStatus` is anchored by the `payment` field here and shared with the
 * seeded invoices; its canonical home is `src/lib/financeVocabulary.ts`
 * (the smallest non-domain owner — D6/I2 keep a finance domain *planned*).
 * It is re-exported so existing importers keep working.
 */
import type { InstrumentId } from "@/domains/instruments/types";
import type { PaymentStatus } from "@/lib/financeVocabulary";
import type { ListParams } from "@/api/types";

export type { PaymentStatus };

export type StudentStatus = "active" | "at-risk" | "paused" | "waitlist";
export const studentStatusLabel: Record<StudentStatus, string> = {
  active: "فعال",
  "at-risk": "در معرض ریزش",
  paused: "متوقف",
  waitlist: "لیست انتظار",
};

export interface StudentNote {
  by: string;
  date: string;
  text: string;
}
export interface ActivityEntry {
  date: string;
  kind: "session" | "payment" | "note" | "enroll" | "absence" | "message";
  text: string;
}

export interface Student {
  id: string;
  /**
   * Iranian national ID (کد ملی), normalized to 10 ASCII digits.
   * Required and unique per academy. Sensitive personal data — see
   * `src/lib/nationalId.ts` and docs/architecture/students.md.
   * BACKEND REQUIRED: NOT NULL + UNIQUE(organization_id, national_id) + INDEX.
   */
  nationalId: string;
  name: string;
  /**
   * Profile photo, as a `MediaAsset.id`. Never a data URL: binaries live in
   * the media domain (IndexedDB in demo, object storage in production).
   */
  photoMediaId?: string;
  instrument: InstrumentId;
  teacherId: string;
  level: string;
  levelStep: number; // 1..6
  status: StudentStatus;
  payment: PaymentStatus;
  sessionsUsed: number;
  sessionsTotal: number;
  attendance: number;
  progress: number;
  since: string;
  age: number;
  phone: string;
  guardian?: string;
  nextClass?: { day: string; time: string; room: string };
  lastSeen: string;
  balance: number;
  notes: StudentNote[];
  activity: ActivityEntry[];
  skills: { label: string; value: number }[];
}

export interface StudentListParams extends ListParams {
  /** Free-text query over name/phone. */
  search?: string;
  status?: StudentStatus;
  instrument?: InstrumentId;
  payment?: PaymentStatus;
  teacherId?: string;
}

/** Everything a caller must supply to create a student. */
export type CreateStudentInput = Omit<Student, "id" | "notes" | "activity" | "skills"> &
  Partial<Pick<Student, "notes" | "activity" | "skills">>;

/** Partial patch semantics, mirroring `PATCH /students/{id}`. */
export type UpdateStudentInput = Partial<Omit<Student, "id">>;
