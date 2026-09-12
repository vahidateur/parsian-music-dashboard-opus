import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, notFound, paginate, validationError } from "@/domains/shared/demoCollection";
import { isClassActive } from "@/domains/classes/demoRepository";
import type { Page } from "@/api/types";
import type { EnrollmentRepository } from "./repository";
import type { CreateEnrollmentInput, Enrollment, EnrollmentListParams, UpdateEnrollmentInput } from "./types";

/** Statuses that occupy a seat. Waitlist deliberately does not. */
const SEAT_STATUSES = new Set(["active"]);

export const occupiesSeat = (e: Enrollment): boolean => SEAT_STATUSES.has(e.status);

/**
 * Implementation #1 — demo enrollment with real invariants.
 *
 * Enforced here:
 *  - student and class must exist
 *  - class must not be archived
 *  - no duplicate active/waitlist enrollment for the same student+class
 *  - active enrollment may not exceed class capacity
 *
 * BACKEND REQUIRED (§10): in production these are database invariants —
 * a UNIQUE(student_id, class_id) partial index over open statuses, plus a
 * capacity check inside a transaction. Client-side checks race under
 * concurrency and must never be the only enforcement.
 */
export class DemoEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: EnrollmentListParams = {}): Promise<Page<Enrollment>> {
    const filtered = this.store.enrollments.all().filter((e) => {
      if (params.studentId && e.studentId !== params.studentId) return false;
      if (params.classId && e.classId !== params.classId) return false;
      if (params.status && e.status !== params.status) return false;
      if (params.activeOnly && !occupiesSeat(e)) return false;
      return true;
    });
    return paginate(filtered, params);
  }

  async get(id: string): Promise<Enrollment> {
    const found = this.store.enrollments.find(id);
    if (!found) throw enrollmentNotFound(id);
    return found;
  }

  async enroll(input: CreateEnrollmentInput): Promise<Enrollment> {
    const status = input.status ?? "active";
    const student = this.store.students.find(input.studentId);
    const cls = this.store.classes.find(input.classId);

    const fields: Record<string, string[]> = {};
    if (!student) fields.studentId = ["هنرجو یافت نشد."];
    if (!cls) fields.classId = ["کلاس یافت نشد."];
    if (Object.keys(fields).length > 0) {
      throw validationError("ENROLLMENT_INVALID", "اطلاعات ثبت‌نام معتبر نیست.", fields);
    }
    if (cls && !isClassActive(cls)) {
      throw conflict("CLASS_ARCHIVED", "این کلاس بایگانی شده و ثبت‌نام جدید نمی‌پذیرد.", { classId: ["بایگانی‌شده"] });
    }

    // One open enrollment per student per class.
    const open = this.store.enrollments
      .all()
      .filter((e) => e.classId === input.classId && e.studentId === input.studentId)
      .filter((e) => e.status === "active" || e.status === "waitlist");
    if (open.length > 0) {
      throw conflict("ENROLLMENT_DUPLICATE", "این هنرجو از قبل در این کلاس ثبت‌نام باز دارد.");
    }

    if (status === "active" && cls) {
      const seats = this.countActive(cls.id);
      if (seats >= cls.capacity) {
        throw conflict(
          "CLASS_FULL",
          `ظرفیت کلاس تکمیل است (${cls.capacity}). می‌توانید هنرجو را در لیست انتظار قرار دهید.`,
          { classId: ["ظرفیت تکمیل"] },
        );
      }
    }

    const created = this.store.enrollments.create({
      studentId: input.studentId,
      classId: input.classId,
      status,
      startDate: input.startDate ?? "امروز",
      pricingPlan: input.pricingPlan ?? { label: cls?.level ?? "—", amount: cls?.tuition ?? 0 },
    });
    this.syncClassProjection(input.classId);
    return created;
  }

  async update(id: string, input: UpdateEnrollmentInput): Promise<Enrollment> {
    const existing = this.store.enrollments.find(id);
    if (!existing) throw enrollmentNotFound(id);

    // Promoting from waitlist must respect capacity.
    if (input.status === "active" && existing.status !== "active") {
      const cls = this.store.classes.find(existing.classId);
      if (cls && this.countActive(cls.id) >= cls.capacity) {
        throw conflict("CLASS_FULL", `ظرفیت کلاس تکمیل است (${cls.capacity}).`, { status: ["ظرفیت تکمیل"] });
      }
    }
    const updated = this.store.enrollments.update(id, input);
    if (!updated) throw enrollmentNotFound(id);
    this.syncClassProjection(updated.classId);
    return updated;
  }

  async withdraw(id: string): Promise<Enrollment> {
    const updated = this.store.enrollments.update(id, { status: "cancelled", endDate: "امروز" });
    if (!updated) throw enrollmentNotFound(id);
    this.syncClassProjection(updated.classId);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.store.enrollments.find(id);
    if (!existing) throw enrollmentNotFound(id);
    this.store.enrollments.remove(id);
    this.syncClassProjection(existing.classId);
  }

  private countActive(classId: string): number {
    return this.store.enrollments.all().filter((e) => e.classId === classId && occupiesSeat(e)).length;
  }

  /**
   * Keeps the denormalized display fields on the class in step with the
   * authoritative enrollment rows. Enrollment remains the source of truth.
   */
  private syncClassProjection(classId: string): void {
    const rows = this.store.enrollments.all().filter((e) => e.classId === classId);
    const active = rows.filter(occupiesSeat);
    this.store.classes.update(classId, {
      enrolled: active.length,
      waitlist: rows.filter((e) => e.status === "waitlist").length,
      studentIds: active.map((e) => e.studentId),
    });
  }
}

function enrollmentNotFound(id: string) {
  return notFound("ENROLLMENT_NOT_FOUND", `ثبت‌نام با شناسهٔ ${id} یافت نشد.`);
}
